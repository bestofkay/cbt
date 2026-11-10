import type { FastifyInstance } from 'fastify';
import { createTransport, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransporter(): Transporter {
  // No Mailpit/Redis — default to console logging unless a real SMTP host is set.
  const useConsole =
    process.env.SMTP_MODE === 'console' ||
    !process.env.SMTP_HOST ||
    process.env.SMTP_HOST === 'localhost' ||
    process.env.SMTP_HOST === '127.0.0.1';

  if (useConsole && process.env.SMTP_MODE !== 'smtp') {
    return createTransport({
      jsonTransport: true,
    });
  }

  return createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

export function createMailer() {
  const transporter = createTransporter();
  const consoleMode =
    process.env.SMTP_MODE === 'console' ||
    !process.env.SMTP_HOST ||
    process.env.SMTP_HOST === 'localhost' ||
    process.env.SMTP_HOST === '127.0.0.1';

  return {
    async send(message: MailMessage) {
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (consoleMode && process.env.SMTP_MODE !== 'smtp') {
        console.info('[email:console]', {
          to: message.to,
          subject: message.subject,
          messageId: info.messageId,
          preview: message.text ?? message.html.slice(0, 200),
        });
      }
    },
  };
}

export async function registerMailer(app: FastifyInstance) {
  const mailer = createMailer();
  app.decorate('mailer', mailer);
}

declare module 'fastify' {
  interface FastifyInstance {
    mailer: ReturnType<typeof createMailer>;
  }
}
