import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFaces } from '@/lib/face-detect';
import { emitProctorEvent, reportLocation } from '@/lib/proctor-emit';
import type { ProctoringPolicy } from '@/lib/proctoring-policy';

export interface AdvancedProctorStatus {
  webcamActive: boolean;
  micActive: boolean;
  screenActive: boolean;
  faceCount: number;
  voiceLevel: number;
  geoGranted: boolean | null;
  error: string | null;
  engine: string | null;
}

const IDLE_STATUS: AdvancedProctorStatus = {
  webcamActive: false,
  micActive: false,
  screenActive: false,
  faceCount: 0,
  voiceLevel: 0,
  geoGranted: null,
  error: null,
  engine: null,
};

export function useAdvancedProctoring(
  attemptId: string | undefined,
  policy: ProctoringPolicy | undefined,
  enabled: boolean,
) {
  const [status, setStatus] = useState<AdvancedProctorStatus>(IDLE_STATUS);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamsRef = useRef<{ cam?: MediaStream; screen?: MediaStream }>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const missingSinceRef = useRef<number | null>(null);
  const multiSinceRef = useRef<number | null>(null);
  const voiceSinceRef = useRef<number | null>(null);
  const geoWatchRef = useRef<number | null>(null);

  const stopAll = useCallback(() => {
    streamsRef.current.cam?.getTracks().forEach((t) => t.stop());
    streamsRef.current.screen?.getTracks().forEach((t) => t.stop());
    streamsRef.current = {};
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus(IDLE_STATUS);
  }, []);

  const start = useCallback(async () => {
    if (!attemptId || !policy) return;
    setStatus((s) => ({ ...s, error: null }));

    try {
      let camStream: MediaStream | undefined;
      if (policy.webcam || policy.faceDetection) {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamsRef.current.cam = camStream;
        const attach = () => {
          if (videoRef.current && camStream) {
            videoRef.current.srcObject = camStream;
            void videoRef.current.play().catch(() => undefined);
          }
        };
        attach();
        // Retry attach once UI preview mounts after consent
        window.setTimeout(attach, 100);
        window.setTimeout(attach, 500);
      }

      if (policy.microphone || policy.voiceDetection) {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Merge audio tracks onto cam stream for lifecycle, or keep separate
        if (camStream) {
          mic.getAudioTracks().forEach((t) => camStream!.addTrack(t));
        } else {
          streamsRef.current.cam = mic;
        }
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(mic);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        const voiceLoop = () => {
          if (!audioCtxRef.current) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setStatus((s) => ({ ...s, voiceLevel: rms, micActive: true }));
          if (policy.voiceDetection && rms > 0.08) {
            const now = Date.now();
            if (!voiceSinceRef.current) voiceSinceRef.current = now;
            else if (now - voiceSinceRef.current > 1500) {
              void emitProctorEvent(attemptId, 'VOICE_DETECTED', 7, { rms }, 20_000);
              voiceSinceRef.current = now;
            }
          } else {
            voiceSinceRef.current = null;
          }
          requestAnimationFrame(voiceLoop);
        };
        requestAnimationFrame(voiceLoop);
      }

      if (policy.screenShare) {
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
          streamsRef.current.screen = screen;
          screen.getVideoTracks()[0]?.addEventListener('ended', () => {
            setStatus((s) => ({ ...s, screenActive: false }));
            void emitProctorEvent(attemptId, 'SCREEN_CAPTURE', 9, { reason: 'share_ended' }, 5_000);
            if (policy.screenShareRequired) {
              void emitProctorEvent(
                attemptId,
                'CUSTOM',
                9,
                { reason: 'screen_share_required_lost' },
                5_000,
              );
            }
          });
          setStatus((s) => ({ ...s, screenActive: true }));
        } catch (e) {
          if (policy.screenShareRequired) {
            throw e instanceof Error ? e : new Error('Screen share required');
          }
        }
      }

      if (policy.geolocation && 'geolocation' in navigator) {
        geoWatchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setStatus((s) => ({ ...s, geoGranted: true }));
            void reportLocation(attemptId, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          () => setStatus((s) => ({ ...s, geoGranted: false })),
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
        );
      }

      setStatus((s) => ({
        ...s,
        webcamActive: !!streamsRef.current.cam?.getVideoTracks().length,
        micActive: !!streamsRef.current.cam?.getAudioTracks().length || !!audioCtxRef.current,
      }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Failed to start proctoring media',
      }));
      stopAll();
      throw e;
    }
  }, [attemptId, policy, stopAll]);

  // Face detection loop
  useEffect(() => {
    if (!enabled || !attemptId || !policy?.faceDetection) return;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && !video.paused) {
        const result = await detectFaces(video, canvas);
        if (cancelled) return;
        setStatus((s) => ({ ...s, faceCount: result.count, engine: result.engine }));
        const now = Date.now();
        if (result.count === 0) {
          if (!missingSinceRef.current) missingSinceRef.current = now;
          else if (now - missingSinceRef.current > 4000) {
            void emitProctorEvent(attemptId, 'FACE_MISSING', 8, { engine: result.engine }, 15_000);
            missingSinceRef.current = now;
          }
          multiSinceRef.current = null;
        } else if (policy.multiFace && result.count >= 2) {
          missingSinceRef.current = null;
          if (!multiSinceRef.current) multiSinceRef.current = now;
          else if (now - multiSinceRef.current > 2500) {
            void emitProctorEvent(
              attemptId,
              'MULTIPLE_FACES',
              9,
              { count: result.count, engine: result.engine },
              12_000,
            );
            multiSinceRef.current = now;
          }
        } else {
          missingSinceRef.current = null;
          multiSinceRef.current = null;
        }
      }
      timer = window.setTimeout(() => void tick(), 1500);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, attemptId, policy?.faceDetection, policy?.multiFace]);

  useEffect(() => {
    if (!enabled) {
      stopAll();
    }
    return () => stopAll();
  }, [enabled, stopAll]);

  return { status, videoRef, canvasRef, start, stop: stopAll };
}
