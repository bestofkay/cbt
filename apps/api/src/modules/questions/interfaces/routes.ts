import type { FastifyInstance } from 'fastify';
import {
  buildPaginatedResult,
  createBankSchema,
  createQuestionSchema,
  NotFoundError,
  paginationSchema,
  PERMISSIONS,
  reviewQuestionSchema,
  submitForReviewSchema,
} from '@cbt/shared';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { audit } from '../../../shared/audit.js';
import { mapQuestionDetail } from '../../../shared/dto.js';
import { z } from 'zod';

export async function questionRoutes(app: FastifyInstance) {
  app.get(
    `${env.apiPrefix}/banks`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_READ)] },
    async (request, reply) => {
      try {
        const query = paginationSchema.parse(request.query);
        const where = { deletedAt: null };
        const [total, data] = await Promise.all([
          app.prisma.questionBank.count({ where }),
          app.prisma.questionBank.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { questions: true } }, category: true },
          }),
        ]);
        return reply.send(buildPaginatedResult(data, total, query.page, query.pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/banks`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const body = createBankSchema.parse(request.body);
        const bank = await app.prisma.questionBank.create({ data: body });
        await audit(app, {
          actorId: user.id,
          action: 'bank.create',
          resource: 'question_bank',
          resourceId: bank.id,
        });
        return reply.status(201).send(bank);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/banks/:id`,
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
              take: 50,
              orderBy: { updatedAt: 'desc' },
              include: { tags: { include: { tag: true } } },
            },
          },
        });
        if (!bank) throw new NotFoundError('Question bank');
        return reply.send(bank);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/banks/:id/topics`,
    { preHandler: [requirePermission(PERMISSIONS.BANKS_WRITE)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = z
          .object({
            name: z.string().min(1),
            code: z.string().min(1),
            parentId: z.string().uuid().optional(),
          })
          .parse(request.body);
        const topic = await app.prisma.topic.create({
          data: { bankId: id, name: body.name, code: body.code, parentId: body.parentId },
        });
        return reply.status(201).send(topic);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/questions`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_READ)] },
    async (request, reply) => {
      try {
        const query = paginationSchema
          .extend({
            bankId: z.string().uuid().optional(),
            type: z.string().optional(),
            status: z.string().optional(),
            difficulty: z.string().optional(),
            search: z.string().optional(),
          })
          .parse(request.query);
        const where = {
          deletedAt: null,
          ...(query.bankId ? { bankId: query.bankId } : {}),
          ...(query.type ? { type: query.type as never } : {}),
          ...(query.status ? { status: query.status as never } : {}),
          ...(query.difficulty ? { difficulty: query.difficulty as never } : {}),
          ...(query.search
            ? { OR: [{ code: { contains: query.search } }] }
            : {}),
        };
        const [total, data] = await Promise.all([
          app.prisma.question.count({ where }),
          app.prisma.question.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: { updatedAt: 'desc' },
            include: {
              versions: { orderBy: { version: 'desc' }, take: 1, include: { choices: true, language: true } },
              tags: { include: { tag: true } },
              topic: true,
            },
          }),
        ]);
        return reply.send(buildPaginatedResult(data, total, query.page, query.pageSize));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/questions`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const body = createQuestionSchema.parse(request.body);
        const question = await app.prisma.$transaction(async (tx) => {
          const q = await tx.question.create({
            data: {
              bankId: body.bankId,
              topicId: body.topicId,
              code: body.code,
              type: body.type,
              difficulty: body.difficulty,
              authorId: user.id,
              pointsDefault: body.pointsDefault,
              negativeMarking: body.negativeMarking,
              partialScoring: body.partialScoring,
              estimatedSeconds: body.estimatedSeconds,
              status: 'DRAFT',
              currentVersion: 1,
            },
          });
          if (body.tagIds?.length) {
            await tx.questionTag.createMany({
              data: body.tagIds.map((tagId) => ({ questionId: q.id, tagId })),
            });
          }
          const version = await tx.questionVersion.create({
            data: {
              questionId: q.id,
              version: 1,
              languageId: body.version.languageId,
              stem: body.version.stem,
              stemFormat: body.version.stemFormat,
              latexBlocks: body.version.latexBlocks,
              randomVariables: body.version.randomVariables as object | undefined,
              hints: body.version.hints,
              solution: body.version.solution,
              solutionFormat: body.version.solutionFormat,
              gradingRubric: body.version.gradingRubric as object | undefined,
              autoGradeConfig: body.version.autoGradeConfig as object | undefined,
              status: 'DRAFT',
            },
          });
          if (body.version.choices?.length) {
            await tx.choice.createMany({
              data: body.version.choices.map((c) => ({
                questionVersionId: version.id,
                label: c.label,
                content: c.content,
                contentFormat: c.contentFormat,
                isCorrect: c.isCorrect,
                weight: c.weight,
                sortOrder: c.sortOrder,
                matchKey: c.matchKey,
                metadata: c.metadata as object | undefined,
              })),
            });
          }
          return tx.question.findUniqueOrThrow({
            where: { id: q.id },
            include: {
              versions: { include: { choices: true, language: true } },
              tags: { include: { tag: true } },
            },
          });
        });
        await audit(app, {
          actorId: user.id,
          action: 'question.create',
          resource: 'question',
          resourceId: question.id,
        });
        return reply.status(201).send(question);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/questions/:id`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_READ)] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const question = await app.prisma.question.findFirst({
          where: { id, deletedAt: null },
          include: {
            versions: {
              orderBy: { version: 'desc' },
              include: { choices: true, language: true, workflows: true },
            },
            tags: { include: { tag: true } },
            media: true,
            topic: true,
            bank: true,
          },
        });
        if (!question) throw new NotFoundError('Question');
        return reply.send(mapQuestionDetail(question));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/questions/:id/versions`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = createQuestionSchema.shape.version.parse(request.body);
        const question = await app.prisma.question.findFirst({
          where: { id, deletedAt: null },
        });
        if (!question) throw new NotFoundError('Question');
        const nextVersion = question.currentVersion + 1;
        const version = await app.prisma.$transaction(async (tx) => {
          const v = await tx.questionVersion.create({
            data: {
              questionId: id,
              version: nextVersion,
              languageId: body.languageId,
              stem: body.stem,
              stemFormat: body.stemFormat,
              latexBlocks: body.latexBlocks,
              randomVariables: body.randomVariables as object | undefined,
              hints: body.hints,
              solution: body.solution,
              solutionFormat: body.solutionFormat,
              gradingRubric: body.gradingRubric as object | undefined,
              autoGradeConfig: body.autoGradeConfig as object | undefined,
              status: 'DRAFT',
              changeSummary: `Version ${nextVersion}`,
            },
          });
          if (body.choices?.length) {
            await tx.choice.createMany({
              data: body.choices.map((c) => ({
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
          await tx.question.update({
            where: { id },
            data: { currentVersion: nextVersion, status: 'DRAFT' },
          });
          return tx.questionVersion.findUniqueOrThrow({
            where: { id: v.id },
            include: { choices: true },
          });
        });
        await audit(app, {
          actorId: user.id,
          action: 'question.version_create',
          resource: 'question',
          resourceId: id,
          metadata: { version: nextVersion },
        });
        return reply.status(201).send(version);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/questions/:id/submit-review`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_WRITE)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = submitForReviewSchema.parse(request.body ?? {});
        const version = await app.prisma.questionVersion.findFirst({
          where: { questionId: id },
          orderBy: { version: 'desc' },
        });
        if (!version) throw new NotFoundError('Question version');
        await app.prisma.$transaction([
          app.prisma.questionVersion.update({
            where: { id: version.id },
            data: { status: 'IN_REVIEW' },
          }),
          app.prisma.question.update({
            where: { id },
            data: { status: 'IN_REVIEW' },
          }),
          app.prisma.approvalWorkflow.create({
            data: {
              questionVersionId: version.id,
              action: 'SUBMITTED',
              actorId: user.id,
              notes: body.notes,
            },
          }),
        ]);
        return reply.send({ status: 'IN_REVIEW' });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/questions/:id/review`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_REVIEW)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const { id } = request.params as { id: string };
        const body = reviewQuestionSchema.parse(request.body);
        const version = await app.prisma.questionVersion.findFirst({
          where: { questionId: id },
          orderBy: { version: 'desc' },
        });
        if (!version) throw new NotFoundError('Question version');
        const status =
          body.action === 'APPROVED'
            ? 'APPROVED'
            : body.action === 'REJECTED'
              ? 'REJECTED'
              : 'DRAFT';
        await app.prisma.$transaction([
          app.prisma.questionVersion.update({
            where: { id: version.id },
            data: {
              status: status === 'DRAFT' ? 'DRAFT' : status,
              reviewerId: user.id,
              reviewedAt: new Date(),
              reviewNotes: body.notes,
            },
          }),
          app.prisma.question.update({
            where: { id },
            data: { status: status === 'DRAFT' ? 'DRAFT' : (status as never) },
          }),
          app.prisma.approvalWorkflow.create({
            data: {
              questionVersionId: version.id,
              action: body.action,
              actorId: user.id,
              notes: body.notes,
            },
          }),
        ]);
        return reply.send({ status });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(`${env.apiPrefix}/languages`, async (_request, reply) => {
    const languages = await app.prisma.language.findMany({ orderBy: { code: 'asc' } });
    return reply.send(languages);
  });

  app.get(`${env.apiPrefix}/tags`, async (_request, reply) => {
    const tags = await app.prisma.tag.findMany({ orderBy: { name: 'asc' } });
    return reply.send(tags);
  });

  app.post(
    `${env.apiPrefix}/tags`,
    { preHandler: [requirePermission(PERMISSIONS.QUESTIONS_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({ name: z.string().min(1), color: z.string().optional() })
          .parse(request.body);
        const tag = await app.prisma.tag.create({ data: body });
        return reply.status(201).send(tag);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
