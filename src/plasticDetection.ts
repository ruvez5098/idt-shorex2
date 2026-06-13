/**
 * plasticDetection.ts  —  SHOREX Beach Waste AI  v4
 * ────────────────────────────────────────────────────────────────────────────
 * Pipeline:
 *
 *  Stage 1 — COCO-SSD (MobileNetV2) detects all 90 COCO classes in the frame.
 *             Classes that map to waste are kept; all others are dropped.
 *             COCO label → SHOREX waste label mapping is the primary classifier.
 *
 *  Stage 2 — Colour-based material annotator. Reads the bbox crop colour and
 *             adds a `material` and `subClass` hint. It NEVER overrides Stage 1
 *             class — only supplements with extra detail.
 *
 *  Post-processing:
 *    • IoU-based NMS (threshold 0.50) removes overlapping same-class boxes.
 *    • Confidence filter (user threshold) applied after NMS.
 *    • Temporal smoother (centre-distance across 4 frames) reduces flicker
 *      without suppressing real detections.
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

// ── Public types ──────────────────────────────────────────────────────────────
export interface Detection {
  class: string;
  subClass?: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h] pixels
  material?: string;
}

// ── 18-class SHOREX waste taxonomy ───────────────────────────────────────────
export const WASTE_CLASSES = [
  "PET Plastic Bottle",
  "HDPE Container",
  "Plastic Bag / Film",
  "Polystyrene / EPS Foam",
  "Fishing Net / Ghost Gear",
  "Plastic Cup / Lid",
  "Food Wrapper / Crisp Packet",
  "Straw / Stirrer",
  "Plastic Utensil",
  "Cigarette Butt / Tobacco",
  "Glass Bottle / Jar",
  "Aluminium Can / Tin",
  "Tyre / Rubber Debris",
  "Electronic Waste",
  "Clothing / Textile",
  "Medical / PPE Waste",
  "Plastic Container / Tub",
  "Mixed / General Debris",
] as const;

export type WasteClass = typeof WASTE_CLASSES[number];

// ── Material resin codes ──────────────────────────────────────────────────────
const MATERIAL_MAP: Record<string, string> = {
  "PET Plastic Bottle":          "PET (#1)",
  "HDPE Container":              "HDPE (#2)",
  "Plastic Bag / Film":          "LDPE (#4)",
  "Polystyrene / EPS Foam":      "PS (#6) / EPS",
  "Fishing Net / Ghost Gear":    "PP (#5)",
  "Plastic Cup / Lid":           "PP (#5) / PS (#6)",
  "Food Wrapper / Crisp Packet": "Multi-layer",
  "Straw / Stirrer":             "PS (#6) / PP (#5)",
  "Plastic Utensil":             "PP (#5)",
  "Cigarette Butt / Tobacco":    "Cellulose Acetate",
  "Glass Bottle / Jar":          "Glass",
  "Aluminium Can / Tin":         "Aluminium",
  "Tyre / Rubber Debris":        "Synthetic Rubber",
  "Electronic Waste":            "Mixed polymers",
  "Clothing / Textile":          "PET / Nylon",
  "Medical / PPE Waste":         "PP (#5) / PE",
  "Plastic Container / Tub":     "PP (#5) / HDPE (#2)",
  "Mixed / General Debris":      "Unknown",
};

// ── COCO-90 → SHOREX waste label mapping ─────────────────────────────────────
// Only maps classes that genuinely appear as waste on beaches / in the wild.
// Non-waste items (person, dog, chair, car, etc.) are intentionally excluded
// to avoid false positives.
const COCO_TO_WASTE: Record<string, WasteClass> = {
  // Bottles / containers
  "bottle":    "PET Plastic Bottle",
  "wine glass":"PET Plastic Bottle",
  "cup":       "Plastic Cup / Lid",
  "bowl":      "Plastic Container / Tub",
  "vase":      "Plastic Container / Tub",

  // Bags
  "handbag":   "Plastic Bag / Film",
  "backpack":  "Plastic Bag / Film",
  "suitcase":  "Plastic Container / Tub",

  // Utensils
  "fork":      "Plastic Utensil",
  "knife":     "Plastic Utensil",
  "spoon":     "Plastic Utensil",
  "toothbrush":"Plastic Utensil",
  "scissors":  "Plastic Utensil",

  // Food wrappers (detected as food by COCO — the container is the waste)
  "hot dog":   "Food Wrapper / Crisp Packet",
  "pizza":     "Food Wrapper / Crisp Packet",
  "sandwich":  "Food Wrapper / Crisp Packet",
  "cake":      "Plastic Container / Tub",

  // Electronics
  "cell phone":"Electronic Waste",
  "remote":    "Electronic Waste",
  "keyboard":  "Electronic Waste",
  "mouse":     "Electronic Waste",
  "hair drier":"Electronic Waste",
  "clock":     "Electronic Waste",

  // Kite / sports items (often plastic film)
  "kite":      "Plastic Bag / Film",
  "frisbee":   "Plastic Container / Tub",

  // Fishing / marine debris
  "boat":      "Fishing Net / Ghost Gear",

  // Misc debris
  "umbrella":  "Clothing / Textile",
  "teddy bear":"Clothing / Textile",
  "book":      "Mixed / General Debris",
  "sports ball":"Mixed / General Debris",
  "skateboard":"Mixed / General Debris",
  "surfboard": "Mixed / General Debris",
};

// ── IoU helper ────────────────────────────────────────────────────────────────
function iou(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const ax2 = a[0] + a[2], ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2], by2 = b[1] + b[3];
  const ix1 = Math.max(a[0], b[0]), iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2),   iy2 = Math.min(ay2, by2);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  return inter / (a[2] * a[3] + b[2] * b[3] - inter);
}

// ── NMS — removes overlapping boxes of the SAME class ────────────────────────
function nms(dets: Detection[], iouThreshold = 0.50): Detection[] {
  // Group by class, apply NMS within each class independently
  const byClass: Record<string, Detection[]> = {};
  for (const d of dets) {
    if (!byClass[d.class]) byClass[d.class] = [];
    byClass[d.class].push(d);
  }

  const keep: Detection[] = [];
  for (const cls of Object.keys(byClass)) {
    const sorted = [...byClass[cls]].sort((a, b) => b.confidence - a.confidence);
    const suppressed = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
      if (suppressed.has(i)) continue;
      keep.push(sorted[i]);
      for (let j = i + 1; j < sorted.length; j++) {
        if (iou(sorted[i].bbox, sorted[j].bbox) > iouThreshold) {
          suppressed.add(j);
        }
      }
    }
  }
  return keep;
}

// ── Bbox centre (normalised 0..1) ─────────────────────────────────────────────
function bboxCentre(
  bbox: [number, number, number, number],
  vw: number, vh: number
): [number, number] {
  return [(bbox[0] + bbox[2] / 2) / vw, (bbox[1] + bbox[3] / 2) / vh];
}

// ── Temporal smoother — 4-frame centre-distance buffer ───────────────────────
// Uses normalised centre-point distance instead of IoU so it works even when
// COCO-SSD bbox edges shift between frames.
interface FrameEntry { class: string; centre: [number, number]; det: Detection }
const frameBuffer: FrameEntry[][] = [];
const BUFFER_SIZE  = 4;
const SMOOTH_DIST  = 0.15; // max normalised centre distance to match same object
const MIN_CONFIRM  = 2;    // must appear in at least 2 of last 4 frames

export function resetFrameBuffer(): void {
  frameBuffer.length = 0;
}

function smoothDetections(
  current: Detection[],
  vw: number,
  vh: number
): Detection[] {
  const entries: FrameEntry[] = current.map(d => ({
    class:  d.class,
    centre: bboxCentre(d.bbox, vw, vh),
    det:    d,
  }));

  frameBuffer.push(entries);
  if (frameBuffer.length > BUFFER_SIZE) frameBuffer.shift();

  // First 2 frames — not enough history, pass through immediately
  if (frameBuffer.length < MIN_CONFIRM) return current;

  const confirmed: Detection[] = [];
  for (const e of entries) {
    // Count how many past frames contain a detection close enough to this one
    const appearances = frameBuffer.filter(frame =>
      frame.some(f => {
        if (f.class !== e.class) return false;
        const dx = f.centre[0] - e.centre[0];
        const dy = f.centre[1] - e.centre[1];
        return Math.sqrt(dx * dx + dy * dy) <= SMOOTH_DIST;
      })
    ).length;

    if (appearances >= MIN_CONFIRM) {
      confirmed.push(e.det);
    }
  }

  // If the smoother suppressed everything (camera moved suddenly), pass through
  return confirmed.length > 0 ? confirmed : current;
}

// ── Stage 2: Material annotator ───────────────────────────────────────────────
// Reads the mean colour of the bbox crop and adds material/subClass metadata.
// NEVER changes det.class — only annotates.
interface ColourProfile { label: string; r: number; g: number; b: number }

const COLOUR_PROFILES: ColourProfile[] = [
  { label: "Clear / transparent (PET)",  r: 0.88, g: 0.92, b: 0.96 },
  { label: "White / opaque (HDPE/PP)",   r: 0.92, g: 0.92, b: 0.92 },
  { label: "Bright white (EPS foam)",    r: 0.97, g: 0.97, b: 0.97 },
  { label: "Metallic / foil",            r: 0.80, g: 0.78, b: 0.72 },
  { label: "Dark / black (rubber/tyre)", r: 0.14, g: 0.14, b: 0.14 },
  { label: "Silver (aluminium)",         r: 0.83, g: 0.83, b: 0.86 },
  { label: "Green / tinted (glass)",     r: 0.38, g: 0.62, b: 0.38 },
  { label: "Beige / tan (fabric)",       r: 0.70, g: 0.62, b: 0.50 },
  { label: "Coloured plastic (PP/PS)",   r: 0.72, g: 0.55, b: 0.35 },
  { label: "Translucent film (LDPE)",    r: 0.80, g: 0.83, b: 0.86 },
];

let regionModel: tf.Sequential | null = null;

async function buildRegionClassifier(): Promise<tf.Sequential> {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [3], units: 32, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.1 }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: COLOUR_PROFILES.length, activation: "softmax" }));
  model.compile({ optimizer: tf.train.adam(0.005), loss: "categoricalCrossentropy" });

  const xs = tf.tensor2d(COLOUR_PROFILES.map(p => [p.r, p.g, p.b]));
  const ys = tf.oneHot(
    tf.tensor1d(COLOUR_PROFILES.map((_, i) => i), "int32"),
    COLOUR_PROFILES.length
  );
  await model.fit(xs, ys, { epochs: 120, verbose: 0 });
  xs.dispose();
  ys.dispose();
  return model as tf.Sequential;
}

// Annotate a detection with colour-derived material label (does NOT change class)
function annotateMaterial(
  video: HTMLVideoElement,
  det: Detection
): Detection {
  if (!regionModel) return det;

  const [bx, by, bw, bh] = det.bbox;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (bw < 12 || bh < 12 || vw === 0 || vh === 0) return det;

  // Sample the inner 40% of the bbox to avoid background contamination
  const sx = Math.max(0, Math.floor(bx + bw * 0.30));
  const sy = Math.max(0, Math.floor(by + bh * 0.30));
  const sw = Math.max(1, Math.floor(bw * 0.40));
  const sh = Math.max(1, Math.floor(bh * 0.40));

  // Clamp to video bounds
  const clampedW = Math.min(sw, vw - sx);
  const clampedH = Math.min(sh, vh - sy);
  if (clampedW <= 0 || clampedH <= 0) return det;

  const offscreen = document.createElement("canvas");
  offscreen.width  = clampedW;
  offscreen.height = clampedH;
  // willReadFrequently keeps this canvas CPU-side — avoids WebGL context conflict
  const octx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!octx) return det;

  try {
    octx.drawImage(video, sx, sy, clampedW, clampedH, 0, 0, clampedW, clampedH);
  } catch {
    return det;
  }

  let pxData: Uint8ClampedArray;
  try {
    pxData = octx.getImageData(0, 0, clampedW, clampedH).data;
  } catch {
    return det;
  }

  let sumR = 0, sumG = 0, sumB = 0;
  const n = pxData.length / 4;
  if (n === 0) return det;

  for (let i = 0; i < pxData.length; i += 4) {
    sumR += pxData[i];
    sumG += pxData[i + 1];
    sumB += pxData[i + 2];
  }
  const rN = sumR / n / 255;
  const gN = sumG / n / 255;
  const bN = sumB / n / 255;

  // Inference — pure TF, no DOM ops
  const materialLabel = tf.tidy(() => {
    const input = tf.tensor2d([[rN, gN, bN]]);
    const pred  = (regionModel!.predict(input) as tf.Tensor).dataSync();
    const maxIdx = Array.from(pred).indexOf(Math.max(...Array.from(pred)));
    return COLOUR_PROFILES[maxIdx]?.label ?? null;
  });

  if (!materialLabel) return det;

  // Keep Stage 1 class, only add/update material annotation
  return {
    ...det,
    material: MATERIAL_MAP[det.class] ?? materialLabel,
    subClass: materialLabel,
  };
}

// ── Model state ───────────────────────────────────────────────────────────────
let cocoModel: any  = null;
let modelLoaded     = false;
let modelLoading    = false;

export function isModelLoaded(): boolean { return modelLoaded; }

// ── Load models ───────────────────────────────────────────────────────────────
export async function loadModel(): Promise<void> {
  if (modelLoaded || modelLoading) return;
  modelLoading = true;

  // Reset frame buffer on each new model load (new camera session)
  resetFrameBuffer();

  // TF.js backend: WebGL → CPU fallback
  try {
    await tf.setBackend("webgl");
    await tf.ready();
    console.info("[PlasticAI] WebGL backend active");
  } catch {
    try {
      await tf.setBackend("cpu");
      await tf.ready();
      console.warn("[PlasticAI] CPU backend (WebGL unavailable)");
    } catch (err) {
      modelLoading = false;
      throw new Error("TF.js init failed: " + (err as any)?.message);
    }
  }

  // Stage 1: COCO-SSD
  try {
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    cocoModel = await cocoSsd.load({ base: "mobilenet_v2" });
    console.info("[PlasticAI] Stage 1 — COCO-SSD loaded");
  } catch (err) {
    modelLoading = false;
    throw new Error("COCO-SSD failed: " + (err as any)?.message);
  }

  // Stage 2: Material annotator (non-fatal if it fails)
  try {
    regionModel = await buildRegionClassifier();
    console.info("[PlasticAI] Stage 2 — Material annotator ready");
  } catch (err) {
    console.warn("[PlasticAI] Stage 2 skipped:", (err as any)?.message);
  }

  modelLoaded  = true;
  modelLoading = false;
  console.info("[PlasticAI] ✓ Pipeline ready");
}

// ── Main inference ────────────────────────────────────────────────────────────
export async function detectFrame(
  video: HTMLVideoElement,
  confidenceThreshold = 0.40
): Promise<Detection[]> {
  if (!modelLoaded || !cocoModel) return [];
  if (video.readyState < 2 || video.videoWidth === 0) return [];

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  try {
    // Stage 1: COCO-SSD
    // Request up to 20 objects. Use confidenceThreshold directly as pre-filter
    // (no -0.10 offset — that was creating false positives)
    const raw: Array<{ class: string; score: number; bbox: number[] }> =
      await cocoModel.detect(video, 20, Math.max(0.25, confidenceThreshold));

    // Map to waste classes — drop anything not in COCO_TO_WASTE
    const stage1: Detection[] = raw
      .filter(p => COCO_TO_WASTE[p.class] !== undefined)
      .map(p => ({
        class:      COCO_TO_WASTE[p.class] as string,
        confidence: p.score,
        bbox:       p.bbox as [number, number, number, number],
        material:   MATERIAL_MAP[COCO_TO_WASTE[p.class]] ?? "Unknown",
      }));

    if (stage1.length === 0) {
      // Still push an empty frame so the temporal smoother doesn't stall
      smoothDetections([], vw, vh);
      return [];
    }

    // NMS — suppress overlapping boxes of same class
    const deduped = nms(stage1, 0.50);

    // Stage 2: annotate material without changing class
    const annotated: Detection[] = deduped.map(det =>
      annotateMaterial(video, det)
    );

    // Final confidence filter
    const filtered = annotated.filter(d => d.confidence >= confidenceThreshold);

    // Temporal smoothing — requires ≥2 of last 4 frames to confirm
    return smoothDetections(filtered, vw, vh);

  } catch (err) {
    console.error("[PlasticAI] Inference error:", err);
    return [];
  }
}

// ── Draw detections ───────────────────────────────────────────────────────────
export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  videoWidth: number,
  videoHeight: number
): void {
  if (detections.length === 0) return;

  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  // Guard: don't draw if video dimensions are unknown
  if (videoWidth === 0 || videoHeight === 0) return;

  const sx = cw / videoWidth;
  const sy = ch / videoHeight;

  const CLASS_COLOR: Record<string, string> = {
    "PET Plastic Bottle":          "#38debb",
    "HDPE Container":              "#5ffbd6",
    "Plastic Bag / Film":          "#a78bfa",
    "Polystyrene / EPS Foam":      "#e0e0e0",
    "Fishing Net / Ghost Gear":    "#9ff5b8",
    "Plastic Cup / Lid":           "#f4d35e",
    "Food Wrapper / Crisp Packet": "#ffb86b",
    "Straw / Stirrer":             "#ff9f43",
    "Plastic Utensil":             "#74b9ff",
    "Cigarette Butt / Tobacco":    "#b2bec3",
    "Glass Bottle / Jar":          "#81ecec",
    "Aluminium Can / Tin":         "#dfe6e9",
    "Tyre / Rubber Debris":        "#636e72",
    "Electronic Waste":            "#fdcb6e",
    "Clothing / Textile":          "#e17055",
    "Medical / PPE Waste":         "#ff7675",
    "Plastic Container / Tub":     "#00b894",
    "Mixed / General Debris":      "#fd79a8",
  };

  ctx.save();

  for (const det of detections) {
    const [bx, by, bw, bh] = det.bbox;

    // Clamp scaled coords to canvas bounds
    const x = Math.max(0, bx * sx);
    const y = Math.max(0, by * sy);
    const w = Math.min(bw * sx, cw - x);
    const h = Math.min(bh * sy, ch - y);

    if (w <= 0 || h <= 0) continue;

    const color = CLASS_COLOR[det.class] ?? "#38debb";
    const conf  = det.confidence;

    // Glow border
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 16;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);

    // Corner brackets
    ctx.shadowBlur = 0;
    ctx.lineWidth  = 3;
    const t = Math.min(w, h) * 0.18;
    const corners: [number, number, number, number][] = [
      [x,     y,     t,  t],
      [x + w, y,    -t,  t],
      [x,     y + h, t, -t],
      [x + w, y + h,-t, -t],
    ];
    for (const [px, py, dx, dy] of corners) {
      ctx.shadowColor = color;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.moveTo(px + dx, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + dy);
      ctx.stroke();
    }

    // Label pill
    ctx.shadowBlur = 0;
    ctx.font = "bold 12px Inter, monospace";
    const pct     = Math.round(conf * 100);
    const mainLbl = `${det.class}  ${pct}%`;
    const subLbl  = det.material ?? "";
    const lw = Math.max(
      ctx.measureText(mainLbl).width,
      subLbl ? ctx.measureText(subLbl).width : 0
    ) + 22;
    const lh  = subLbl ? 40 : 26;
    // Position label above bbox, or below if no room above
    const lx  = Math.max(0, Math.min(x, cw - lw));
    const ly  = y > lh + 6 ? y - lh - 4 : Math.min(y + h + 4, ch - lh);

    // Pill background
    ctx.fillStyle = "rgba(2,11,24,0.90)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 5);
    ctx.fill();

    // Confidence stripe
    const stripeColor = conf >= 0.75 ? "#22c55e" : conf >= 0.55 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = stripeColor;
    ctx.fillRect(lx, ly, 3, lh);

    // Label text
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 2;
    ctx.fillText(mainLbl, lx + 10, ly + 16);

    if (subLbl) {
      ctx.shadowBlur = 0;
      ctx.fillStyle  = "rgba(255,255,255,0.50)";
      ctx.font       = "10px Inter, monospace";
      ctx.fillText(subLbl, lx + 10, ly + 31);
    }
  }

  ctx.restore();
}
