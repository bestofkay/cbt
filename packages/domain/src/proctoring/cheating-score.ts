export interface ProctorSignal {
  type: string;
  severity: number;
}

const WEIGHTS: Record<string, number> = {
  FULLSCREEN_EXIT: 5,
  TAB_SWITCH: 8,
  DEVTOOLS_OPEN: 15,
  CLIPBOARD_COPY: 6,
  CLIPBOARD_PASTE: 10,
  RIGHT_CLICK: 2,
  SCREEN_CAPTURE: 12,
  FACE_MISSING: 10,
  MULTIPLE_FACES: 20,
  VOICE_DETECTED: 8,
  FOCUS_LOST: 4,
  IP_CHANGE: 15,
  DEVICE_CHANGE: 18,
  VPN_SUSPECTED: 12,
  LOCATION_CHANGE: 10,
  RECONNECT: 3,
};

export function computeCheatingScore(events: ProctorSignal[]): number {
  let score = 0;
  for (const event of events) {
    const base = WEIGHTS[event.type] ?? event.severity * 2;
    score += base * Math.max(1, event.severity);
  }
  return Math.min(100, Math.round(score * 100) / 100);
}

export function shouldAutoFlag(score: number, threshold = 40): boolean {
  return score >= threshold;
}
