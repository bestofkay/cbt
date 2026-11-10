import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type LoginInput,
  type RegisterInput,
} from '@cbt/shared';
import { assertPasswordPolicy } from '@cbt/domain';
import { decrypt, encrypt, parseDurationMs, randomToken, sha256 } from '../../../shared/crypto.js';
import { env } from '../../../config/env.js';
import { audit } from '../../../shared/audit.js';

async function loadUserAuth(app: FastifyInstance, userId: string) {
  const user = await app.prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      twoFactor: true,
      candidate: true,
    },
  });
  if (!user) throw new NotFoundError('User');
  const roles = user.roles.map((r) => r.role.code);
  const permissions = [
    ...new Set(
      user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)),
    ),
  ];
  return { user, roles, permissions };
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async register(input: RegisterInput) {
    assertPasswordPolicy(input.password);
    const existing = await this.app.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const candidate = await this.app.prisma.candidate.create({ data: {} });
    const user = await this.app.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        locale: input.locale ?? 'en',
        status: 'PENDING_VERIFICATION',
        candidateId: candidate.id,
      },
    });

    const candidateRole = await this.app.prisma.role.findUnique({ where: { code: 'CANDIDATE' } });
    if (candidateRole) {
      await this.app.prisma.userRole.create({
        data: { userId: user.id, roleId: candidateRole.id },
      });
    }

    const token = randomToken();
    await this.app.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${env.webCandidateUrl}/verify-email?token=${token}`;
    const template = await this.app.prisma.emailTemplate.findUnique({
      where: { code: 'email_verification' },
    });
    await this.app.queues.notifications.add('email', {
      to: user.email,
      subject: template?.subject ?? 'Verify your email',
      html: (template?.bodyHtml ?? '<p>{{verifyUrl}}</p>').replaceAll('{{verifyUrl}}', verifyUrl),
      text: (template?.bodyText ?? verifyUrl).replaceAll('{{verifyUrl}}', verifyUrl),
      userId: user.id,
      template: 'email_verification',
    });

    await audit(this.app, {
      actorId: user.id,
      action: 'user.register',
      resource: 'user',
      resourceId: user.id,
    });

    // Activate for immediate use; email verification remains available
    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    });

    const auth = await loadUserAuth(this.app, user.id);
    const tokens = await this.issueTokens(user.id, auth.roles, auth.permissions, {});

    return {
      id: user.id,
      email: user.email,
      status: 'ACTIVE' as const,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: auth.roles,
        permissions: auth.permissions,
      },
    };
  }

  async verifyEmail(token: string) {
    const record = await this.app.prisma.emailVerification.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired verification token');
    }
    await this.app.prisma.$transaction([
      this.app.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.app.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
    ]);
    return { verified: true };
  }

  async login(
    input: LoginInput,
    meta: { ip?: string; userAgent?: string },
  ) {
    const user = await this.app.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { twoFactor: true },
    });
    if (!user?.passwordHash) throw new UnauthorizedError('Invalid credentials');
    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account locked');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedError('Account not active');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= 5;
      await this.app.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          status: lock ? 'LOCKED' : user.status,
          lockedUntil: lock ? new Date(Date.now() + 30 * 60 * 1000) : null,
        },
      });
      await audit(this.app, {
        actorId: user.id,
        action: 'auth.login_failed',
        resource: 'user',
        resourceId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.twoFactor?.enabled) {
      if (!input.otp) {
        return { requires2fa: true as const, userId: user.id };
      }
      const secret = decrypt(user.twoFactor.secretEnc);
      const ok =
        authenticator.check(input.otp, secret) ||
        ((user.twoFactor.backupCodes as string[] | null) ?? []).includes(sha256(input.otp));
      if (!ok) throw new UnauthorizedError('Invalid OTP');
    }

    const auth = await loadUserAuth(this.app, user.id);
    let deviceId: string | undefined;
    if (input.deviceFingerprint) {
      const device = await this.app.prisma.device.create({
        data: {
          userId: user.id,
          name: input.deviceName ?? 'Unknown device',
          trusted: !!input.rememberDevice,
          trustedAt: input.rememberDevice ? new Date() : null,
          lastSeenAt: new Date(),
          lastIp: meta.ip,
        },
      });
      deviceId = device.id;
      await this.app.prisma.browserFingerprint.upsert({
        where: { userId_hash: { userId: user.id, hash: input.deviceFingerprint } },
        update: { lastSeenAt: new Date(), deviceId },
        create: {
          userId: user.id,
          deviceId,
          hash: input.deviceFingerprint,
          components: {},
        },
      });
    }

    const tokens = await this.issueTokens(user.id, auth.roles, auth.permissions, {
      deviceId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.app.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: user.status === 'LOCKED' ? 'ACTIVE' : user.status,
        lastLoginAt: new Date(),
        lastLoginIp: meta.ip,
      },
    });

    await audit(this.app, {
      actorId: user.id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      requires2fa: false as const,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: auth.roles,
        permissions: auth.permissions,
      },
    };
  }

  async issueTokens(
    userId: string,
    roles: string[],
    permissions: string[],
    meta: { deviceId?: string; ip?: string; userAgent?: string },
  ) {
    const user = await this.app.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = await this.app.jwt.sign({
      sub: userId,
      id: userId,
      email: user.email,
      roles,
      permissions,
    });

    const rawRefresh = randomToken(48);
    const familyId = randomUUID();
    await this.app.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(rawRefresh),
        familyId,
        deviceId: meta.deviceId,
        expiresAt: new Date(Date.now() + parseDurationMs(env.jwtRefreshTtl)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  async refresh(rawToken: string, meta: { ip?: string; userAgent?: string }) {
    const hash = sha256(rawToken);
    const existing = await this.app.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Rotation + reuse detection
    await this.app.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const auth = await loadUserAuth(this.app, existing.userId);
    const rawRefresh = randomToken(48);
    const created = await this.app.prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: sha256(rawRefresh),
        familyId: existing.familyId,
        deviceId: existing.deviceId,
        expiresAt: new Date(Date.now() + parseDurationMs(env.jwtRefreshTtl)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await this.app.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { replacedByToken: created.id },
    });

    const accessToken = await this.app.jwt.sign({
      sub: existing.userId,
      id: existing.userId,
      email: auth.user.email,
      roles: auth.roles,
      permissions: auth.permissions,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        roles: auth.roles,
        permissions: auth.permissions,
      },
    };
  }

  async logout(rawRefresh?: string, userId?: string) {
    if (rawRefresh) {
      await this.app.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(rawRefresh) },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.app.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (userId) {
      await audit(this.app, {
        actorId: userId,
        action: 'auth.logout',
        resource: 'user',
        resourceId: userId,
      });
    }
    return { ok: true };
  }

  async requestPasswordReset(
    email: string,
    portal?: 'admin' | 'candidate' | 'proctor',
  ) {
    const user = await this.app.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return { ok: true };
    const token = randomToken();
    await this.app.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const roleCodes = user.roles.map((r) => r.role.code);
    const resolvedPortal =
      portal ??
      (roleCodes.includes('PROCTOR') || roleCodes.includes('INVIGILATOR')
        ? 'proctor'
        : roleCodes.some((c) => c !== 'CANDIDATE')
          ? 'admin'
          : 'candidate');
    const portalBase =
      resolvedPortal === 'admin'
        ? env.webAdminUrl
        : resolvedPortal === 'proctor'
          ? env.webProctorUrl
          : env.webCandidateUrl;
    const resetUrl = `${portalBase}/reset-password?token=${token}`;
    const template = await this.app.prisma.emailTemplate.findUnique({
      where: { code: 'password_reset' },
    });
    await this.app.queues.notifications.add('email', {
      to: user.email,
      subject: template?.subject ?? 'Reset your password',
      html: (template?.bodyHtml ?? '<p>{{resetUrl}}</p>').replaceAll('{{resetUrl}}', resetUrl),
      userId: user.id,
      template: 'password_reset',
    });
    return { ok: true };
  }

  async confirmPasswordReset(token: string, password: string) {
    assertPasswordPolicy(password);
    const record = await this.app.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.app.prisma.$transaction([
      this.app.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.app.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false, failedLoginCount: 0 },
      }),
      this.app.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await audit(this.app, {
      actorId: record.userId,
      action: 'auth.password_reset',
      resource: 'user',
      resourceId: record.userId,
    });
    return { ok: true };
  }

  async setup2fa(userId: string) {
    const secret = authenticator.generateSecret();
    const user = await this.app.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.app.prisma.twoFactorSecret.upsert({
      where: { userId },
      update: { secretEnc: encrypt(secret), enabled: false },
      create: { userId, secretEnc: encrypt(secret), enabled: false },
    });
    const otpauth = authenticator.keyuri(user.email, 'CBT Platform', secret);
    return { secret, otpauth };
  }

  async enable2fa(userId: string, code: string) {
    const record = await this.app.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record) throw new ValidationError('2FA not initialized');
    const secret = decrypt(record.secretEnc);
    if (!authenticator.check(code, secret)) throw new ValidationError('Invalid OTP');
    const backupCodes = Array.from({ length: 8 }, () => randomToken(6));
    await this.app.prisma.twoFactorSecret.update({
      where: { userId },
      data: {
        enabled: true,
        verifiedAt: new Date(),
        backupCodes: backupCodes.map((c) => sha256(c)),
      },
    });
    return { enabled: true, backupCodes };
  }

  async disable2fa(userId: string, code: string) {
    const record = await this.app.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record?.enabled) return { enabled: false };
    const secret = decrypt(record.secretEnc);
    if (!authenticator.check(code, secret)) throw new ValidationError('Invalid OTP');
    await this.app.prisma.twoFactorSecret.update({
      where: { userId },
      data: { enabled: false, backupCodes: [] },
    });
    return { enabled: false };
  }

  async listDevices(userId: string) {
    return this.app.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async revokeDevice(userId: string, deviceId: string) {
    await this.app.prisma.device.updateMany({
      where: { id: deviceId, userId },
      data: { revokedAt: new Date(), trusted: false },
    });
    await this.app.prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const auth = await loadUserAuth(this.app, userId);
    return {
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      displayName: auth.user.displayName,
      status: auth.user.status,
      roles: auth.roles,
      permissions: auth.permissions,
      candidateId: auth.user.candidateId,
      twoFactorEnabled: !!auth.user.twoFactor?.enabled,
    };
  }

  /** OAuth hook — exchanges provider profile for local session */
  async upsertOAuthUser(input: {
    provider: 'google' | 'microsoft';
    providerUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    const existing = await this.app.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },
    });
    let userId = existing?.userId;
    if (!userId) {
      const byEmail = await this.app.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (byEmail) {
        userId = byEmail.id;
      } else {
        const candidate = await this.app.prisma.candidate.create({ data: {} });
        const user = await this.app.prisma.user.create({
          data: {
            email: input.email.toLowerCase(),
            firstName: input.firstName,
            lastName: input.lastName,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            candidateId: candidate.id,
          },
        });
        userId = user.id;
        const candidateRole = await this.app.prisma.role.findUnique({ where: { code: 'CANDIDATE' } });
        if (candidateRole) {
          await this.app.prisma.userRole.create({
            data: { userId, roleId: candidateRole.id },
          });
        }
      }
      await this.app.prisma.oAuthAccount.create({
        data: {
          userId,
          provider: input.provider,
          providerUserId: input.providerUserId,
          email: input.email,
          accessTokenEnc: input.accessToken ? encrypt(input.accessToken) : null,
          refreshTokenEnc: input.refreshToken ? encrypt(input.refreshToken) : null,
        },
      });
    }

    const auth = await loadUserAuth(this.app, userId);
    const tokens = await this.issueTokens(userId, auth.roles, auth.permissions, {});
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        roles: auth.roles,
        permissions: auth.permissions,
      },
    };
  }
}
