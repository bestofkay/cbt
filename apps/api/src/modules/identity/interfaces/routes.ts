import type { FastifyInstance } from 'fastify';
import {
  enable2faSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  verify2faSchema,
  verifyEmailSchema,
  PERMISSIONS,
  ValidationError,
  UnauthorizedError,
} from '@cbt/shared';
import { AuthService } from '../application/auth-service.js';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { z } from 'zod';

export async function identityRoutes(app: FastifyInstance) {
  const auth = new AuthService(app);

  app.post(
    `${env.apiPrefix}/auth/login`,
    {
      config: {
        rateLimit: {
          max: env.authRateLimitMax,
          timeWindow: env.rateLimitWindowMs,
        },
      },
    },
    async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const result = await auth.login(body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      if (!result.requires2fa) {
        reply.setCookie('refreshToken', result.refreshToken, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: env.cookieSecure,
          domain: env.cookieDomain,
        });
      }
      return reply.send(result);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(
    `${env.apiPrefix}/auth/register`,
    {
      config: {
        rateLimit: {
          max: env.authRateLimitMax,
          timeWindow: env.rateLimitWindowMs,
        },
      },
    },
    async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await auth.register(body);
      if (result.refreshToken) {
        reply.setCookie('refreshToken', result.refreshToken, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: env.cookieSecure,
          domain: env.cookieDomain,
        });
      }
      return reply.status(201).send(result);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/refresh`, async (request, reply) => {
    try {
      const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
      const raw = body.refreshToken ?? request.cookies.refreshToken;
      if (!raw) throw new UnauthorizedError('Missing refresh token');
      const result = await auth.refresh(raw, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      reply.setCookie('refreshToken', result.refreshToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure,
        domain: env.cookieDomain,
      });
      return reply.send(result);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/logout`, async (request, reply) => {
    try {
      const user = request.user;
      const raw = request.cookies.refreshToken;
      await auth.logout(raw, user?.id);
      reply.clearCookie('refreshToken', { path: '/' });
      return reply.send({ ok: true });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/verify-email`, async (request, reply) => {
    try {
      const body = verifyEmailSchema.parse(request.body);
      return reply.send(await auth.verifyEmail(body.token));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/password-reset/request`, async (request, reply) => {
    try {
      const body = passwordResetRequestSchema.parse(request.body);
      return reply.send(await auth.requestPasswordReset(body.email, body.portal));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/password-reset/confirm`, async (request, reply) => {
    try {
      const body = passwordResetConfirmSchema.parse(request.body);
      return reply.send(await auth.confirmPasswordReset(body.token, body.password));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/auth/me`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      return reply.send(await auth.me(user.id));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/2fa/setup`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      return reply.send(await auth.setup2fa(user.id));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/2fa/enable`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const body = enable2faSchema.parse(request.body);
      return reply.send(await auth.enable2fa(user.id, body.code));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/auth/2fa/disable`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const body = verify2faSchema.parse(request.body);
      return reply.send(await auth.disable2fa(user.id, body.code));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/auth/devices`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      return reply.send(await auth.listDevices(user.id));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.delete(`${env.apiPrefix}/auth/devices/:deviceId`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { deviceId } = request.params as { deviceId: string };
      return reply.send(await auth.revokeDevice(user.id, deviceId));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // OAuth start hooks (redirect URLs for Google / Microsoft)
  app.get(`${env.apiPrefix}/auth/oauth/google`, async (request, reply) => {
    if (!env.google.clientId) {
      return reply.status(501).send({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Google OAuth not configured' } });
    }
    const q = request.query as { return_to?: string };
    const returnTo = resolveOAuthReturnTo(q.return_to);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.google.clientId);
    url.searchParams.set('redirect_uri', env.google.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', encodeOAuthState(returnTo));
    return reply.redirect(url.toString());
  });

  app.get(`${env.apiPrefix}/auth/oauth/google/callback`, async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) throw new ValidationError('Missing code');
      const returnTo = decodeOAuthState(state);
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.google.clientId,
          client_secret: env.google.clientSecret,
          redirect_uri: env.google.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
      };
      if (!tokenJson.access_token) throw new ValidationError('OAuth token exchange failed');
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const profile = (await profileRes.json()) as {
        sub: string;
        email: string;
        given_name?: string;
        family_name?: string;
      };
      const session = await auth.upsertOAuthUser({
        provider: 'google',
        providerUserId: profile.sub,
        email: profile.email,
        firstName: profile.given_name ?? 'User',
        lastName: profile.family_name ?? '',
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
      });
      reply.setCookie('refreshToken', session.refreshToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure,
      });
      return reply.redirect(`${returnTo}/oauth/callback#access_token=${session.accessToken}`);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/auth/oauth/microsoft`, async (request, reply) => {
    if (!env.microsoft.clientId) {
      return reply.status(501).send({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Microsoft OAuth not configured' } });
    }
    const q = request.query as { return_to?: string };
    const returnTo = resolveOAuthReturnTo(q.return_to);
    const url = new URL(
      `https://login.microsoftonline.com/${env.microsoft.tenantId}/oauth2/v2.0/authorize`,
    );
    url.searchParams.set('client_id', env.microsoft.clientId);
    url.searchParams.set('redirect_uri', env.microsoft.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile offline_access');
    url.searchParams.set('state', encodeOAuthState(returnTo));
    return reply.redirect(url.toString());
  });

  app.get(`${env.apiPrefix}/auth/oauth/microsoft/callback`, async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) throw new ValidationError('Missing code');
      const returnTo = decodeOAuthState(state);
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${env.microsoft.tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.microsoft.clientId,
            client_secret: env.microsoft.clientSecret,
            redirect_uri: env.microsoft.callbackUrl,
            grant_type: 'authorization_code',
          }),
        },
      );
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!tokenJson.access_token) throw new ValidationError('OAuth token exchange failed');
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const profile = (await profileRes.json()) as {
        id: string;
        mail?: string;
        userPrincipalName?: string;
        givenName?: string;
        surname?: string;
      };
      const email = profile.mail ?? profile.userPrincipalName;
      if (!email) throw new ValidationError('Email missing from Microsoft profile');
      const session = await auth.upsertOAuthUser({
        provider: 'microsoft',
        providerUserId: profile.id,
        email,
        firstName: profile.givenName ?? 'User',
        lastName: profile.surname ?? '',
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
      });
      reply.setCookie('refreshToken', session.refreshToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure,
      });
      return reply.redirect(`${returnTo}/oauth/callback#access_token=${session.accessToken}`);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // LDAP / SAML readiness hooks
  app.get(`${env.apiPrefix}/auth/sso/providers`, async (_request, reply) => {
    return reply.send({
      google: Boolean(env.google.clientId),
      microsoft: Boolean(env.microsoft.clientId),
      ldap: process.env.LDAP_ENABLED === 'true',
      saml: process.env.SAML_ENABLED === 'true',
    });
  });

  app.get(
    `${env.apiPrefix}/users`,
    { preHandler: [requirePermission(PERMISSIONS.USERS_READ)] },
    async (request, reply) => {
      try {
        requireAuth(request);
        const q = request.query as { page?: string; pageSize?: string; search?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 20);
        const where = q.search
          ? {
              OR: [
                { email: { contains: q.search } },
                { firstName: { contains: q.search } },
                { lastName: { contains: q.search } },
              ],
              deletedAt: null,
            }
          : { deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.user.count({ where }),
          app.prisma.user.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              createdAt: true,
              roles: { include: { role: true } },
            },
          }),
        ]);
        return reply.send({
          data: data.map((u) => ({
            ...u,
            roles: u.roles.map((r) => r.role.code),
          })),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/users`,
    { preHandler: [requirePermission(PERMISSIONS.USERS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            email: z.string().email(),
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            roleCodes: z.array(z.string()).default(['CANDIDATE']),
            password: z.string().min(12),
          })
          .parse(request.body);
        const passwordHash = await (await import('argon2')).default.hash(body.password, {
          type: (await import('argon2')).default.argon2id,
        });
        const candidate = await app.prisma.candidate.create({ data: {} });
        const user = await app.prisma.user.create({
          data: {
            email: body.email.toLowerCase(),
            firstName: body.firstName,
            lastName: body.lastName,
            passwordHash,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            candidateId: candidate.id,
          },
        });
        const roles = await app.prisma.role.findMany({ where: { code: { in: body.roleCodes } } });
        await app.prisma.userRole.createMany({
          data: roles.map((r) => ({ userId: user.id, roleId: r.id })),
        });
        return reply.status(201).send({ id: user.id, email: user.email });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}

function resolveOAuthReturnTo(returnTo?: string): string {
  if (returnTo && env.corsOrigins.includes(returnTo.replace(/\/$/, ''))) {
    return returnTo.replace(/\/$/, '');
  }
  if (returnTo) {
    try {
      const origin = new URL(returnTo).origin;
      if (env.corsOrigins.includes(origin)) return origin;
    } catch {
      // ignore invalid URL
    }
  }
  return env.webAdminUrl;
}

function encodeOAuthState(returnTo: string): string {
  return Buffer.from(JSON.stringify({ returnTo }), 'utf8').toString('base64url');
}

function decodeOAuthState(state?: string): string {
  if (!state) return env.webAdminUrl;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      returnTo?: string;
    };
    return resolveOAuthReturnTo(parsed.returnTo);
  } catch {
    return env.webAdminUrl;
  }
}
