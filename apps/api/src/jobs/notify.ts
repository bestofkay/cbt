import type { FastifyInstance } from 'fastify';

export async function dispatchNotification(
  app: Pick<FastifyInstance, 'prisma' | 'mailer'>,
  job: {
    notificationId?: string;
    to?: string;
    subject?: string;
    html?: string;
    body?: string;
    text?: string;
    userId?: string;
    channel?: string;
    payload?: Record<string, unknown>;
  },
) {
  const channel = (job.channel ?? 'email').toUpperCase();

  if (channel === 'EMAIL' || !job.channel) {
    if (job.to && (job.html || job.body)) {
      await app.mailer.send({
        to: job.to,
        subject: job.subject ?? 'CBT Notification',
        html: job.html ?? job.body ?? '',
        text: job.text ?? job.body,
      });
    }
  }

  if (channel === 'SMS') {
    console.info('[SMS]', job.to, job.body ?? job.payload);
  }

  if (channel === 'SLACK') {
    const webhookUrl = job.payload?.webhookUrl as string | undefined;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.body ?? job.subject ?? 'CBT notification' }),
      });
    }
  }

  if (channel === 'TEAMS') {
    const webhookUrl = job.payload?.webhookUrl as string | undefined;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.body ?? job.subject ?? 'CBT notification' }),
      });
    }
  }

  if (channel === 'WEBHOOK') {
    const url = job.payload?.url as string | undefined;
    if (url) {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job.payload ?? job),
      });
    }
  }

  if (job.notificationId) {
    await app.prisma.notification.update({
      where: { id: job.notificationId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }
}
