/**
 * Face detection via Chromium FaceDetector API when available.
 * Falls back to a brightness/motion presence heuristic (no multi-face).
 */

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type FaceDetectorCtor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect: (image: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

export async function detectFaces(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<{ count: number; boxes: FaceBox[]; engine: 'facedetector' | 'heuristic' }> {
  if (video.readyState < 2 || video.videoWidth === 0) {
    return { count: 0, boxes: [], engine: 'heuristic' };
  }

  const FaceDetector = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (FaceDetector) {
    try {
      const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      const faces = await detector.detect(video);
      return {
        count: faces.length,
        boxes: faces.map((f) => ({
          x: f.boundingBox.x,
          y: f.boundingBox.y,
          width: f.boundingBox.width,
          height: f.boundingBox.height,
        })),
        engine: 'facedetector',
      };
    } catch {
      /* fall through */
    }
  }

  // Heuristic: sample center region luminance variance — weak presence proxy
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { count: 0, boxes: [], engine: 'heuristic' };
  const w = 64;
  const h = 48;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  let sumSq = 0;
  const n = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  // Dark / flat frame ≈ no face; textured mid-brightness ≈ someone present
  const present = mean > 18 && mean < 240 && variance > 120;
  return {
    count: present ? 1 : 0,
    boxes: present ? [{ x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }] : [],
    engine: 'heuristic',
  };
}
