import type { FastifyInstance } from 'fastify';

export async function audit(
  app: FastifyInstance,
  input: {
    actorId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: unknown;
  },
) {
  await app.prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata as object | undefined,
    },
  });
}
