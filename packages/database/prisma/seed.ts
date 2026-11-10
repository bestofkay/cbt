import argon2 from 'argon2';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Permission, type Role } from '@prisma/client';
import { PERMISSIONS, ROLE_CODES } from '@cbt/shared';
import { DEMO_CERT_VERIFY_CODE, DEMO_PASSWORD, seedDemoData } from './seed-demo-data.js';

function loadRootEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadRootEnv();

const prisma = new PrismaClient();

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  [ROLE_CODES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLE_CODES.ADMIN]: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.FEATURE_FLAGS_WRITE),
  [ROLE_CODES.EXAM_MANAGER]: [
    PERMISSIONS.EXAMS_READ,
    PERMISSIONS.EXAMS_WRITE,
    PERMISSIONS.EXAMS_PUBLISH,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.SESSIONS_WRITE,
    PERMISSIONS.ATTEMPTS_READ,
    PERMISSIONS.ATTEMPTS_GRADE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.RESULTS_EXPORT,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.QUESTIONS_READ,
    PERMISSIONS.BANKS_READ,
    PERMISSIONS.NOTIFICATIONS_WRITE,
  ],
  [ROLE_CODES.QUESTION_REVIEWER]: [
    PERMISSIONS.QUESTIONS_READ,
    PERMISSIONS.QUESTIONS_REVIEW,
    PERMISSIONS.BANKS_READ,
    PERMISSIONS.ATTEMPTS_GRADE,
  ],
  [ROLE_CODES.QUESTION_AUTHOR]: [
    PERMISSIONS.QUESTIONS_READ,
    PERMISSIONS.QUESTIONS_WRITE,
    PERMISSIONS.BANKS_READ,
  ],
  [ROLE_CODES.PROCTOR]: [
    PERMISSIONS.PROCTOR_MONITOR,
    PERMISSIONS.PROCTOR_MANAGE,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.ATTEMPTS_READ,
  ],
  [ROLE_CODES.INVIGILATOR]: [
    PERMISSIONS.PROCTOR_MONITOR,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.ATTEMPTS_READ,
  ],
  [ROLE_CODES.FINANCE]: [PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_WRITE],
  [ROLE_CODES.AUDITOR]: [PERMISSIONS.AUDIT_READ, PERMISSIONS.REPORTS_READ, PERMISSIONS.RESULTS_READ],
  [ROLE_CODES.SUPPORT]: [
    PERMISSIONS.SUPPORT_READ,
    PERMISSIONS.SUPPORT_WRITE,
    PERMISSIONS.USERS_READ,
  ],
  [ROLE_CODES.CANDIDATE]: [PERMISSIONS.ATTEMPTS_TAKE, PERMISSIONS.RESULTS_READ],
};

async function seedPermissions(): Promise<Map<string, Permission>> {
  const map = new Map<string, Permission>();
  for (const code of ALL_PERMISSIONS) {
    const [resource, action] = code.split(':');
    const perm = await prisma.permission.upsert({
      where: { code },
      update: { name: code, resource, action },
      create: { code, name: code, resource, action, description: `Permission ${code}` },
    });
    map.set(code, perm);
  }
  return map;
}

async function seedRoles(
  permissionMap: Map<string, Permission>,
): Promise<Map<string, Role>> {
  const roleMap = new Map<string, Role>();
  for (const [code, perms] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: code.replaceAll('_', ' '), isSystem: true },
      create: {
        code,
        name: code.replaceAll('_', ' '),
        description: `System role ${code}`,
        isSystem: true,
      },
    });
    roleMap.set(code, role);
    for (const permCode of perms) {
      const permission = permissionMap.get(permCode);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  return roleMap;
}

async function main() {
  const permissionMap = await seedPermissions();
  const roleMap = await seedRoles(permissionMap);

  await prisma.language.upsert({
    where: { code: 'en' },
    update: { name: 'English', isDefault: true },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      code: 'en',
      name: 'English',
      isDefault: true,
    },
  });

  await prisma.branding.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      appName: 'CBT Platform',
      primaryColor: '#0F766E',
      secondaryColor: '#134E4A',
      accentColor: '#F59E0B',
      supportEmail: 'support@cbt.local',
    },
  });

  const adminEmail = 'admin@cbt.local';
  const passwordHash = await argon2.hash('ChangeMe!Admin1', { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      displayName: 'System Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const superAdminRole = roleMap.get(ROLE_CODES.SUPER_ADMIN)!;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });

  const templates = [
    {
      code: 'exam_invitation',
      name: 'Exam Invitation',
      subject: 'You are invited to {{examName}}',
      bodyHtml: '<p>Hello {{firstName}}, you are invited to <strong>{{examName}}</strong>.</p>',
      bodyText: 'Hello {{firstName}}, you are invited to {{examName}}.',
    },
    {
      code: 'password_reset',
      name: 'Password Reset',
      subject: 'Reset your password',
      bodyHtml: '<p>Reset link: {{resetUrl}}</p>',
      bodyText: 'Reset link: {{resetUrl}}',
    },
    {
      code: 'email_verification',
      name: 'Email Verification',
      subject: 'Verify your email',
      bodyHtml: '<p>Verify: {{verifyUrl}}</p>',
      bodyText: 'Verify: {{verifyUrl}}',
    },
  ];

  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { code: t.code },
      update: t,
      create: t,
    });
  }

  await prisma.smsTemplate.upsert({
    where: { code: 'otp_login' },
    update: { body: 'Your CBT OTP is {{code}}. Expires in 10 minutes.' },
    create: {
      code: 'otp_login',
      name: 'OTP Login',
      body: 'Your CBT OTP is {{code}}. Expires in 10 minutes.',
    },
  });

  await prisma.featureFlag.upsert({
    where: { key: 'proctoring.enabled' },
    update: { enabled: true },
    create: {
      key: 'proctoring.enabled',
      description: 'Enable proctoring features',
      enabled: true,
    },
  });

  await prisma.platformSettings.upsert({
    where: { key: 'auth' },
    update: {},
    create: {
      key: 'auth',
      value: {
        requireEmailVerification: true,
        maxFailedLogins: 5,
        lockoutMinutes: 30,
        allowGoogleOAuth: true,
        allowMicrosoftOAuth: true,
      },
    },
  });

  const demoPasswordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  await seedDemoData(prisma, roleMap, '00000000-0000-0000-0000-000000000001', admin.id, demoPasswordHash);

  console.log('Seed complete.');
  console.log('');
  console.log('Platform admin:  admin@cbt.local / ChangeMe!Admin1');
  console.log(`Demo accounts:   *@cbt.local / ${DEMO_PASSWORD}`);
  console.log('  manager@cbt.local   — Exam manager');
  console.log('  author@cbt.local    — Question author');
  console.log('  reviewer@cbt.local  — Question reviewer');
  console.log('  proctor@cbt.local   — Proctor (live monitor demo)');
  console.log('  finance@cbt.local   — Finance');
  console.log('  support@cbt.local   — Support');
  console.log('  candidate1@cbt.local — Passed exam + certificate');
  console.log('  candidate2@cbt.local — In-progress proctored attempt');
  console.log('  candidate3@cbt.local — Essay pending manual grading');
  console.log(`Certificate verify code: ${DEMO_CERT_VERIFY_CODE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
