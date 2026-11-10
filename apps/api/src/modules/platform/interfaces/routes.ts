import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '@cbt/shared';
import { requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { z } from 'zod';

import { mapBranding } from '../../../shared/dto.js';

export async function platformRoutes(app: FastifyInstance) {
  app.get(`${env.apiPrefix}/branding`, async (_request, reply) => {
    const branding = await app.prisma.branding.findFirst();
    return reply.send(branding ? mapBranding(branding) : null);
  });

  app.put(
    `${env.apiPrefix}/branding`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            appName: z.string().optional(),
            logoUrl: z.string().url().nullable().optional(),
            faviconUrl: z.string().url().nullable().optional(),
            primaryColor: z.string().optional(),
            secondaryColor: z.string().optional(),
            accentColor: z.string().optional(),
            loginBackground: z.string().nullable().optional(),
            customCss: z.string().nullable().optional(),
            supportEmail: z.string().email().nullable().optional(),
            supportUrl: z.string().url().nullable().optional(),
          })
          .parse(request.body);
        const branding = await app.prisma.branding.upsert({
          where: { id: '00000000-0000-0000-0000-000000000001' },
          update: body,
          create: {
            id: '00000000-0000-0000-0000-000000000001',
            appName: body.appName ?? 'CBT Platform',
            ...body,
          },
        });
        return reply.send(mapBranding(branding));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/settings`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_READ)] },
    async (_request, reply) => {
      const settings = await app.prisma.platformSettings.findMany();
      return reply.send({ data: settings });
    },
  );

  app.put(
    `${env.apiPrefix}/settings/:key`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_WRITE)] },
    async (request, reply) => {
      try {
        const { key } = request.params as { key: string };
        const body = z.object({ value: z.unknown() }).parse(request.body);
        const setting = await app.prisma.platformSettings.upsert({
          where: { key },
          update: { value: body.value as object },
          create: { key, value: body.value as object },
        });
        return reply.send(setting);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/feature-flags`, async (_request, reply) => {
    const flags = await app.prisma.featureFlag.findMany();
    return reply.send({ data: flags });
  });

  app.put(
    `${env.apiPrefix}/feature-flags/:key`,
    { preHandler: [requirePermission(PERMISSIONS.FEATURE_FLAGS_WRITE)] },
    async (request, reply) => {
      try {
        const { key } = request.params as { key: string };
        const body = z
          .object({ enabled: z.boolean(), description: z.string().optional(), rules: z.unknown().optional() })
          .parse(request.body);
        const flag = await app.prisma.featureFlag.upsert({
          where: { key },
          update: {
            enabled: body.enabled,
            description: body.description,
            rules: body.rules as object | undefined,
          },
          create: {
            key,
            enabled: body.enabled,
            description: body.description,
            rules: body.rules as object | undefined,
          },
        });
        return reply.send(flag);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/audit-logs`,
    { preHandler: [requirePermission(PERMISSIONS.AUDIT_READ)] },
    async (request, reply) => {
      try {
        const q = request.query as { page?: string; pageSize?: string; action?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 50);
        const where = q.action ? { action: { contains: q.action } } : {};
        const [total, data] = await Promise.all([
          app.prisma.auditLog.count({ where }),
          app.prisma.auditLog.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
          }),
        ]);
        return reply.send({
          data,
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
