import type { FastifyInstance } from 'fastify';
import { summarizePsychometrics, type ItemStat } from '@cbt/domain';
import { PERMISSIONS, NotFoundError } from '@cbt/shared';
import { requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { mapDashboardStats } from '../../../shared/dto.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export async function reportingRoutes(app: FastifyInstance) {
  app.get(
    `${env.apiPrefix}/reports/dashboard`,
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
    `${env.apiPrefix}/reports/exams/:examTemplateId/analytics`,
    { preHandler: [requirePermission(PERMISSIONS.REPORTS_READ)] },
    async (request, reply) => {
      try {
        const { examTemplateId } = request.params as { examTemplateId: string };
        const sessions = await app.prisma.examSession.findMany({
          where: { examTemplateId },
          select: { id: true },
        });
        const sessionIds = sessions.map((s) => s.id);
        const attempts = await app.prisma.examAttempt.findMany({
          where: { examSessionId: { in: sessionIds }, status: { in: ['GRADED', 'SUBMITTED', 'UNDER_REVIEW'] } },
          include: { answers: true, result: true },
        });
        const passCount = attempts.filter((a) => a.passed).length;
        const avgPercent =
          attempts.length === 0
            ? 0
            : attempts.reduce((s, a) => s + Number(a.scorePercent ?? 0), 0) / attempts.length;

        const byQuestion = new Map<string, { correct: number; total: number; scores: number[] }>();
        for (const attempt of attempts) {
          for (const answer of attempt.answers) {
            const cur = byQuestion.get(answer.questionId) ?? { correct: 0, total: 0, scores: [] };
            cur.total += 1;
            if (answer.isCorrect) cur.correct += 1;
            cur.scores.push(Number(attempt.scorePercent ?? 0));
            byQuestion.set(answer.questionId, cur);
          }
        }

        const ranked = [...attempts].sort(
          (a, b) => Number(b.scorePercent ?? 0) - Number(a.scorePercent ?? 0),
        );
        const groupSize = Math.max(1, Math.floor(ranked.length * 0.27));
        const high = new Set(ranked.slice(0, groupSize).map((a) => a.id));
        const low = new Set(ranked.slice(-groupSize).map((a) => a.id));

        const itemStats: ItemStat[] = [];
        for (const [questionId] of byQuestion) {
          let highCorrect = 0;
          let lowCorrect = 0;
          for (const attempt of attempts) {
            const ans = attempt.answers.find((a) => a.questionId === questionId);
            if (!ans) continue;
            if (high.has(attempt.id) && ans.isCorrect) highCorrect += 1;
            if (low.has(attempt.id) && ans.isCorrect) lowCorrect += 1;
          }
          const base = byQuestion.get(questionId)!;
          itemStats.push({
            questionId,
            correctCount: base.correct,
            attemptCount: base.total,
            highGroupCorrect: highCorrect,
            highGroupSize: groupSize,
            lowGroupCorrect: lowCorrect,
            lowGroupSize: groupSize,
          });
        }

        return reply.send({
          attemptCount: attempts.length,
          passRate: attempts.length ? passCount / attempts.length : 0,
          averagePercent: Math.round(avgPercent * 100) / 100,
          psychometrics: summarizePsychometrics(itemStats),
        });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/reports/export/results.csv`,
    { preHandler: [requirePermission(PERMISSIONS.RESULTS_EXPORT)] },
    async (request, reply) => {
      try {
        const q = request.query as { examSessionId?: string };
        const results = await app.prisma.result.findMany({
          where: q.examSessionId
            ? { attempt: { examSessionId: q.examSessionId } }
            : {},
          include: {
            attempt: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                examSession: { select: { name: true } },
              },
            },
          },
          take: 10_000,
        });
        const header = 'email,firstName,lastName,session,totalScore,maxScore,percent,passed,gradedAt\n';
        const rows = results
          .map((r) =>
            [
              r.attempt.user.email,
              r.attempt.user.firstName,
              r.attempt.user.lastName,
              r.attempt.examSession.name,
              r.totalScore,
              r.maxScore,
              r.percent,
              r.passed,
              r.gradedAt.toISOString(),
            ].join(','),
          )
          .join('\n');
        reply.header('content-type', 'text/csv');
        reply.header('content-disposition', 'attachment; filename="results.csv"');
        return reply.send(header + rows);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/reports/export/results.xlsx`,
    { preHandler: [requirePermission(PERMISSIONS.RESULTS_EXPORT)] },
    async (_request, reply) => {
      try {
        const results = await app.prisma.result.findMany({
          include: {
            attempt: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                examSession: { select: { name: true } },
              },
            },
          },
          take: 10_000,
        });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Results');
        sheet.columns = [
          { header: 'Email', key: 'email', width: 30 },
          { header: 'First Name', key: 'firstName', width: 16 },
          { header: 'Last Name', key: 'lastName', width: 16 },
          { header: 'Session', key: 'session', width: 24 },
          { header: 'Percent', key: 'percent', width: 12 },
          { header: 'Passed', key: 'passed', width: 10 },
        ];
        for (const r of results) {
          sheet.addRow({
            email: r.attempt.user.email,
            firstName: r.attempt.user.firstName,
            lastName: r.attempt.user.lastName,
            session: r.attempt.examSession.name,
            percent: Number(r.percent),
            passed: r.passed,
          });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        reply.header(
          'content-type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        reply.header('content-disposition', 'attachment; filename="results.xlsx"');
        return reply.send(Buffer.from(buffer));
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/reports/export/candidate/:resultId.pdf`,
    { preHandler: [requirePermission(PERMISSIONS.RESULTS_EXPORT)] },
    async (request, reply) => {
      try {
        const { resultId } = request.params as { resultId: string };
        const result = await app.prisma.result.findUnique({
          where: { id: resultId },
          include: {
            attempt: {
              include: {
                user: true,
                examSession: { include: { examTemplate: true } },
              },
            },
          },
        });
        if (!result) throw new NotFoundError('Result');

        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        const done = new Promise<Buffer>((resolve) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
        });

        doc.fontSize(20).text('Candidate Exam Report', { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Candidate: ${result.attempt.user.firstName} ${result.attempt.user.lastName}`);
        doc.text(`Email: ${result.attempt.user.email}`);
        doc.text(`Exam: ${result.attempt.examSession.examTemplate.title}`);
        doc.text(`Session: ${result.attempt.examSession.name}`);
        doc.text(`Score: ${result.totalScore} / ${result.maxScore} (${result.percent}%)`);
        doc.text(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
        doc.text(`Graded: ${result.gradedAt.toISOString()}`);
        doc.end();

        const buffer = await done;
        reply.header('content-type', 'application/pdf');
        reply.header('content-disposition', `attachment; filename="result-${resultId}.pdf"`);
        return reply.send(buffer);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
