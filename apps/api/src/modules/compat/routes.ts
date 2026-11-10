import type { FastifyInstance } from 'fastify';
import { UnauthorizedError, ValidationError, PERMISSIONS } from '@cbt/shared';
import { assertPasswordPolicy } from '@cbt/domain';
import { requireAuth, requirePermission, sendError } from '../../shared/auth-guards.js';
import { env } from '../../config/env.js';
import {
  mapAttemptForCandidate,
  mapBank,
  mapBranding,
  mapDashboardStats,
  mapExamSession,
  mapExamTemplate,
  mapInvoice,
  mapProctorLive,
  mapQuestionDetail,
  mapResult,
  mapUserListItem,
} from '../../shared/dto.js';
import { z } from 'zod';
import { createQuestionSchema } from '@cbt/shared';

/**
 * Compatibility + DTO-normalized routes so frontends and canonical APIs align.
 * Also registers path aliases expected by the three web apps.
 */
export async function compatRoutes(app: FastifyInstance) {
  // Path aliases are implemented as first-class handlers below (not inject proxies).

  app.get(
    `${env.apiPrefix}/admin/dashboard/stats`,
    { preHandler: [requirePermission(PERMISSIONS.REPORTS_READ)] },
    async (_request, reply) => {
      try {
        const [users, questions, exams, attempts, liveAttempts] = await Promise.all([
          app.prisma.user.count({ where: { deletedAt: null } }),
          app.prisma.question.count({ where: { deletedAt: null } }),
          app.prisma.examTemplate.count({ where: { deletedAt: null } }),
          app.prisma.examAttempt.count(),
          app.prisma.examAttempt.count({ where: { status: 'IN_PROGRESS' } }),
        ]);
        return reply.send(
          mapDashboardStats({ users, questions, exams, attempts, liveAttempts }),
        );
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/admin/users`,
    { preHandler: [requirePermission(PERMISSIONS.USERS_READ)] },
    async (request, reply) => {
      try {
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
              candidateId: true,
              roles: { include: { role: true } },
            },
          }),
        ]);
        return reply.send({
          data: data.map((u) =>
            mapUserListItem({
              ...u,
              roles: u.roles.map((r) => r.role.code),
            }),
          ),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/admin/users`,
    { preHandler: [requirePermission(PERMISSIONS.USERS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            email: z.string().email(),
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            role: z.string().optional(),
            roleCodes: z.array(z.string()).optional(),
            password: z.string().min(12),
          })
          .parse(request.body);
        assertPasswordPolicy(body.password);
        const roleCodes = body.roleCodes ?? (body.role ? [body.role] : ['CANDIDATE']);
        const argon2 = (await import('argon2')).default;
        const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
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
        const roles = await app.prisma.role.findMany({ where: { code: { in: roleCodes } } });
        await app.prisma.userRole.createMany({
          data: roles.map((r) => ({ userId: user.id, roleId: r.id })),
        });
        return reply.status(201).send({ id: user.id, email: user.email, role: roleCodes[0] });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/question-banks`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_READ)] },
    async (request, reply) => {
      try {
        const q = request.query as { page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 20);
        const where = { deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.questionBank.count({ where }),
          app.prisma.questionBank.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { questions: true } }, category: true },
          }),
        ]);
        return reply.send({
          data: data.map(mapBank),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/question-banks`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            name: z.string().min(1),
            code: z.string().min(1),
            description: z.string().optional(),
            categoryId: z.string().uuid().optional(),
          })
          .parse(request.body);
        const bank = await app.prisma.questionBank.create({ data: body });
        return reply.status(201).send(mapBank({ ...bank, _count: { questions: 0 } }));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/question-banks/:id`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_READ)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const bank = await app.prisma.questionBank.findFirst({
          where: { id, deletedAt: null },
          include: {
            topics: true,
            questions: {
              where: { deletedAt: null },
              take: 100,
              orderBy: { updatedAt: 'desc' },
              include: {
                versions: { orderBy: { version: 'desc' }, take: 1 },
                tags: { include: { tag: true } },
              },
            },
            _count: { select: { questions: true } },
            category: true,
          },
        });
        if (!bank) throw new ValidationError('Question bank not found');
        return reply.send(mapBank(bank));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.put(
    `${env.apiPrefix}/questions/:id`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = createQuestionSchema.partial().extend({
          version: createQuestionSchema.shape.version.optional(),
        }).parse(request.body);

        const existing = await app.prisma.question.findFirst({ where: { id, deletedAt: null } });
        if (!existing) throw new ValidationError('Question not found');

        await app.prisma.question.update({
          where: { id },
          data: {
            ...(body.difficulty ? { difficulty: body.difficulty } : {}),
            ...(body.pointsDefault != null ? { pointsDefault: body.pointsDefault } : {}),
            ...(body.negativeMarking != null ? { negativeMarking: body.negativeMarking } : {}),
            ...(body.partialScoring != null ? { partialScoring: body.partialScoring } : {}),
            ...(body.topicId ? { topicId: body.topicId } : {}),
          },
        });

        if (body.version) {
          const nextVersion = existing.currentVersion + 1;
          const v = await app.prisma.questionVersion.create({
            data: {
              questionId: id,
              version: nextVersion,
              languageId: body.version.languageId,
              stem: body.version.stem,
              stemFormat: body.version.stemFormat,
              latexBlocks: body.version.latexBlocks,
              hints: body.version.hints,
              solution: body.version.solution,
              solutionFormat: body.version.solutionFormat,
              autoGradeConfig: body.version.autoGradeConfig as object | undefined,
              status: 'DRAFT',
              changeSummary: `Updated by ${user.email}`,
            },
          });
          if (body.version.choices?.length) {
            await app.prisma.choice.createMany({
              data: body.version.choices.map((c) => ({
                questionVersionId: v.id,
                label: c.label,
                content: c.content,
                contentFormat: c.contentFormat,
                isCorrect: c.isCorrect,
                weight: c.weight,
                sortOrder: c.sortOrder,
                matchKey: c.matchKey,
              })),
            });
          }
          await app.prisma.question.update({
            where: { id },
            data: { currentVersion: nextVersion, status: 'DRAFT' },
          });
        }

        const question = await app.prisma.question.findUniqueOrThrow({
          where: { id },
          include: {
            versions: { orderBy: { version: 'desc' }, include: { choices: true } },
            tags: { include: { tag: true } },
          },
        });
        return reply.send(mapQuestionDetail(question));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/exams/templates`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_READ)] },
    async (request, reply) => {
      try {
        const q = request.query as { page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 20);
        const where = { deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.examTemplate.count({ where }),
          app.prisma.examTemplate.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { updatedAt: 'desc' },
            include: { sections: true, _count: { select: { sessions: true } } },
          }),
        ]);
        return reply.send({
          data: data.map(mapExamTemplate),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/exams/templates`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            code: z.string().min(1),
            title: z.string().min(1),
            description: z.string().optional(),
            durationMinutes: z.number().int().positive(),
            mode: z.enum(['PRACTICE', 'MOCK', 'REAL', 'LIVE']).default('REAL'),
            passingScore: z.number().default(50),
            maxAttempts: z.number().int().positive().default(1),
          })
          .parse(request.body);
        const exam = await app.prisma.examTemplate.create({ data: body });
        return reply.status(201).send(mapExamTemplate({ ...exam, _count: { sessions: 0 } }));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/exams/sessions`,
    { preHandler: [requirePermission(PERMISSIONS.SESSIONS_READ)] },
    async (request, reply) => {
      try {
        const q = request.query as { page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 20);
        const [total, data] = await Promise.all([
          app.prisma.examSession.count(),
          app.prisma.examSession.findMany({
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { startsAt: 'desc' },
            include: {
              examTemplate: {
                select: { id: true, title: true, code: true, durationMinutes: true, accessType: true },
              },
              _count: { select: { attempts: true, invitations: true } },
            },
          }),
        ]);
        return reply.send({
          data: data.map(mapExamSession),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/admin/results`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const isStaff =
        user.roles.some((r) =>
          ['SUPER_ADMIN', 'ADMIN', 'EXAM_MANAGER', 'AUDITOR'].includes(r),
        ) || user.permissions.includes(PERMISSIONS.RESULTS_EXPORT);
      const q = request.query as { page?: string; pageSize?: string };
      const page = Number(q.page ?? 1);
      const pageSize = Number(q.pageSize ?? 50);
      const where = isStaff ? {} : { attempt: { userId: user.id } };
      const [total, data] = await Promise.all([
        app.prisma.result.count({ where }),
        app.prisma.result.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { gradedAt: 'desc' },
          include: {
            attempt: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                examSession: { include: { examTemplate: { select: { title: true, code: true } } } },
              },
            },
            certificate: true,
          },
        }),
      ]);
      return reply.send({
        data: data.map(mapResult),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
      });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(
    `${env.apiPrefix}/billing/invoices`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_READ)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const isFinance = user.permissions.includes(PERMISSIONS.BILLING_WRITE);
        const q = request.query as { page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 50);
        const where = isFinance ? {} : { userId: user.id };
        const [total, data] = await Promise.all([
          app.prisma.invoice.count({ where }),
          app.prisma.invoice.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              lines: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        return reply.send({
          data: data.map(mapInvoice),
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/settings/branding`, async (_request, reply) => {
    const branding = await app.prisma.branding.findFirst();
    return reply.send(branding ? mapBranding(branding) : null);
  });

  app.put(
    `${env.apiPrefix}/settings/branding`,
    { preHandler: [requirePermission(PERMISSIONS.SETTINGS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            platformName: z.string().optional(),
            appName: z.string().optional(),
            logoUrl: z.string().nullable().optional(),
            faviconUrl: z.string().nullable().optional(),
            primaryColor: z.string().optional(),
            secondaryColor: z.string().optional(),
            accentColor: z.string().optional(),
            loginBackground: z.string().nullable().optional(),
            customCss: z.string().nullable().optional(),
            supportEmail: z.string().email().nullable().optional(),
            supportUrl: z.string().nullable().optional(),
          })
          .parse(request.body);
        const data = {
          ...body,
          appName: body.appName ?? body.platformName,
        };
        delete (data as { platformName?: string }).platformName;
        const branding = await app.prisma.branding.upsert({
          where: { id: '00000000-0000-0000-0000-000000000001' },
          update: data,
          create: {
            id: '00000000-0000-0000-0000-000000000001',
            appName: data.appName ?? body.platformName ?? 'CBT Platform',
            logoUrl: data.logoUrl ?? null,
            faviconUrl: data.faviconUrl ?? null,
            primaryColor: data.primaryColor ?? '#0F766E',
            secondaryColor: data.secondaryColor ?? '#134E4A',
            accentColor: data.accentColor ?? '#F59E0B',
            loginBackground: data.loginBackground ?? null,
            customCss: data.customCss ?? null,
            supportEmail: data.supportEmail ?? null,
            supportUrl: data.supportUrl ?? null,
          },
        });
        return reply.send(mapBranding(branding));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/candidate/sessions`, async (request, reply) => {
    try {
      requireAuth(request);
      const now = new Date();
      const sessions = await app.prisma.examSession.findMany({
        where: {
          status: { in: ['PUBLISHED', 'LIVE'] },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        include: {
          examTemplate: {
            select: {
              id: true,
              title: true,
              code: true,
              durationMinutes: true,
              accessType: true,
            },
          },
          _count: { select: { attempts: true, invitations: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 50,
      });
      return reply.send({ data: sessions.map(mapExamSession) });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/candidate/results`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const q = request.query as { page?: string; pageSize?: string };
      const page = Number(q.page ?? 1);
      const pageSize = Number(q.pageSize ?? 50);
      const where = { attempt: { userId: user.id } };
      const [total, data] = await Promise.all([
        app.prisma.result.count({ where }),
        app.prisma.result.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { gradedAt: 'desc' },
          include: {
            attempt: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                examSession: { include: { examTemplate: { select: { title: true, code: true } } } },
              },
            },
            certificate: true,
          },
        }),
      ]);
      return reply.send({
        data: data.map(mapResult),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
      });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/candidate/results/:id`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const result = await app.prisma.result.findUnique({
        where: { id },
        include: {
          attempt: {
            include: {
              user: { select: { email: true, firstName: true, lastName: true } },
              examSession: { include: { examTemplate: { select: { title: true, code: true } } } },
            },
          },
          certificate: true,
        },
      });
      if (!result || result.attempt.userId !== user.id) {
        throw new UnauthorizedError('Result not found');
      }
      return reply.send(mapResult(result));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.patch(`${env.apiPrefix}/attempts/:id/navigate`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z.object({ questionId: z.string().uuid() }).parse(request.body);
      const attempt = await app.prisma.examAttempt.findUnique({ where: { id } });
      if (!attempt || attempt.userId !== user.id) throw new UnauthorizedError();
      const meta = (attempt.metadata as Record<string, unknown>) ?? {};
      await app.prisma.examAttempt.update({
        where: { id },
        data: {
          metadata: { ...meta, currentQuestionId: body.questionId },
          lastActivityAt: new Date(),
        },
      });
      return reply.send(await mapAttemptForCandidate(app, id));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // Singular aliases used by candidate UI
  app.post(`${env.apiPrefix}/attempts/:id/bookmark`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z.object({ questionId: z.string().uuid(), note: z.string().optional() }).parse(request.body);
      const attempt = await app.prisma.examAttempt.findUniqueOrThrow({ where: { id } });
      if (attempt.userId !== user.id) throw new UnauthorizedError();
      const bookmark = await app.prisma.bookmark.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: body.questionId } },
        create: { attemptId: id, questionId: body.questionId, note: body.note },
        update: { note: body.note },
      });
      return reply.send(bookmark);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/attempts/:id/flag`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z.object({ questionId: z.string().uuid(), reason: z.string().optional() }).parse(request.body);
      const attempt = await app.prisma.examAttempt.findUniqueOrThrow({ where: { id } });
      if (attempt.userId !== user.id) throw new UnauthorizedError();
      const flag = await app.prisma.flag.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: body.questionId } },
        create: { attemptId: id, questionId: body.questionId, reason: body.reason },
        update: { reason: body.reason },
      });
      return reply.send(flag);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(
    `${env.apiPrefix}/proctor/sessions`,
    { preHandler: [requirePermission(PERMISSIONS.PROCTOR_MONITOR)] },
    async (_request, reply) => {
      try {
        const sessions = await app.prisma.proctorSession.findMany({
          where: { status: 'ACTIVE' },
          include: {
            attempt: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                examSession: { select: { id: true, name: true } },
              },
            },
            flags: { where: { resolvedAt: null }, take: 5 },
            _count: { select: { events: true } },
          },
          orderBy: { cheatingScore: 'desc' },
          take: 200,
        });

        // Group by exam session for UI
        const byExam = new Map<
          string,
          {
            id: string;
            name: string;
            examTitle: string;
            activeCandidates: number;
            flaggedCandidates: number;
            candidates: ReturnType<typeof mapProctorLive>[];
          }
        >();
        for (const s of sessions) {
          const mapped = mapProctorLive(s);
          const key = mapped.examSessionId;
          const cur = byExam.get(key) ?? {
            id: key,
            name: mapped.examTitle,
            examTitle: mapped.examTitle,
            activeCandidates: 0,
            flaggedCandidates: 0,
            candidates: [],
          };
          cur.activeCandidates += 1;
          if (mapped.flags.length) cur.flaggedCandidates += 1;
          cur.candidates.push(mapped);
          byExam.set(key, cur);
        }
        return reply.send({ data: [...byExam.values()] });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/proctor/sessions/:sessionId/candidates`,
    { preHandler: [requirePermission(PERMISSIONS.PROCTOR_MONITOR)] },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const sessions = await app.prisma.proctorSession.findMany({
          where: {
            status: 'ACTIVE',
            attempt: { examSessionId: sessionId },
          },
          include: {
            attempt: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                examSession: { select: { id: true, name: true } },
              },
            },
            flags: { where: { resolvedAt: null }, take: 5 },
            _count: { select: { events: true } },
          },
          orderBy: { cheatingScore: 'desc' },
        });
        return reply.send({ data: sessions.map(mapProctorLive) });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // Mapped attempt view for candidates (alias of GET /attempts/:id shape)
  app.get(`${env.apiPrefix}/attempts/:id/view`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const attempt = await app.prisma.examAttempt.findUnique({ where: { id } });
      if (!attempt) throw new ValidationError('Attempt not found');
      if (
        attempt.userId !== user.id &&
        !user.permissions.includes(PERMISSIONS.ATTEMPTS_READ)
      ) {
        throw new UnauthorizedError();
      }
      return reply.send(await mapAttemptForCandidate(app, id));
    } catch (e) {
      return sendError(reply, e);
    }
  });
}
