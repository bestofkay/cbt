import { api } from '@/lib/api';
import type { ProctorEventType } from '@/lib/proctoring-policy';

const lastEmit = new Map<string, number>();

export async function emitProctorEvent(
  attemptId: string,
  type: ProctorEventType,
  severity = 1,
  payload?: unknown,
  minIntervalMs = 8_000,
) {
  const key = `${attemptId}:${type}`;
  const now = Date.now();
  const prev = lastEmit.get(key) ?? 0;
  if (now - prev < minIntervalMs) return;
  lastEmit.set(key, now);
  try {
    await api.post('/api/v1/proctoring/events', {
      attemptId,
      type,
      severity,
      payload,
      clientTimestamp: new Date().toISOString(),
    });
  } catch {
    /* best-effort during exam */
  }
}

export async function reportLocation(
  attemptId: string,
  coords: { latitude: number; longitude: number; accuracy?: number },
) {
  try {
    await api.post('/api/v1/proctoring/location', {
      attemptId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
    });
  } catch {
    /* best-effort */
  }
}
