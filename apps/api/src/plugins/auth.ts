import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import type { AuthUser } from '../shared/auth-guards.js';

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fjwt, {
    secret: env.jwtAccessSecret,
    sign: { expiresIn: env.jwtAccessTtl },
  });

  app.decorate(
    'authenticate',
    async (request: FastifyRequest) => {
      await request.jwtVerify();
      const payload = request.user as unknown as {
        sub?: string;
        id?: string;
        email: string;
        permissions?: string[];
        roles?: string[];
      };
      request.user = {
        id: payload.sub ?? payload.id ?? '',
        email: payload.email,
        permissions: payload.permissions ?? [],
        roles: payload.roles ?? [],
      } satisfies AuthUser;
    },
  );

  app.addHook('preHandler', async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    try {
      await app.authenticate(request);
    } catch {
      // Leave unauthenticated; route guards enforce when needed
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}
