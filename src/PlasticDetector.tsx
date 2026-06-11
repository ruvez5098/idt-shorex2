// PlasticDetector.tsx
// Drop-in replacement. Implements 60fps-target live tracking loop with
// IoU object persistence. Replaces the old 10-frame-batch approach entirely.

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  loadModel,
  detectFrame,
  updateTracks,
  resetTracker,
  drawTrackedDetections,
  isUsingFallback,
  type TrackedDetection,
} from "./plasticDetection";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScanRecord {
  timestamp: string;
  detections: TrackedDetection[];
  totalItems: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SAVE_INTERVAL_MS = 3000; // save to backend every 3s when detections exist
const DEFAULT_CONFIDENCE = 0.45;

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlasticDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // sonar animation layer
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSaveRef = useRef<number>(0);
  const sonarAngleRef = useRef<number>(0);

  const [isRunning, setIsRunning] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [fps, setFps] = useState(0);
  const [activeTracks, setActiveTracks] = useState<TrackedDetection[]>([]);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);

  // FPS counter
  const fpsRef = useRef({ frames: 0, last: performance.now() });

  // ─── Load model on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setModelLoading(true);
      await loadModel();
      if (!cancelled) {
        setModelReady(true);
        setModelLoading(false);
        setFallbackMode(isUsingFallback());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Sonar animation (runs independently of detection loop) ───────────────
  const drawSonar = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, active: boolean) => {
    ctx.clearRect(0, 0, w, h);
    if (!active) return;

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.42;

    ctx.save();

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 194, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Middle ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 194, 255, 0.12)";
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 194, 255, 0.1)";
    ctx.stroke();

    // Cross hairs
    ctx.strokeStyle = "rgba(0, 194, 255, 0.08)";
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    ctx.setLineDash([]);

    // Sweep gradient
    const sweep = sonarAngleRef.current;
    const gradient = ctx.createConicGradient
      ? null // not universally supported
      : null;

    // Fallback sweep: arc sector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sweep - 0.9, sweep);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 194, 255, 0.12)";
    ctx.fill();

    // Sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
    ctx.strokeStyle = "rgba(0, 194, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00C2FF";
    ctx.fill();

    ctx.restore();

    sonarAngleRef.current = (sweep + 0.04) % (Math.PI * 2);
  }, []);

  // ─── Main detection loop ───────────────────────────────────────────────────
  const runLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!video || !canvas || !overlay || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    const ctx = canvas.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!ctx || !octx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    // Resize canvases to match video
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw; canvas.height = vh;
      overlay.width = vw; overlay.height = vh;
    }

    // Draw video frame
    ctx.drawImage(video, 0, 0, vw, vh);

    // Sonar overlay (always animates)
    drawSonar(octx, vw, vh, true);

    // FPS counter
    const now = performance.now();
    fpsRef.current.frames++;
    if (now - fpsRef.current.last >= 500) {
      setFps(Math.round(fpsRef.current.frames / ((now - fpsRef.current.last) / 1000)));
      fpsRef.current.frames = 0;
      fpsRef.current.last = now;
    }

    // Run inference asynchronously — don't block rAF
    detectFrame(video, confidence).then((rawDetections) => {
      const tracked = updateTracks(rawDetections);
      setActiveTracks(tracked);
      drawTrackedDetections(ctx, tracked, vw, vh, canvas.width, canvas.height);

      // Save to backend periodically
      if (tracked.length > 0 && Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
        lastSaveRef.current = Date.now();
        saveDetections(tracked);
      }
    });

    rafRef.current = requestAnimationFrame(runLoop);
  }, [confidence, drawSonar]);

  // ─── Camera control ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      resetTracker();
      setIsRunning(true);
      rafRef.current = requestAnimationFrame(runLoop);
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access in your browser settings."
        : err?.name === "NotFoundError"
        ? "No camera found on this device."
        : `Camera error: ${err?.message ?? "Unknown error"}`;
      setCameraError(msg);
    }
  }, [runLoop]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    resetTracker();
    setIsRunning(false);
    setActiveTracks([]);
    setFps(0);

    // Clear canvases
    const ctx = canvasRef.current?.getContext("2d");
    const octx = overlayRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    octx?.clearRect(0, 0, overlayRef.current!.width, overlayRef.current!.height);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── Backend save ──────────────────────────────────────────────────────────
  const saveDetections = async (tracks: TrackedDetection[]) => {
    const canvas = canvasRef.current;
    const thumbnail = canvas?.toDataURL("image/jpeg", 0.3).slice(0, 500) ?? "";

    const record: ScanRecord = {
      timestamp: new Date().toISOString(),
      detections: tracks,
      totalItems: tracks.length,
    };

    setHistory((prev) => [record, ...prev].slice(0, 50));

    try {
      await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: thumbnail,
          detections: tracks.map(({ class: c, confidence: conf, smoothBbox }) => ({
            class: c, confidence: conf, bbox: smoothBbox,
          })),
          source: "live-tracking",
        }),
      });
    } catch {
      // Silent fail — tracking continues even if backend is down
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Plastic Detection</h1>
            <p className="text-sm text-slate-400">Real-time IoU tracking with Sonar visualization</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Frame {fps} FPS</p>
            <p className={`text-sm font-semibold ${fallbackMode ? "text-yellow-400" : "text-emerald-400"}`}>
              {fallbackMode ? "Fallback Mode" : modelReady ? "AI Ready" : "Loading..."}
            </p>
          </div>
        </div>

        {/* Error */}
        {cameraError && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/50 p-4 text-red-200 text-sm">
            ⚠ {cameraError}
          </div>
        )}

        {/* Canvas */}
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay playsInline muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ display: isRunning ? "block" : "none" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Confidence: {Math.round(confidence * 100)}%
            </label>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            onClick={isRunning ? stopCamera : startCamera}
            disabled={modelLoading}
            className={`py-2 px-4 rounded-lg font-semibold text-white transition ${
              isRunning
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600 disabled:opacity-50"
            }`}
          >
            {isRunning ? "Stop" : "Start"}
          </button>

          <div className="text-right text-xs text-slate-400 py-2">
            {activeTracks.length} active tracks
          </div>
        </div>

        {/* Track List */}
        {activeTracks.length > 0 && (
          <div className="rounded-lg bg-slate-800 p-4">
            <h3 className="font-semibold text-white mb-2">Active Detections:</h3>
            <div className="space-y-1 text-sm text-slate-300">
              {activeTracks.map((t) => (
                <div key={t.trackId}>
                  ID {t.trackId}: {t.class} ({Math.round(t.confidence * 100)}%)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="rounded-lg bg-slate-800 p-4">
            <h3 className="font-semibold text-white mb-2">Recent Scans:</h3>
            <div className="space-y-2 text-sm text-slate-300">
              {history.slice(0, 5).map((item, i) => (
                <div key={i}>
                  {new Date(item.timestamp).toLocaleTimeString()}: {item.totalItems} items
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer hint */}
        {!modelReady && !modelLoading && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-yellow-200 text-xs">
            ℹ Model loaded in fallback mode. Using COCO-SSD for object detection.
          </div>
        )}
      </div>
    </div>
  );
}
