import { useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/api';
import { emitProctorEvent } from '@/lib/proctor-emit';

type BasicEvent =
  | 'FULLSCREEN_EXIT'
  | 'TAB_SWITCH'
  | 'CLIPBOARD_COPY'
  | 'CLIPBOARD_PASTE'
  | 'RIGHT_CLICK'
  | 'FOCUS_LOST'
  | 'FOCUS_GAINED';

export function useProctoringGuards(attemptId: string | undefined, enabled = true) {
  useEffect(() => {
    if (!attemptId || !enabled) return;

    const emit = (type: BasicEvent, severity: number) => {
      void emitProctorEvent(
        attemptId,
        type,
        severity,
        undefined,
        type.includes('FOCUS') ? 4_000 : 6_000,
      );
    };

    const onVisibility = () => {
      emit(document.hidden ? 'TAB_SWITCH' : 'FOCUS_GAINED', document.hidden ? 8 : 1);
    };
    const onBlur = () => emit('FOCUS_LOST', 4);
    const onFocus = () => emit('FOCUS_GAINED', 1);
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      emit('CLIPBOARD_COPY', 6);
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      emit('CLIPBOARD_PASTE', 10);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      emit('RIGHT_CLICK', 2);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) emit('FULLSCREEN_EXIT', 5);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('fullscreenchange', onFullscreen);

    void document.documentElement.requestFullscreen?.().catch(() => undefined);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [attemptId, enabled]);
}

export function useExamCountdownSocket(
  attemptId: string | undefined,
  examSessionId: string | undefined,
  onCountdown: (seconds: number) => void,
  onAutoSubmit: () => void,
) {
  const onCountdownRef = useRef(onCountdown);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onCountdownRef.current = onCountdown;
  onAutoSubmitRef.current = onAutoSubmit;

  useEffect(() => {
    if (!attemptId) return;
    const token = getAccessToken();
    const params = new URLSearchParams({
      attemptId,
      role: 'candidate',
    });
    if (token) params.set('token', token);
    if (examSessionId) params.set('examSessionId', examSessionId);

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws?${params.toString()}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type: string;
          remainingSeconds?: number;
        };
        if (msg.type === 'countdown' && typeof msg.remainingSeconds === 'number') {
          onCountdownRef.current(msg.remainingSeconds);
        }
        if (msg.type === 'auto_submit') {
          onAutoSubmitRef.current();
        }
      } catch {
        /* ignore */
      }
    };

    const heartbeat = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      ws.close();
    };
  }, [attemptId, examSessionId]);
}
