import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

type CacheEntry = { value: string; expiresAt: number };

/** In-process pub/sub + TTL cache (replaces Redis for single-node deploys). */
export class MemoryBus {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async publish(channel: string, message: string): Promise<number> {
    this.emitter.emit('message', channel, message);
    this.emitter.emit(`channel:${channel}`, message);
    return 1;
  }

  duplicate(): MemorySubscriber {
    return new MemorySubscriber(this.emitter);
  }

  async quit(): Promise<'OK'> {
    this.cache.clear();
    this.emitter.removeAllListeners();
    return 'OK';
  }
}

export class MemorySubscriber {
  private patterns: string[] = [];
  private handler: ((pattern: string, channel: string, message: string) => void) | null =
    null;
  private readonly onMessage: (channel: string, message: string) => void;

  constructor(private readonly emitter: EventEmitter) {
    this.onMessage = (channel: string, message: string) => {
      if (!this.handler) return;
      for (const pattern of this.patterns) {
        if (matchRedisPattern(pattern, channel)) {
          this.handler(pattern, channel, message);
        }
      }
    };
    this.emitter.on('message', this.onMessage);
  }

  async psubscribe(...patterns: string[]): Promise<void> {
    this.patterns.push(...patterns);
  }

  on(
    _event: 'pmessage',
    listener: (pattern: string, channel: string, message: string) => void,
  ): void {
    this.handler = listener;
  }

  async quit(): Promise<'OK'> {
    this.emitter.off('message', this.onMessage);
    this.handler = null;
    this.patterns = [];
    return 'OK';
  }
}

function matchRedisPattern(pattern: string, channel: string): boolean {
  // Support Redis-style `*` wildcards used by psubscribe.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(channel);
}

export interface JobQueue {
  add(
    name: string,
    data: unknown,
    opts?: { attempts?: number },
  ): Promise<{ id: string }>;
  close(): Promise<void>;
}

export type JobHandler = (name: string, data: unknown) => Promise<void>;

export function createMemoryQueue(handler: JobHandler): JobQueue {
  return {
    async add(name, data) {
      const id = randomUUID();
      setImmediate(() => {
        void handler(name, data).catch((err) => {
          console.error(`[queue] job ${name} failed`, err);
        });
      });
      return { id };
    },
    async close() {
      /* no-op */
    },
  };
}
