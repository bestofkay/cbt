import type { FastifyInstance } from 'fastify';
import {
  ForbiddenError,
  NotFoundError,
  PERMISSIONS,
  ValidationError,
  buildPaginatedResult,
} from '@cbt/shared';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { mapExamTemplate, mapResult } from '../../../shared/dto.js';
import { aggregateAttemptScore } from '@cbt/domain';
import { z } from 'zod';
import { audit } from '../../../shared/audit.js';

/**
 * Enterprise APIs for review, grading, catalog, RBAC, certificates, profile.
 */
export async function enterpriseRoutes(app: FastifyInstance) {
  // ----- Profile -----
  app.patch(`${env.apiPrefix}/auth/profile`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const body = z
        .object({
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
          phone: z.string().max(30).nullable().optional(),
          locale: z.string().max(10).optional(),
          timezone: z.string().max(64).optional(),
          displayName: z.string().max(200).nullable().optional(),
        })
        .parse(request.body);
      const updated = await app.prisma.user.update({
        where: { id: user.id },
        data: body,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          locale: true,
          timezone: true,
          displayName: true,
          candidateId: true,
        },
      });
      return reply.send(updated);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // ----- Question review queue -----
  app.get(
    `${env.apiPrefix}/reviews/questions`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_REVIEW)] },
    async (request, reply) => {
      try {
        const q = request.query as { status?: string; page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 50);
        const status = (q.status as 'IN_REVIEW' | 'DRAFT' | 'APPROVED' | 'REJECTED') ?? 'IN_REVIEW';
        const where = { status, deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.question.count({ where }),
          app.prisma.question.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { updatedAt: 'desc' },
            include: {
              bank: { select: { id: true, name: true, code: true } },
              author: { select: { id: true, firstName: true, lastName: true, email: true } },
              versions: {
                orderBy: { version: 'desc' },
                take: 1,
                include: { choices: true, language: true },
              },
            },
          }),
        ]);
        return reply.send(buildPaginatedResult(data, total, page, pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- Manual grading -----
  app.get(
    `${env.apiPrefix}/reviews/manual`,
    { preHandler: [requirePermission(PERMISSIONS.ATTEMPTS_GRADE)] },
    async (request, reply) => {
      try {
        const q = request.query as { status?: string; page?: string; pageSize?: string };
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 50);
        const status = q.status ?? 'PENDING';
        const where = { status };
        const [total, data] = await Promise.all([
          app.prisma.manualReviewItem.count({ where }),
          app.prisma.manualReviewItem.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'asc' },
            include: {
              attempt: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                  examSession: {
                    include: { examTemplate: { select: { id: true, title: true, code: true } } },
                  },
                  answers: true,
                },
              },
            },
          }),
        ]);

        const enriched = await Promise.all(
          data.map(async (item) => {
            const answer = item.attempt.answers.find((a) => a.id === item.answerId);
            const question = answer
              ? await app.prisma.question.findUnique({
                  where: { id: answer.questionId },
                  include: {
                    versions: {
                      orderBy: { version: 'desc' },
                      take: 1,
                      include: { choices: true },
                    },
                  },
                })
              : null;
            return {
              id: item.id,
              status: item.status,
              score: item.score,
              feedback: item.feedback,
              createdAt: item.createdAt,
              reviewedAt: item.reviewedAt,
              attemptId: item.attemptId,
              answerId: item.answerId,
              candidateName: `${item.attempt.user.firstName} ${item.attempt.user.lastName}`.trim(),
              candidateEmail: item.attempt.user.email,
              examTitle: item.attempt.examSession.examTemplate.title,
              question: question
                ? {
                    id: question.id,
                    code: question.code,
                    type: question.type,
                    stem: question.versions[0]?.stem ?? '',
                    maxScore: answer ? Number(answer.maxScore) : Number(question.pointsDefault),
                  }
                : null,
              response: answer?.response ?? null,
            };
          }),
        );

        return reply.send(buildPaginatedResult(enriched, total, page, pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/reviews/manual/:id/grade`,
    { preHandler: [requirePermission(PERMISSIONS.ATTEMPTS_GRADE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = z
          .object({
            score: z.number().min(0),
            feedback: z.string().max(5000).optional(),
          })
          .parse(request.body);

        const item = await app.prisma.manualReviewItem.findUnique({
          where: { id },
          include: {
            attempt: {
              include: {
                answers: true,
                examSession: { include: { examTemplate: true } },
              },
            },
          },
        });
        if (!item) throw new NotFoundError('Review item');

        await app.prisma.$transaction([
          app.prisma.manualReviewItem.update({
            where: { id },
            data: {
              status: 'GRADED',
              score: body.score,
              feedback: body.feedback,
              reviewerId: user.id,
              reviewedAt: new Date(),
            },
          }),
          app.prisma.attemptAnswer.update({
            where: { id: item.answerId },
            data: {
              scoreAwarded: body.score,
              needsReview: false,
              isCorrect: body.score > 0,
            },
          }),
        ]);

        // Recompute attempt score
        const answers = await app.prisma.attemptAnswer.findMany({
          where: { attemptId: item.attemptId },
        });
        const score = aggregateAttemptScore(
          answers.map((a) => ({
            maxScore: Number(a.maxScore),
            scoreAwarded: Number(a.scoreAwarded ?? 0),
            isCorrect: a.isCorrect,
          })),
          Number(item.attempt.examSession.examTemplate.passingScore),
        );
        const pending = await app.prisma.manualReviewItem.count({
          where: { attemptId: item.attemptId, status: 'PENDING' },
        });

        await app.prisma.examAttempt.update({
          where: { id: item.attemptId },
          data: {
            scoreRaw: score.totalScore,
            scorePercent: score.percent,
            passed: score.passed,
            status: pending > 0 ? 'UNDER_REVIEW' : 'GRADED',
          },
        });
        await app.prisma.result.upsert({
          where: { attemptId: item.attemptId },
          create: {
            attemptId: item.attemptId,
            totalScore: score.totalScore,
            maxScore: score.maxScore,
            percent: score.percent,
            passed: score.passed,
            gradedById: user.id,
          },
          update: {
            totalScore: score.totalScore,
            maxScore: score.maxScore,
            percent: score.percent,
            passed: score.passed,
            gradedById: user.id,
            gradedAt: new Date(),
          },
        });

        await audit(app, {
          actorId: user.id,
          action: 'manual_review.grade',
          resource: 'manual_review_item',
          resourceId: id,
          metadata: { score: body.score },
        });

        return reply.send({ ok: true, score });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- Exam detail / update -----
  app.get(
    `${env.apiPrefix}/exams/:id`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_READ)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const exam = await app.prisma.examTemplate.findFirst({
          where: { id, deletedAt: null },
          include: {
            sections: { orderBy: { sortOrder: 'asc' } },
            questionRules: { orderBy: { sortOrder: 'asc' }, include: { question: true } },
            category: true,
            _count: { select: { sessions: true } },
            certificateTpl: true,
          },
        });
        if (!exam) throw new NotFoundError('Exam');
        return reply.send({
          ...mapExamTemplate(exam),
          ...exam,
          sections: exam.sections,
          questionRules: exam.questionRules,
          retakePolicy: exam.retakePolicy,
          certificateEnabled: exam.certificateEnabled,
          instructions: exam.instructions,
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.put(
    `${env.apiPrefix}/exams/:id`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_WRITE)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = z
          .object({
            title: z.string().min(1).max(250).optional(),
            description: z.string().nullable().optional(),
            durationMinutes: z.number().int().positive().optional(),
            passingScore: z.number().min(0).max(100).optional(),
            maxAttempts: z.number().int().positive().optional(),
            shuffleQuestions: z.boolean().optional(),
            shuffleChoices: z.boolean().optional(),
            negativeMarking: z.boolean().optional(),
            allowResume: z.boolean().optional(),
            autoSubmit: z.boolean().optional(),
            showResults: z.boolean().optional(),
            certificateEnabled: z.boolean().optional(),
            instructions: z.string().nullable().optional(),
            retakePolicy: z.unknown().optional(),
            gracePeriodSeconds: z.number().int().min(0).optional(),
            lateEntryMinutes: z.number().int().min(0).optional(),
            sections: z
              .array(
                z.object({
                  id: z.string().uuid().optional(),
                  title: z.string().min(1),
                  description: z.string().optional(),
                  sortOrder: z.number().int().default(0),
                  durationMinutes: z.number().int().positive().optional(),
                }),
              )
              .optional(),
            questionRules: z
              .array(
                z.object({
                  id: z.string().uuid().optional(),
                  sectionId: z.string().uuid().optional().nullable(),
                  questionId: z.string().uuid().optional().nullable(),
                  poolBankId: z.string().uuid().optional().nullable(),
                  poolCount: z.number().int().positive().optional().nullable(),
                  points: z.number().positive().default(1),
                  negativePoints: z.number().min(0).default(0),
                  sortOrder: z.number().int().default(0),
                  isMandatory: z.boolean().default(true),
                }),
              )
              .optional(),
          })
          .parse(request.body);

        const existing = await app.prisma.examTemplate.findFirst({
          where: { id, deletedAt: null },
        });
        if (!existing) throw new NotFoundError('Exam');

        await app.prisma.$transaction(async (tx) => {
          await tx.examTemplate.update({
            where: { id },
            data: {
              title: body.title,
              description: body.description,
              durationMinutes: body.durationMinutes,
              passingScore: body.passingScore,
              maxAttempts: body.maxAttempts,
              shuffleQuestions: body.shuffleQuestions,
              shuffleChoices: body.shuffleChoices,
              negativeMarking: body.negativeMarking,
              allowResume: body.allowResume,
              autoSubmit: body.autoSubmit,
              showResults: body.showResults,
              certificateEnabled: body.certificateEnabled,
              instructions: body.instructions,
              retakePolicy: body.retakePolicy as object | undefined,
              gracePeriodSeconds: body.gracePeriodSeconds,
              lateEntryMinutes: body.lateEntryMinutes,
            },
          });

          if (body.sections) {
            await tx.examSection.deleteMany({ where: { examTemplateId: id } });
            for (const s of body.sections) {
              await tx.examSection.create({
                data: {
                  examTemplateId: id,
                  title: s.title,
                  description: s.description,
                  sortOrder: s.sortOrder,
                  durationMinutes: s.durationMinutes,
                },
              });
            }
          }

          if (body.questionRules) {
            await tx.examQuestionRule.deleteMany({ where: { examTemplateId: id } });
            if (body.questionRules.length) {
              await tx.examQuestionRule.createMany({
                data: body.questionRules.map((r, idx) => ({
                  examTemplateId: id,
                  sectionId: r.sectionId ?? null,
                  questionId: r.questionId ?? null,
                  poolBankId: r.poolBankId ?? null,
                  poolCount: r.poolCount ?? null,
                  points: r.points,
                  negativePoints: r.negativePoints,
                  sortOrder: r.sortOrder ?? idx,
                  isMandatory: r.isMandatory,
                })),
              });
            }
          }
        });

        const exam = await app.prisma.examTemplate.findUniqueOrThrow({
          where: { id },
          include: {
            sections: true,
            questionRules: true,
            _count: { select: { sessions: true } },
          },
        });
        return reply.send({ ...mapExamTemplate(exam), ...exam });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- Session detail -----
  app.get(
    `${env.apiPrefix}/sessions/:id`,
    { preHandler: [requirePermission(PERMISSIONS.SESSIONS_READ)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const session = await app.prisma.examSession.findUnique({
          where: { id },
          include: {
            examTemplate: true,
            invitations: {
              include: {
                candidate: {
                  include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
            attempts: {
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                result: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            accessCodes: true,
            _count: { select: { attempts: true, invitations: true } },
          },
        });
        if (!session) throw new NotFoundError('Session');
        return reply.send({
          id: session.id,
          name: session.name,
          status: session.status,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          timezone: session.timezone,
          maxCandidates: session.maxCandidates,
          examTitle: session.examTemplate.title,
          examTemplateId: session.examTemplateId,
          examTemplate: session.examTemplate,
          candidateCount: session._count.attempts,
          invitationCount: session._count.invitations,
          invitations: session.invitations.map((inv) => ({
            id: inv.id,
            email: inv.email,
            acceptedAt: inv.acceptedAt,
            revokedAt: inv.revokedAt,
            candidateId: inv.candidateId,
            candidateName: inv.candidate.user
              ? `${inv.candidate.user.firstName} ${inv.candidate.user.lastName}`.trim()
              : null,
          })),
          attempts: session.attempts.map((a) => ({
            id: a.id,
            status: a.status,
            attemptNumber: a.attemptNumber,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt,
            scorePercent: a.scorePercent,
            passed: a.passed,
            candidateName: `${a.user.firstName} ${a.user.lastName}`.trim(),
            candidateEmail: a.user.email,
            resultId: a.result?.id ?? null,
          })),
          accessCodes: session.accessCodes.map((c) => ({
            id: c.id,
            label: c.label,
            useCount: c.useCount,
            maxUses: c.maxUses,
            expiresAt: c.expiresAt,
            revokedAt: c.revokedAt,
          })),
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- Certificate verify (public) -----
  app.get(`${env.apiPrefix}/certificates/verify/:code`, async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      const cert = await app.prisma.certificate.findFirst({
        where: {
          OR: [{ verificationCode: code }, { certificateNo: code }],
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          result: {
            include: {
              attempt: {
                include: {
                  examSession: {
                    include: { examTemplate: { select: { title: true, code: true } } },
                  },
                },
              },
            },
          },
        },
      });
      if (!cert || cert.revokedAt) {
        return reply.status(404).send({
          valid: false,
          error: { code: 'NOT_FOUND', message: 'Certificate not found or revoked' },
        });
      }
      return reply.send({
        valid: true,
        certificateNo: cert.certificateNo,
        verificationCode: cert.verificationCode,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
        holderName: `${cert.user.firstName} ${cert.user.lastName}`.trim(),
        examTitle: cert.result.attempt.examSession.examTemplate.title,
        percent: Number(cert.result.percent),
        passed: cert.result.passed,
      });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  // ----- Categories / Tags -----
  app.get(`${env.apiPrefix}/categories`, async (_request, reply) => {
    const data = await app.prisma.examCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return reply.send({ data });
  });

  app.post(
    `${env.apiPrefix}/categories`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            name: z.string().min(1),
            slug: z.string().min(1),
            description: z.string().optional(),
            parentId: z.string().uuid().optional(),
            sortOrder: z.number().int().default(0),
          })
          .parse(request.body);
        const cat = await app.prisma.examCategory.create({ data: body });
        return reply.status(201).send(cat);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- RBAC -----
  app.get(
    `${env.apiPrefix}/roles`,
    { preHandler: [requirePermission(PERMISSIONS.ROLES_READ)] },
    async (_request, reply) => {
      const roles = await app.prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
        orderBy: { code: 'asc' },
      });
      return reply.send({
        data: roles.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          userCount: r._count.users,
          permissions: r.permissions.map((p) => p.permission.code),
        })),
      });
    },
  );

  app.get(
    `${env.apiPrefix}/permissions`,
    { preHandler: [requirePermission(PERMISSIONS.ROLES_READ)] },
    async (_request, reply) => {
      const permissions = await app.prisma.permission.findMany({ orderBy: { code: 'asc' } });
      return reply.send({ data: permissions });
    },
  );

  app.put(
    `${env.apiPrefix}/roles/:id/permissions`,
    { preHandler: [requirePermission(PERMISSIONS.ROLES_WRITE)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = z.object({ permissionCodes: z.array(z.string()) }).parse(request.body);
        const role = await app.prisma.role.findUnique({ where: { id } });
        if (!role) throw new NotFoundError('Role');
        if (role.isSystem && role.code === 'SUPER_ADMIN') {
          throw new ForbiddenError('Cannot modify Super Admin permissions');
        }
        const perms = await app.prisma.permission.findMany({
          where: { code: { in: body.permissionCodes } },
        });
        await app.prisma.$transaction([
          app.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
          app.prisma.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
          }),
        ]);
        return reply.send({ ok: true, count: perms.length });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.put(
    `${env.apiPrefix}/users/:id/roles`,
    { preHandler: [requirePermission(PERMISSIONS.USERS_WRITE)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = z.object({ roleCodes: z.array(z.string()).min(1) }).parse(request.body);
        const user = await app.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundError('User');
        const roles = await app.prisma.role.findMany({ where: { code: { in: body.roleCodes } } });
        if (!roles.length) throw new ValidationError('No valid roles');
        await app.prisma.$transaction([
          app.prisma.userRole.deleteMany({ where: { userId: id } }),
          app.prisma.userRole.createMany({
            data: roles.map((r) => ({ userId: id, roleId: r.id })),
          }),
        ]);
        return reply.send({ ok: true, roles: roles.map((r) => r.code) });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  // ----- Announcements admin list -----
  app.get(
    `${env.apiPrefix}/admin/announcements`,
    { preHandler: [requirePermission(PERMISSIONS.NOTIFICATIONS_WRITE)] },
    async (_request, reply) => {
      const data = await app.prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return reply.send({ data });
    },
  );

  // ----- Admin result detail -----
  app.get(
    `${env.apiPrefix}/admin/results/:id`,
    { preHandler: [requirePermission(PERMISSIONS.RESULTS_READ)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await app.prisma.result.findUnique({
          where: { id },
          include: {
            attempt: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                examSession: {
                  include: { examTemplate: { select: { title: true, code: true } } },
                },
                answers: true,
              },
            },
            certificate: true,
          },
        });
        if (!result) throw new NotFoundError('Result');

        const answers = await Promise.all(
          result.attempt.answers.map(async (a) => {
            const question = await app.prisma.question.findUnique({
              where: { id: a.questionId },
              include: {
                versions: { orderBy: { version: 'desc' }, take: 1 },
              },
            });
            return {
              id: a.id,
              questionId: a.questionId,
              questionCode: question?.code ?? null,
              stem: question?.versions[0]?.stem ?? '',
              type: question?.type ?? null,
              response: a.response,
              scoreAwarded: Number(a.scoreAwarded ?? 0),
              maxScore: Number(a.maxScore),
              isCorrect: a.isCorrect,
              needsReview: a.needsReview,
            };
          }),
        );

        return reply.send({
          ...mapResult(result),
          attemptId: result.attemptId,
          certificate: result.certificate
            ? {
                id: result.certificate.id,
                certificateNo: result.certificate.certificateNo,
                verificationCode: result.certificate.verificationCode,
              }
            : null,
          answers,
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
