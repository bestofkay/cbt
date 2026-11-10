const webAdminUrl = process.env.WEB_ADMIN_URL ?? 'http://localhost:5173';
const webCandidateUrl = process.env.WEB_CANDIDATE_URL ?? 'http://localhost:5174';
const webProctorUrl = process.env.WEB_PROCTOR_URL ?? 'http://localhost:5175';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

const WEAK_SECRETS = [
  'dev-access-secret-change-me-32chars!',
  'dev-refresh-secret-change-me-32chars',
  'change-me-access-secret-min-32-chars!!',
  'change-me-refresh-secret-min-32-chars!',
  'ci-access-secret-change-me-32chars!',
  'ci-refresh-secret-change-me-32chars',
];

function requireStrongSecret(name: string, value: string | undefined, minLen = 32): string {
  if (!value || value.length < minLen) {
    throw new Error(`${name} must be set and at least ${minLen} characters`);
  }
  if (WEAK_SECRETS.includes(value) || value.includes('change-me')) {
    throw new Error(`${name} must not use a default/dev placeholder value`);
  }
  return value;
}

function requireProdEncryptionKey(value: string | undefined): string {
  const fallback = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (!value || value === fallback || value.length !== 64 || !/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error('ENCRYPTION_KEY must be a unique 64-char hex string in production');
  }
  return value;
}

/** Validates secrets when NODE_ENV=production. Call once at process start. */
export function assertProductionConfig() {
  if (!isProd) return;
  requireStrongSecret('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET);
  requireStrongSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
  requireProdEncryptionKey(process.env.ENCRYPTION_KEY);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (process.env.COOKIE_SECURE !== 'true' && process.env.ALLOW_INSECURE_COOKIES !== 'true') {
    throw new Error('COOKIE_SECURE=true is required in production (or set ALLOW_INSECURE_COOKIES=true behind TLS terminator awareness)');
  }
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  /** Default public portal for email links (verify); prefer candidate app */
  appUrl: process.env.APP_URL ?? webCandidateUrl,
  webAdminUrl,
  webCandidateUrl,
  webProctorUrl,
  databaseUrl: process.env.DATABASE_URL ?? 'mysql://cbt:cbt_secret@localhost:3306/cbt',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32chars!',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-32chars',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || (isProd && process.env.ALLOW_INSECURE_COOKIES !== 'true'),
  cookieDomain: process.env.COOKIE_DOMAIN ?? (isProd ? undefined : 'localhost'),
  corsOrigins: [webAdminUrl, webCandidateUrl, webProctorUrl] as string[],
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'noreply@cbt.local',
    secure: process.env.SMTP_SECURE === 'true',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.STORAGE_BUCKET ?? 'cbt-assets',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:4000/api/v1/auth/oauth/google/callback',
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
    callbackUrl:
      process.env.MICROSOFT_CALLBACK_URL ??
      'http://localhost:4000/api/v1/auth/oauth/microsoft/callback',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  allowSimulatedPayments: process.env.ALLOW_SIMULATED_PAYMENTS === 'true' || !isProd,
  enableApiDocs: process.env.ENABLE_API_DOCS === 'true' || !isProd,
  encryptionKey:
    process.env.ENCRYPTION_KEY ??
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 200),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  logLevel: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'info'),
};
