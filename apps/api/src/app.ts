import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { AppError } from '@cbt/shared';
import { env } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { runtimePlugin } from './plugins/runtime.js';
import { authPlugin } from './plugins/auth.js';
import { registerMailer } from './plugins/mailer.js';
import { identityRoutes } from './modules/identity/interfaces/routes.js';
import { questionRoutes } from './modules/questions/interfaces/routes.js';
import { examRoutes } from './modules/exams/interfaces/routes.js';
import { proctoringRoutes } from './modules/proctoring/interfaces/routes.js';
import { reportingRoutes } from './modules/reporting/interfaces/routes.js';
import { notificationRoutes } from './modules/notifications/interfaces/routes.js';
import { platformRoutes } from './modules/platform/interfaces/routes.js';
import { billingRoutes } from './modules/billing/interfaces/routes.js';
import { supportRoutes } from './modules/support/interfaces/routes.js';
import { compatRoutes } from './modules/compat/routes.js';
import { enterpriseRoutes } from './modules/enterprise/interfaces/routes.js';
import { websocketRoutes } from './ws/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.logLevel,
      transport:
        env.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.isProd,
  });
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.rateLimitMax,
    timeWindow: env.rateLimitWindowMs,
  });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  await app.register(websocket);

  if (env.enableApiDocs) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'CBT Platform API',
          description: 'Enterprise Computer Based Test Platform REST API',
          version: '1.0.0',
        },
        servers: [{ url: env.appUrl }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  await app.register(prismaPlugin);
  await app.register(runtimePlugin);
  await app.register(authPlugin);
  await registerMailer(app);

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  app.get('/ready', async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { status: 'ready', runtime: 'in-memory' };
    } catch (e) {
      return reply.status(503).send({ status: 'not_ready', error: String(e) });
    }
  });
  app.get('/metrics', async (_request, reply) => {
    // Prometheus text exposition (basic)
    const metrics = [
      '# HELP cbt_up 1 if process is up',
      '# TYPE cbt_up gauge',
      'cbt_up 1',
    ].join('\n');
    reply.header('content-type', 'text/plain');
    return metrics;
  });

  await identityRoutes(app);
  await questionRoutes(app);
  await examRoutes(app);
  await proctoringRoutes(app);
  await reportingRoutes(app);
  await notificationRoutes(app);
  await platformRoutes(app);
  await billingRoutes(app);
  await supportRoutes(app);
  await compatRoutes(app);
  await enterpriseRoutes(app);
  await websocketRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details ?? null },
      });
    }
    const err = error as { validation?: unknown; message?: string };
    if (err.validation) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message ?? 'Validation failed',
          details: err.validation,
        },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: null },
    });
  });

  return app;
}
