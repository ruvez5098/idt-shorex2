// plasticDetection.ts
// Drop-in replacement. Adds IoU-based multi-object tracking with persistent IDs.
// Zero changes required in any other file.

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface TrackedDetection extends Detection {
  trackId: number;
  smoothBbox: [number, number, number, number]; // interpolated for smooth rendering
  age: number; // frames this track has been alive
  missedFrames: number;
}

// ─── Tracker config ───────────────────────────────────────────────────────────
const IOU_THRESHOLD = 0.35;       // min overlap to consider same object
const MAX_MISSED_FRAMES = 6;      // drop track after N consecutive misses
const SMOOTHING_ALPHA = 0.55;     // bbox interpolation (0=frozen, 1=snap)
const MIN_CONFIDENCE = 0.4;

// ─── Internal tracker state ───────────────────────────────────────────────────
let nextTrackId = 1;
let activeTracks: TrackedDetection[] = [];

// ─── Model state ─────────────────────────────────────────────────────────────
let model: tf.LayersModel | tf.GraphModel | null = null;
let cocoModel: any = null;
let isLoadingModel = false;
let usingFallback = false;

// ─── COCO → plastic label map ─────────────────────────────────────────────────
const COCO_TO_PLASTIC: Record<string, string> = {
  bottle: "plastic bottle",
  cup: "plastic cup",
  bowl: "plastic container",
  handbag: "plastic bag",
  backpack: "plastic bag",
  "cell phone": "electronic plastic",
  remote: "electronic plastic",
  fork: "plastic utensil",
  knife: "plastic utensil",
  spoon: "plastic utensil",
};

// ─── IoU calculation ─────────────────────────────────────────────────────────
function iou(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];

  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  if (ix2 < ix1 || iy2 < iy1) return 0;

  const intersection = (ix2 - ix1) * (iy2 - iy1);
  const aArea = a[2] * a[3];
  const bArea = b[2] * b[3];
  const union = aArea + bArea - intersection;

  return union <= 0 ? 0 : intersection / union;
}

// ─── Core tracker: match detections → existing tracks ────────────────────────
export function updateTracks(detections: Detection[]): TrackedDetection[] {
  const matched = new Set<number>(); // indices in detections already assigned
  const updatedTracks: TrackedDetection[] = [];

  // 1. Try to match each active track to a new detection
  for (const track of activeTracks) {
    let bestIou = IOU_THRESHOLD;
    let bestIdx = -1;

    for (let i = 0; i < detections.length; i++) {
      if (matched.has(i)) continue;
      const score = iou(track.smoothBbox, detections[i].bbox);
      if (score > bestIou) {
        bestIou = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      // Matched — update track with smooth interpolation
      const det = detections[bestIdx];
      matched.add(bestIdx);

      const smooth: [number, number, number, number] = [
        track.smoothBbox[0] + SMOOTHING_ALPHA * (det.bbox[0] - track.smoothBbox[0]),
        track.smoothBbox[1] + SMOOTHING_ALPHA * (det.bbox[1] - track.smoothBbox[1]),
        track.smoothBbox[2] + SMOOTHING_ALPHA * (det.bbox[2] - track.smoothBbox[2]),
        track.smoothBbox[3] + SMOOTHING_ALPHA * (det.bbox[3] - track.smoothBbox[3]),
      ];

      updatedTracks.push({
        ...det,
        trackId: track.trackId,
        smoothBbox: smooth,
        age: track.age + 1,
        missedFrames: 0,
      });
    } else {
      // Missed this frame — keep track alive for a few frames
      if (track.missedFrames < MAX_MISSED_FRAMES) {
        updatedTracks.push({
          ...track,
          missedFrames: track.missedFrames + 1,
          age: track.age + 1,
        });
      }
      // else: track dies (not pushed → garbage collected)
    }
  }

  // 2. Spawn new tracks for unmatched detections
  for (let i = 0; i < detections.length; i++) {
    if (!matched.has(i)) {
      const det = detections[i];
      updatedTracks.push({
        ...det,
        trackId: nextTrackId++,
        smoothBbox: [...det.bbox] as [number, number, number, number],
        age: 1,
        missedFrames: 0,
      });
    }
  }

  activeTracks = updatedTracks;
  return updatedTracks.filter((t) => t.missedFrames === 0); // only show confirmed tracks
}

// ─── Reset tracker (call when camera stops) ───────────────────────────────────
export function resetTracker(): void {
  activeTracks = [];
  nextTrackId = 1;
}

// ─── Model loading ────────────────────────────────────────────────────────────
export async function loadModel(): Promise<void> {
  if (model || cocoModel || isLoadingModel) return;
  isLoadingModel = true;

  await tf.setBackend("webgl");
  await tf.ready();

  // Try custom model first (auto-detect Layers vs Graph format)
  const modelPath = "/models/plastic-detection-model.json";
  try {
    try {
      model = await tf.loadLayersModel(modelPath);
      usingFallback = false;
      console.info("[PlasticAI] Loaded Layers model");
    } catch {
      model = await tf.loadGraphModel(modelPath);
      usingFallback = false;
      console.info("[PlasticAI] Loaded Graph model");
    }
  } catch {
    console.warn("[PlasticAI] Custom model not found — falling back to COCO-SSD");
    usingFallback = true;
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    cocoModel = await cocoSsd.load({ base: "mobilenet_v2" });
  }

  isLoadingModel = false;
}

export function isUsingFallback(): boolean {
  return usingFallback;
}

// ─── Run inference on a single frame ─────────────────────────────────────────
export async function detectFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  confidenceThreshold: number = MIN_CONFIDENCE
): Promise<Detection[]> {
  if (!model && !cocoModel) return [];

  try {
    if (cocoModel) {
      return runCocoInference(source, confidenceThreshold);
    }
    return runCustomInference(source, confidenceThreshold);
  } catch (err) {
    console.error("[PlasticAI] Inference error:", err);
    return [];
  }
}

