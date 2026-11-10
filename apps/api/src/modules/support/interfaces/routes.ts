import type { FastifyInstance } from 'fastify';
import { PERMISSIONS, NotFoundError, ForbiddenError } from '@cbt/shared';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { mapTicket } from '../../../shared/dto.js';
import { z } from 'zod';

export async function supportRoutes(app: FastifyInstance) {
  app.get(`${env.apiPrefix}/support/tickets`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const isStaff = user.permissions.includes(PERMISSIONS.SUPPORT_READ);
      const q = request.query as { page?: string; pageSize?: string };
      const page = Number(q.page ?? 1);
      const pageSize = Number(q.pageSize ?? 50);
      const where = isStaff ? {} : { requesterId: user.id };
      const [total, data] = await Promise.all([
        app.prisma.supportTicket.count({ where }),
        app.prisma.supportTicket.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            requester: { select: { id: true, email: true, firstName: true, lastName: true } },
            assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
      return reply.send({
        data: data.map(mapTicket),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
      });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/support/tickets`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const body = z
        .object({
          subject: z.string().min(1).max(250),
          body: z.string().min(1),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
          category: z.string().optional(),
        })
        .parse(request.body);
      const number = `TCK-${Date.now()}`;
      const ticket = await app.prisma.supportTicket.create({
        data: {
          number,
          requesterId: user.id,
          subject: body.subject,
          priority: body.priority,
          category: body.category,
          messages: {
            create: {
              authorId: user.id,
              body: body.body,
            },
          },
        },
        include: { messages: true },
      });
      return reply.status(201).send(ticket);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/support/tickets/:id`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const ticket = await app.prisma.supportTicket.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
        },
      });
      if (!ticket) throw new NotFoundError('Ticket');
      const isStaff = user.permissions.includes(PERMISSIONS.SUPPORT_READ);
      if (!isStaff && ticket.requesterId !== user.id) throw new ForbiddenError();
      return reply.send(ticket);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/support/tickets/:id/messages`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z
        .object({ body: z.string().min(1), isInternal: z.boolean().default(false) })
        .parse(request.body);
      const ticket = await app.prisma.supportTicket.findUnique({ where: { id } });
      if (!ticket) throw new NotFoundError('Ticket');
      const isStaff = user.permissions.includes(PERMISSIONS.SUPPORT_WRITE);
      if (!isStaff && ticket.requesterId !== user.id) throw new ForbiddenError();
      if (body.isInternal && !isStaff) throw new ForbiddenError();

      const message = await app.prisma.supportMessage.create({
        data: {
          ticketId: id,
          authorId: user.id,
          body: body.body,
          isInternal: body.isInternal,
        },
      });
      await app.prisma.supportTicket.update({
        where: { id },
        data: { status: isStaff ? 'IN_PROGRESS' : 'WAITING', updatedAt: new Date() },
      });
      return reply.status(201).send(message);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.patch(
    `${env.apiPrefix}/support/tickets/:id`,
    { preHandler: [requirePermission(PERMISSIONS.SUPPORT_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = z
          .object({
            status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
            assigneeId: z.string().uuid().nullable().optional(),
          })
          .parse(request.body);
        const ticket = await app.prisma.supportTicket.update({
          where: { id },
          data: {
            ...body,
            closedAt:
              body.status === 'CLOSED' || body.status === 'RESOLVED' ? new Date() : undefined,
          },
        });
        await app.prisma.activityStream.create({
          data: {
            userId: user.id,
            verb: 'updated',
            objectType: 'support_ticket',
            objectId: id,
            summary: `Ticket ${ticket.number} updated`,
            metadata: body,
          },
        });
        return reply.send(ticket);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
