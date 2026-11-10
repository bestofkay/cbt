import type { FastifyInstance } from 'fastify';
import {
  buildPaginatedResult,
  createExamSessionSchema,
  createExamTemplateSchema,
  NotFoundError,
  paginationSchema,
  PERMISSIONS,
  saveAnswerSchema,
  startAttemptSchema,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@cbt/shared';
import {
  assertAttemptTransition,
  canSaveAnswers,
  gradeObjectiveAnswer,
  aggregateAttemptScore,
} from '@cbt/domain';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { audit } from '../../../shared/audit.js';
import { sha256, randomToken } from '../../../shared/crypto.js';
import { mapAttemptForCandidate, mapResult } from '../../../shared/dto.js';
import { z } from 'zod';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function examRoutes(app: FastifyInstance) {
  app.get(
    `${env.apiPrefix}/exams`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_READ)] },
    async (request, reply) => {
      try {
        const query = paginationSchema.parse(request.query);
        const where = { deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.examTemplate.count({ where }),
          app.prisma.examTemplate.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: { updatedAt: 'desc' },
            include: { sections: true, _count: { select: { sessions: true } } },
          }),
        ]);
        return reply.send(buildPaginatedResult(data, total, query.page, query.pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/exams`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const body = createExamTemplateSchema.parse(request.body);
        const exam = await app.prisma.$transaction(async (tx) => {
          const template = await tx.examTemplate.create({
            data: {
              code: body.code,
              title: body.title,
              description: body.description,
              categoryId: body.categoryId,
              mode: body.mode,
              accessType: body.accessType,
              durationMinutes: body.durationMinutes,
              sectionTiming: body.sectionTiming,
              allowBreaks: body.allowBreaks,
              breakMinutes: body.breakMinutes,
              passingScore: body.passingScore,
              maxAttempts: body.maxAttempts,
              shuffleQuestions: body.shuffleQuestions,
              shuffleChoices: body.shuffleChoices,
              adaptive: body.adaptive,
              negativeMarking: body.negativeMarking,
              gracePeriodSeconds: body.gracePeriodSeconds,
              lateEntryMinutes: body.lateEntryMinutes,
              allowResume: body.allowResume,
              autoSubmit: body.autoSubmit,
              showResults: body.showResults,
              certificateEnabled: body.certificateEnabled,
              instructions: body.instructions,
            },
          });
          const sectionIds: string[] = [];
          if (body.sections?.length) {
            for (const s of body.sections) {
              const section = await tx.examSection.create({
                data: {
                  examTemplateId: template.id,
                  title: s.title,
                  description: s.description,
                  sortOrder: s.sortOrder,
                  durationMinutes: s.durationMinutes,
                },
              });
              sectionIds.push(section.id);
            }
          }
          if (body.questionRules?.length) {
            await tx.examQuestionRule.createMany({
              data: body.questionRules.map((r, idx) => ({
                examTemplateId: template.id,
                sectionId: r.sectionId ?? sectionIds[0] ?? null,
                questionId: r.questionId,
                poolBankId: r.poolBankId,
                poolTopicId: r.poolTopicId,
                poolDifficulty: r.poolDifficulty,
                poolType: r.poolType,
                poolCount: r.poolCount,
                points: r.points,
                negativePoints: r.negativePoints,
                sortOrder: r.sortOrder ?? idx,
                isMandatory: r.isMandatory,
              })),
            });
          }
          return tx.examTemplate.findUniqueOrThrow({
            where: { id: template.id },
            include: { sections: true, questionRules: true },
          });
        });
        await audit(app, {
          actorId: user.id,
          action: 'exam.create',
          resource: 'exam_template',
          resourceId: exam.id,
        });
        return reply.status(201).send(exam);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/exams/:id/publish`,
    { preHandler: [requirePermission(PERMISSIONS.EXAMS_PUBLISH)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const exam = await app.prisma.examTemplate.update({
          where: { id },
          data: { isPublished: true },
        });
        return reply.send(exam);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/sessions`,
    { preHandler: [requirePermission(PERMISSIONS.SESSIONS_READ)] },
    async (request, reply) => {
      try {
        const query = paginationSchema
          .extend({ status: z.string().optional() })
          .parse(request.query);
        const where = {
          ...(query.status ? { status: query.status as never } : {}),
        };
        const [total, data] = await Promise.all([
          app.prisma.examSession.count({ where }),
          app.prisma.examSession.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: { startsAt: 'desc' },
            include: {
              examTemplate: { select: { id: true, title: true, code: true, durationMinutes: true } },
              _count: { select: { attempts: true, invitations: true } },
            },
          }),
        ]);
        return reply.send(buildPaginatedResult(data, total, query.page, query.pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/sessions/lobby`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const now = new Date();
      const sessions = await app.prisma.examSession.findMany({
        where: {
          status: { in: ['PUBLISHED', 'LIVE'] },
          OR: [
            { startsAt: null },
            { startsAt: { lte: new Date(now.getTime() + 24 * 3600 * 1000) } },
          ],
        },
        include: {
          examTemplate: true,
          invitations: user
            ? {
                where: {
                  candidate: { user: { id: user.id } },
                },
              }
            : false,
        },
        orderBy: { startsAt: 'asc' },
        take: 50,
      });
      return reply.send({ data: sessions });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(
    `${env.apiPrefix}/sessions`,
    { preHandler: [requirePermission(PERMISSIONS.SESSIONS_WRITE)] },
    async (request, reply) => {
      try {
        const body = createExamSessionSchema.parse(request.body);
        const accessCodeHash = body.accessCode ? sha256(body.accessCode) : null;
        const session = await app.prisma.examSession.create({
          data: {
            examTemplateId: body.examTemplateId,
            name: body.name,
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            timezone: body.timezone,
            maxCandidates: body.maxCandidates,
            accessCodeHash,
            status: 'PUBLISHED',
          },
        });
        if (body.accessCode) {
          await app.prisma.accessCode.create({
            data: {
              examSessionId: session.id,
              codeHash: sha256(body.accessCode),
              label: 'Primary',
            },
          });
        }
        return reply.status(201).send(session);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/sessions/:id/invite`,
    { preHandler: [requirePermission(PERMISSIONS.SESSIONS_WRITE)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = z
          .object({ candidateId: z.string().uuid(), email: z.string().email() })
          .parse(request.body);
        const token = randomToken();
        const invitation = await app.prisma.examInvitation.create({
          data: {
            examSessionId: id,
            candidateId: body.candidateId,
            email: body.email,
            tokenHash: sha256(token),
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          },
        });
        await app.queues.notifications.add('email', {
          to: body.email,
          subject: 'Exam invitation',
          html: `<p>Your invitation token: ${token}</p>`,
          template: 'exam_invitation',
        });
        return reply.status(201).send({ id: invitation.id, token });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/attempts/start`,
    { preHandler: [requirePermission(PERMISSIONS.ATTEMPTS_TAKE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const body = startAttemptSchema.parse(request.body);
        const fullUser = await app.prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { candidate: true },
        });
        if (!fullUser.candidateId) throw new ValidationError('User is not a candidate');

        const session = await app.prisma.examSession.findUniqueOrThrow({
          where: { id: body.examSessionId },
          include: {
            examTemplate: { include: { questionRules: true, sections: true } },
          },
        });

        const now = new Date();
        if (session.startsAt && session.startsAt > now) {
          const lateMs = (session.examTemplate.lateEntryMinutes ?? 0) * 60_000;
          if (session.startsAt.getTime() - now.getTime() > 0 && now < session.startsAt) {
            throw new ValidationError('Exam has not started');
          }
          void lateMs;
        }
        if (session.endsAt && session.endsAt < now) {
          throw new ValidationError('Exam session has ended');
        }

        if (session.examTemplate.accessType === 'ACCESS_CODE') {
          if (!body.accessCode) throw new ValidationError('Access code required');
          const hash = sha256(body.accessCode);
          const code = await app.prisma.accessCode.findFirst({
            where: {
              examSessionId: session.id,
              codeHash: hash,
              revokedAt: null,
            },
          });
          if (!code) throw new ForbiddenError('Invalid access code');
          if (code.maxUses && code.useCount >= code.maxUses) {
            throw new ForbiddenError('Access code exhausted');
          }
          await app.prisma.accessCode.update({
            where: { id: code.id },
            data: { useCount: { increment: 1 } },
          });
        }

        if (session.examTemplate.accessType === 'INVITATION_ONLY') {
          if (!body.invitationToken) throw new ValidationError('Invitation required');
          const inv = await app.prisma.examInvitation.findFirst({
            where: {
              examSessionId: session.id,
              candidateId: fullUser.candidateId,
              tokenHash: sha256(body.invitationToken),
              revokedAt: null,
            },
          });
          if (!inv) throw new ForbiddenError('Invalid invitation');
          await app.prisma.examInvitation.update({
            where: { id: inv.id },
            data: { acceptedAt: new Date() },
          });
        }

        const priorCount = await app.prisma.examAttempt.count({
          where: {
            examSessionId: session.id,
            candidateId: fullUser.candidateId,
            status: { not: 'VOIDED' },
          },
        });
        if (priorCount >= session.examTemplate.maxAttempts) {
          throw new ConflictError('Maximum attempts reached');
        }

        const existing = await app.prisma.examAttempt.findFirst({
          where: {
            examSessionId: session.id,
            candidateId: fullUser.candidateId,
            status: { in: ['IN_PROGRESS', 'PAUSED', 'NOT_STARTED'] },
          },
        });
        if (existing && session.examTemplate.allowResume) {
          return reply.send(await mapAttemptForCandidate(app, existing.id));
        }

        const questionIds = await resolveQuestionIds(app, session.examTemplate);
        const ordered = session.examTemplate.shuffleQuestions
          ? shuffle(questionIds)
          : questionIds;

        const startedAt = now;
        const endsAt = new Date(
          startedAt.getTime() + session.examTemplate.durationMinutes * 60_000,
        );

        const attempt = await app.prisma.examAttempt.create({
          data: {
            examSessionId: session.id,
            candidateId: fullUser.candidateId,
            userId: user.id,
            attemptNumber: priorCount + 1,
            status: 'IN_PROGRESS',
            startedAt,
            endsAt,
            lastActivityAt: now,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            deviceFingerprint: body.deviceFingerprint,
            questionOrder: ordered,
          },
        });

        await app.prisma.proctorSession.create({
          data: { attemptId: attempt.id, status: 'ACTIVE' },
        });

        // Fire-and-forget IP / VPN intelligence for proctoring
        void (async () => {
          try {
            const { lookupIpIntel } = await import('../../proctoring/ip-intel.js');
            const { resolveProctoringPolicy } = await import('../../proctoring/policy.js');
            const policy = resolveProctoringPolicy(
              session.examTemplate.mode,
              session.examTemplate.settings,
            );
            const ps = await app.prisma.proctorSession.findUnique({
              where: { attemptId: attempt.id },
            });
            if (!ps) return;
            const intel = await lookupIpIntel(request.ip);
            await app.prisma.locationLog.create({
              data: {
                proctorSessionId: ps.id,
                ipAddress: intel.ip,
                country: intel.country,
                region: intel.region,
                city: intel.city,
                latitude: intel.latitude,
                longitude: intel.longitude,
                vpnSuspected: policy.vpnCheck ? intel.vpnSuspected : false,
              },
            });
            if (policy.vpnCheck && intel.vpnSuspected) {
              await app.prisma.proctorEvent.create({
                data: {
                  proctorSessionId: ps.id,
                  type: 'VPN_SUSPECTED',
                  severity: 8,
                  payload: { org: intel.org, ip: intel.ip, city: intel.city },
                },
              });
            }
          } catch {
            /* best-effort */
          }
        })();

        await audit(app, {
          actorId: user.id,
          action: 'attempt.start',
          resource: 'exam_attempt',
          resourceId: attempt.id,
          ipAddress: request.ip,
        });

        return reply.status(201).send(await mapAttemptForCandidate(app, attempt.id));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/attempts/:id`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const attempt = await app.prisma.examAttempt.findUnique({ where: { id } });
      if (!attempt) throw new NotFoundError('Attempt');
      if (
        attempt.userId !== user.id &&
        !user.permissions.includes(PERMISSIONS.ATTEMPTS_READ)
      ) {
        throw new ForbiddenError();
      }
      return reply.send(await mapAttemptForCandidate(app, id));
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.put(`${env.apiPrefix}/attempts/:id/answers`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = saveAnswerSchema.parse(request.body);
      const attempt = await app.prisma.examAttempt.findUnique({ where: { id } });
      if (!attempt) throw new NotFoundError('Attempt');
      if (attempt.userId !== user.id) throw new ForbiddenError();
      if (!canSaveAnswers(attempt.status)) {
        throw new ConflictError(`Cannot save answers in status ${attempt.status}`);
      }
      if (attempt.endsAt && attempt.endsAt.getTime() + 30_000 < Date.now()) {
        throw new ConflictError('Attempt time expired');
      }

      const question = await app.prisma.question.findUniqueOrThrow({
        where: { id: body.questionId },
      });

      const answer = await app.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: body.questionId } },
        create: {
          attemptId: id,
          questionId: body.questionId,
          response: body.response as object,
          maxScore: question.pointsDefault,
          timeSpentSeconds: body.timeSpentSeconds ?? 0,
          answeredAt: new Date(),
          modifiedCount: 1,
        },
        update: {
          response: body.response as object,
          timeSpentSeconds: { increment: body.timeSpentSeconds ?? 0 },
          answeredAt: new Date(),
          modifiedCount: { increment: 1 },
        },
      });

      await app.prisma.examAttempt.update({
        where: { id },
        data: { lastActivityAt: new Date() },
      });

      await audit(app, {
        actorId: user.id,
        action: 'answer.saved',
        resource: 'attempt_answer',
        resourceId: answer.id,
        metadata: { attemptId: id, questionId: body.questionId },
      });

      // Offline sync ack (in-memory TTL cache)
      await app.redis.setex(`attempt:${id}:answer:${body.questionId}`, 3600, JSON.stringify(answer));

      return reply.send(answer);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.post(`${env.apiPrefix}/attempts/:id/bookmarks`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z.object({ questionId: z.string().uuid(), note: z.string().optional() }).parse(request.body);
      const attempt = await app.prisma.examAttempt.findUniqueOrThrow({ where: { id } });
      if (attempt.userId !== user.id) throw new ForbiddenError();
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

  app.post(`${env.apiPrefix}/attempts/:id/flags`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const body = z.object({ questionId: z.string().uuid(), reason: z.string().optional() }).parse(request.body);
      const attempt = await app.prisma.examAttempt.findUniqueOrThrow({ where: { id } });
      if (attempt.userId !== user.id) throw new ForbiddenError();
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

  app.post(`${env.apiPrefix}/attempts/:id/submit`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const { id } = request.params as { id: string };
      const attempt = await app.prisma.examAttempt.findUnique({
        where: { id },
        include: {
          examSession: { include: { examTemplate: true } },
          answers: true,
        },
      });
      if (!attempt) throw new NotFoundError('Attempt');
      if (attempt.userId !== user.id) throw new ForbiddenError();
      assertAttemptTransition(attempt.status, 'SUBMITTED');

      // Atomic submit — prevents double-submit races
      const updated = await app.prisma.examAttempt.updateMany({
        where: {
          id,
          status: { in: ['IN_PROGRESS', 'PAUSED'] },
        },
        data: { status: 'SUBMITTED', submittedAt: new Date(), lastActivityAt: new Date() },
      });
      if (updated.count === 0) {
        throw new ConflictError('Attempt already submitted or not submittable');
      }

      await app.queues.grading.add('grade-attempt', { attemptId: id }, { attempts: 3 });

      await audit(app, {
        actorId: user.id,
        action: 'attempt.submit',
        resource: 'exam_attempt',
        resourceId: id,
      });

      // Grade synchronously for immediate feedback; worker is backup/retry only if sync fails
      try {
        const result = await gradeAttemptNow(app, id);
        return reply.send(result);
      } catch (gradeErr) {
        app.log.error(gradeErr);
        return reply.send({ attemptId: id, status: 'SUBMITTED', grading: 'queued' });
      }
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/results`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const isStaff = user.roles.some((r) =>
        ['SUPER_ADMIN', 'ADMIN', 'EXAM_MANAGER', 'AUDITOR'].includes(r),
      );
      const results = await app.prisma.result.findMany({
        where: isStaff ? {} : { attempt: { userId: user.id } },
        include: {
          attempt: {
            include: {
              user: { select: { email: true, firstName: true, lastName: true } },
              examSession: { include: { examTemplate: { select: { title: true, code: true } } } },
            },
          },
          certificate: true,
        },
        orderBy: { gradedAt: 'desc' },
        take: 100,
      });
      return reply.send({ data: results.map(mapResult) });
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(`${env.apiPrefix}/results/:id`, async (request, reply) => {
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
      if (!result) throw new NotFoundError('Result');
      const isStaff = user.roles.some((r) =>
        ['SUPER_ADMIN', 'ADMIN', 'EXAM_MANAGER', 'AUDITOR'].includes(r),
      );
      if (result.attempt.userId !== user.id && !isStaff) {
        throw new ForbiddenError();
      }
      return reply.send(mapResult(result));
    } catch (e) {
      return sendError(reply, e);
    }
  });
}

async function resolveQuestionIds(
  app: FastifyInstance,
  template: {
    id: string;
    questionRules: Array<{
      questionId: string | null;
      poolBankId: string | null;
      poolTopicId: string | null;
      poolDifficulty: string | null;
      poolType: string | null;
      poolCount: number | null;
    }>;
  },
): Promise<string[]> {
  const ids: string[] = [];
  for (const rule of template.questionRules) {
    if (rule.questionId) {
      ids.push(rule.questionId);
      continue;
    }
    if (rule.poolBankId && rule.poolCount) {
      const pool = await app.prisma.question.findMany({
        where: {
          bankId: rule.poolBankId,
          status: 'APPROVED',
          deletedAt: null,
          ...(rule.poolTopicId ? { topicId: rule.poolTopicId } : {}),
          ...(rule.poolDifficulty ? { difficulty: rule.poolDifficulty as never } : {}),
          ...(rule.poolType ? { type: rule.poolType as never } : {}),
        },
        select: { id: true },
      });
      ids.push(...shuffle(pool.map((q) => q.id)).slice(0, rule.poolCount));
    }
  }
  return [...new Set(ids)];
}

export async function gradeAttemptNow(app: FastifyInstance, attemptId: string) {
  const attempt = await app.prisma.examAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      answers: true,
      examSession: { include: { examTemplate: true } },
    },
  });

  const lines = [];
  for (const answer of attempt.answers) {
    const question = await app.prisma.question.findUniqueOrThrow({
      where: { id: answer.questionId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { choices: true },
        },
      },
    });
    const version = question.versions[0];
    const graded = gradeObjectiveAnswer({
      type: question.type,
      maxScore: Number(answer.maxScore),
      negativePoints: attempt.examSession.examTemplate.negativeMarking
        ? Number(question.negativeMarking)
        : 0,
      partialScoring: question.partialScoring,
      choices: (version?.choices ?? []).map((c) => ({
        id: c.id,
        isCorrect: c.isCorrect,
        weight: Number(c.weight),
        matchKey: c.matchKey,
        label: c.label,
      })),
      response: answer.response,
      autoGradeConfig: (version?.autoGradeConfig as Record<string, unknown>) ?? null,
    });

    await app.prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: {
        isCorrect: graded.isCorrect,
        scoreAwarded: graded.scoreAwarded,
        needsReview: graded.needsReview,
      },
    });

    if (graded.needsReview) {
      const existingReview = await app.prisma.manualReviewItem.findFirst({
        where: { attemptId, answerId: answer.id, status: 'PENDING' },
      });
      if (!existingReview) {
        await app.prisma.manualReviewItem.create({
          data: {
            attemptId,
            answerId: answer.id,
            status: 'PENDING',
          },
        });
      }
    }

    lines.push({
      maxScore: Number(answer.maxScore),
      scoreAwarded: graded.scoreAwarded,
      isCorrect: graded.isCorrect,
    });
  }

  const score = aggregateAttemptScore(
    lines,
    Number(attempt.examSession.examTemplate.passingScore),
  );

  const needsReview = await app.prisma.manualReviewItem.count({
    where: { attemptId, status: 'PENDING' },
  });

  await app.prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: needsReview > 0 ? 'UNDER_REVIEW' : 'GRADED',
      scoreRaw: score.totalScore,
      scorePercent: score.percent,
      passed: score.passed,
    },
  });

  const result = await app.prisma.result.upsert({
    where: { attemptId },
    create: {
      attemptId,
      totalScore: score.totalScore,
      maxScore: score.maxScore,
      percent: score.percent,
      passed: score.passed,
    },
    update: {
      totalScore: score.totalScore,
      maxScore: score.maxScore,
      percent: score.percent,
      passed: score.passed,
      gradedAt: new Date(),
    },
  });

  if (score.passed && attempt.examSession.examTemplate.certificateEnabled) {
    await app.prisma.certificate.upsert({
      where: { resultId: result.id },
      create: {
        resultId: result.id,
        userId: attempt.userId,
        certificateNo: `CERT-${Date.now()}`,
        verificationCode: randomToken(16),
      },
      update: {},
    });
  }

  return result;
}