async function runCocoInference(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  threshold: number
): Promise<Detection[]> {
  const predictions = await cocoModel.detect(source, 20, threshold);
  return predictions
    .filter((p: any) => COCO_TO_PLASTIC[p.class])
    .map((p: any) => ({
      class: COCO_TO_PLASTIC[p.class],
      confidence: p.score,
      bbox: p.bbox as [number, number, number, number],
    }));
}

async function runCustomInference(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  threshold: number
): Promise<Detection[]> {
  const tensor = tf.tidy(() => {
    const img = tf.browser.fromPixels(source);
    return img.expandDims(0).toFloat().div(255);
  });

  let output: tf.Tensor | tf.Tensor[];
  try {
    output = (model as any).predict(tensor) as tf.Tensor | tf.Tensor[];
  } finally {
    tensor.dispose();
  }

  // Support both single-output and multi-output models
  const outputArray = Array.isArray(output) ? output : [output];
  const data = await outputArray[0].array() as number[][][];
  outputArray.forEach((t) => t.dispose());

  const detections: Detection[] = [];
  const rows = data[0];

  for (const row of rows) {
    if (!row || row.length < 5) continue;
    const confidence = row[4];
    if (confidence < threshold) continue;

    // Expect [x_center, y_center, width, height, confidence, ...class_scores]
    const x = row[0] - row[2] / 2;
    const y = row[1] - row[3] / 2;
    const w = row[2];
    const h = row[3];

    let className = "plastic";
    if (row.length > 5) {
      const classScores = row.slice(5);
      const maxIdx = classScores.indexOf(Math.max(...classScores));
      const plasticClasses = [
        "plastic bottle", "plastic bag", "plastic cup",
        "plastic container", "plastic utensil", "plastic wrap",
        "styrofoam", "plastic film",
      ];
      className = plasticClasses[maxIdx] ?? "plastic";
    }

    detections.push({ class: className, confidence, bbox: [x, y, w, h] });
  }

  return detections;
}

// ─── Draw tracked detections onto canvas ─────────────────────────────────────
// Uses glowing cyan boxes with persistent track IDs. Call after updateTracks().
export function drawTrackedDetections(
  ctx: CanvasRenderingContext2D,
  tracks: TrackedDetection[],
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const scaleX = canvasWidth / videoWidth;
  const scaleY = canvasHeight / videoHeight;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.font = "bold 13px 'Inter', monospace";

  for (const track of tracks) {
    const [bx, by, bw, bh] = track.smoothBbox;
    const x = bx * scaleX;
    const y = by * scaleY;
    const w = bw * scaleX;
    const h = bh * scaleY;

    const alpha = Math.min(1, track.age / 5); // fade in new tracks

    // Outer glow
    ctx.shadowColor = "#00C2FF";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(0, 194, 255, ${alpha})`;
    ctx.strokeRect(x, y, w, h);

    // Inner sharp line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.lineWidth = 2;

    // Corner ticks (tactical aesthetic)
    const tick = Math.min(w, h) * 0.18;
    ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
    ctx.shadowColor = "#00E5A0";
    ctx.shadowBlur = 8;
    const corners: [number, number, number, number][] = [
      [x, y, tick, tick],
      [x + w - tick, y, -tick, tick],
      [x, y + h - tick, tick, -tick],
      [x + w - tick, y + h - tick, -tick, -tick],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy);
      ctx.stroke();
    }

    // Label background
    ctx.shadowBlur = 0;
    const label = `#${track.trackId} ${track.class} ${Math.round(track.confidence * 100)}%`;
    const labelW = ctx.measureText(label).width + 12;
    const labelH = 22;
    const lx = Math.max(0, Math.min(x, canvasWidth - labelW));
    const ly = y > labelH + 4 ? y - labelH - 4 : y + h + 4;

    ctx.fillStyle = "rgba(2, 11, 24, 0.82)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, labelW, labelH, 4);
    ctx.fill();

    ctx.fillStyle = `rgba(0, 194, 255, ${alpha})`;
    ctx.fillText(label, lx + 6, ly + 15);
  }

  ctx.restore();
}
