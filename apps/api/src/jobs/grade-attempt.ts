import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  aggregateAttemptScore,
  gradeObjectiveAnswer,
} from '@cbt/domain';

export async function gradeAttempt(app: FastifyInstance, attemptId: string) {
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
        versions: { orderBy: { version: 'desc' }, take: 1, include: { choices: true } },
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
      const existing = await app.prisma.manualReviewItem.findFirst({
        where: { attemptId, answerId: answer.id, status: 'PENDING' },
      });
      if (!existing) {
        await app.prisma.manualReviewItem.create({
          data: { attemptId, answerId: answer.id, status: 'PENDING' },
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
        verificationCode: randomBytes(16).toString('base64url'),
      },
      update: {},
    });
  }

  await app.prisma.backgroundJob.create({
    data: {
      queue: 'grading',
      jobName: 'grade-attempt',
      status: 'completed',
      payload: { attemptId },
      result: { resultId: result.id },
      finishedAt: new Date(),
    },
  });
}

export async function deliverWebhook(
  app: FastifyInstance,
  data: { webhookId: string; event: string; payload: unknown },
) {
  const webhook = await app.prisma.webhook.findUnique({ where: { id: data.webhookId } });
  if (!webhook?.isActive) return;
  const res = await fetch(webhook.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: data.event, payload: data.payload }),
  });
  await app.prisma.webhookDelivery.create({
    data: {
      webhookId: data.webhookId,
      event: data.event,
      payload: data.payload as object,
      statusCode: res.status,
      success: res.ok,
      attempts: 1,
      responseBody: await res.text(),
    },
  });
}
