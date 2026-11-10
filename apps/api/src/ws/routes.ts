import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Buffer } from 'node:buffer';

interface ClientMeta {
  userId?: string;
  attemptId?: string;
  examSessionId?: string;
  role: 'candidate' | 'proctor' | 'admin';
}

export async function websocketRoutes(app: FastifyInstance) {
  const clients = new Map<WebSocket, ClientMeta>();

  app.get('/ws', { websocket: true }, (socket: WebSocket, request) => {
    const q = request.query as {
      token?: string;
      attemptId?: string;
      examSessionId?: string;
      role?: string;
    };

    let meta: ClientMeta = {
      attemptId: q.attemptId,
      examSessionId: q.examSessionId,
      role: (q.role as ClientMeta['role']) ?? 'candidate',
    };

    if (q.token) {
      try {
        const payload = app.jwt.verify<{ sub: string }>(q.token);
        meta = { ...meta, userId: payload.sub };
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid_token' }));
        socket.close();
        return;
      }
    }

    clients.set(socket, meta);
    socket.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));

    const countdownInterval = setInterval(() => {
      if (meta.attemptId) {
        void (async () => {
          const attempt = await app.prisma.examAttempt.findUnique({
            where: { id: meta.attemptId },
            select: { endsAt: true, status: true },
          });
          if (!attempt?.endsAt) return;
          const remainingSeconds = Math.max(
            0,
            Math.floor((attempt.endsAt.getTime() - Date.now()) / 1000),
          );
          socket.send(
            JSON.stringify({
              type: 'countdown',
              attemptId: meta.attemptId,
              remainingSeconds,
              status: attempt.status,
            }),
          );
          if (remainingSeconds === 0 && attempt.status === 'IN_PROGRESS') {
            await app.prisma.examAttempt.update({
              where: { id: meta.attemptId },
              data: { status: 'AUTO_SUBMITTED', submittedAt: new Date() },
            });
            await app.queues.grading.add('grade-attempt', { attemptId: meta.attemptId });
            socket.send(JSON.stringify({ type: 'auto_submit', attemptId: meta.attemptId }));
          }
        })();
      }
    }, 1000);

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type: string;
          examSessionId?: string;
          payload?: unknown;
        };
        if (msg.type === 'subscribe' && msg.examSessionId) {
          meta.examSessionId = msg.examSessionId;
          clients.set(socket, meta);
        }
        if (msg.type === 'chat' && meta.examSessionId) {
          broadcast(clients, meta.examSessionId, {
            type: 'chat',
            from: meta.userId,
            payload: msg.payload,
            at: new Date().toISOString(),
          });
        }
        if (msg.type === 'heartbeat' && meta.attemptId) {
          void app.prisma.examAttempt.update({
            where: { id: meta.attemptId },
            data: { lastActivityAt: new Date() },
          });
        }
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid_message' }));
      }
    });

    socket.on('close', () => {
      clearInterval(countdownInterval);
      clients.delete(socket);
    });
  });

  const sub = app.redis.duplicate();
  await sub.psubscribe('proctor:session:*', 'announce:*');
  sub.on(
    'pmessage',
    (_pattern: string, channel: string, message: string) => {
      const examSessionId = channel.split(':').pop();
      if (!examSessionId) return;
      broadcast(clients, examSessionId, {
        type: channel.startsWith('announce') ? 'announcement' : 'proctor_event',
        channel,
        payload: JSON.parse(message),
      });
    },
  );

  app.addHook('onClose', async () => {
    await sub.quit();
  });
}

function broadcast(
  clients: Map<WebSocket, ClientMeta>,
  examSessionId: string,
  payload: unknown,
) {
  const data = JSON.stringify(payload);
  for (const [socket, meta] of clients) {
    if (meta.examSessionId === examSessionId && socket.readyState === 1) {
      socket.send(data);
    }
  }
}
