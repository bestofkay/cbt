import type { FastifyInstance } from 'fastify';
import { PERMISSIONS, NotFoundError } from '@cbt/shared';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { encrypt } from '../../../shared/crypto.js';
import { z } from 'zod';

export async function notificationRoutes(app: FastifyInstance) {
  app.get(`${env.apiPrefix}/notifications`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const data = await app.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return reply.send({ data });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(
    `${env.apiPrefix}/notifications/send`,
    { preHandler: [requirePermission(PERMISSIONS.NOTIFICATIONS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            userId: z.string().uuid().optional(),
            channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'WEBHOOK', 'SLACK', 'TEAMS', 'IN_APP']),
            subject: z.string().optional(),
            body: z.string().optional(),
            to: z.string().optional(),
            payload: z.unknown().optional(),
            template: z.string().optional(),
          })
          .parse(request.body);

        const notification = await app.prisma.notification.create({
          data: {
            userId: body.userId,
            channel: body.channel,
            subject: body.subject,
            body: body.body,
            payload: body.payload as object | undefined,
            template: body.template,
            status: 'QUEUED',
          },
        });

        await app.queues.notifications.add(body.channel.toLowerCase(), {
          notificationId: notification.id,
          to: body.to,
          subject: body.subject,
          body: body.body,
          html: body.body,
          userId: body.userId,
          payload: body.payload,
          template: body.template,
        });

        return reply.status(202).send(notification);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/email-templates`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_READ)] },
    async (_request, reply) => {
      const data = await app.prisma.emailTemplate.findMany({ orderBy: { code: 'asc' } });
      return reply.send({ data });
    },
  );

  app.get(
    `${env.apiPrefix}/sms-templates`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_READ)] },
    async (_request, reply) => {
      const data = await app.prisma.smsTemplate.findMany({ orderBy: { code: 'asc' } });
      return reply.send({ data });
    },
  );

  app.get(
    `${env.apiPrefix}/webhooks`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_READ)] },
    async (_request, reply) => {
      const data = await app.prisma.webhook.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ data });
    },
  );

  app.post(
    `${env.apiPrefix}/webhooks`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            name: z.string().min(1),
            url: z.string().url(),
            secret: z.string().optional(),
            events: z.array(z.string()).min(1),
          })
          .parse(request.body);
        const webhook = await app.prisma.webhook.create({
          data: {
            name: body.name,
            url: body.url,
            secretEnc: body.secret ? encrypt(body.secret) : null,
            events: body.events,
          },
        });
        return reply.status(201).send(webhook);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/announcements`, async (request, reply) => {
    try {
      const q = request.query as { examSessionId?: string };
      const now = new Date();
      const data = await app.prisma.announcement.findMany({
        where: {
          ...(q.examSessionId ? { examSessionId: q.examSessionId } : {}),
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      });
      return reply.send({ data });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(
    `${env.apiPrefix}/announcements`,
    { preHandler: [requirePermission(PERMISSIONS.NOTIFICATIONS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const body = z
          .object({
            examSessionId: z.string().uuid().optional(),
            title: z.string().min(1),
            body: z.string().min(1),
            priority: z.number().int().default(0),
            endsAt: z.string().datetime().optional(),
          })
          .parse(request.body);
        const announcement = await app.prisma.announcement.create({
          data: {
            examSessionId: body.examSessionId,
            title: body.title,
            body: body.body,
            priority: body.priority,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            createdById: user.id,
          },
        });
        if (body.examSessionId) {
          await app.redis.publish(
            `announce:${body.examSessionId}`,
            JSON.stringify(announcement),
          );
        }
        return reply.status(201).send(announcement);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}

export { dispatchNotification } from '../../../jobs/notify.js';

// silence unused import in type-only path
void NotFoundError;
