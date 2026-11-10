import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ForbiddenError, UnauthorizedError, type PermissionCode } from '@cbt/shared';

export interface AuthUser {
  id: string;
  email: string;
  permissions: string[];
  roles: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      id?: string;
      email: string;
      permissions: string[];
      roles: string[];
    };
    user: AuthUser;
  }
}

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user?.id) throw new UnauthorizedError();
  return request.user as AuthUser;
}

export function requirePermission(...needed: PermissionCode[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = requireAuth(request);
    const ok = needed.every((p) => user.permissions.includes(p));
    if (!ok) throw new ForbiddenError('Missing required permission');
  };
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
  }
  console.error(error);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: null },
  });
}
