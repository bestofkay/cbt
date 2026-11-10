import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  createMemoryQueue,
  MemoryBus,
  type JobQueue,
} from '../lib/memory-bus.js';
import { deliverWebhook, gradeAttempt } from '../jobs/grade-attempt.js';
import { dispatchNotification } from '../jobs/notify.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** In-process cache + pub/sub (no Redis required). */
    redis: MemoryBus;
    queues: {
      notifications: JobQueue;
      grading: JobQueue;
      exports: JobQueue;
      webhooks: JobQueue;
    };
  }
}

/**
 * In-memory runtime: replaces Redis + BullMQ for single-node deployments.
 * Jobs are processed inside the API process.
 */
export const runtimePlugin = fp(async (app: FastifyInstance) => {
  const bus = new MemoryBus();

  app.decorate('redis', bus);
  app.decorate('queues', {
    notifications: createMemoryQueue(async (name, data) => {
      const payload = data as {
        notificationId?: string;
        to?: string;
        subject?: string;
        html?: string;
        body?: string;
        text?: string;
        userId?: string;
        payload?: Record<string, unknown>;
      };
      await dispatchNotification(app, {
        ...payload,
        channel: name,
      });
    }),
    grading: createMemoryQueue(async (_name, data) => {
      const { attemptId } = data as { attemptId: string };
      await gradeAttempt(app, attemptId);
    }),
    exports: createMemoryQueue(async () => {
      /* reserved for CSV/PDF export jobs */
    }),
    webhooks: createMemoryQueue(async (_name, data) => {
      await deliverWebhook(
        app,
        data as { webhookId: string; event: string; payload: unknown },
      );
    }),
  });

  app.addHook('onClose', async () => {
    await Promise.all([
      app.queues.notifications.close(),
      app.queues.grading.close(),
      app.queues.exports.close(),
      app.queues.webhooks.close(),
      bus.quit(),
    ]);
  });
});
