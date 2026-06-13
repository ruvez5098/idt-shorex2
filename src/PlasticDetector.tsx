// PlasticDetector.tsx
// Opens device camera, runs COCO-SSD waste detection, shows live stats,
// device history, and a pie chart of detected waste types.

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  loadModel,
  detectFrame,
  drawDetections,
  isModelLoaded,
  resetFrameBuffer,
  type Detection,
} from "./plasticDetection";
import {
  Trash2,
  Activity,
  Camera,
  CameraOff,
  AlertTriangle,
  FlipHorizontal,
  Info,
  PieChart as PieIcon,
  MonitorSmartphone,
  Clock,
  TrendingUp,
  BarChart2,
  ListChecks,
  RefreshCw,
  Scan,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ScanRecord {
  time: string;
  items: Detection[];
  device: string;  // camera label used for this scan
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const DETECT_INTERVAL_MS  = 200;
const SAVE_INTERVAL_MS    = 4000;
const DEFAULT_CONFIDENCE  = 0.40;

// ─── Object tracker constants ─────────────────────────────────────────────────
// Max distance between bbox centres (as fraction of video diagonal) to be
// considered the same object — robust against COCO-SSD bbox jitter
const SAME_OBJECT_DIST_FRAC = 0.18;
// If an object hasn't been seen for this long it's considered gone from frame
const OBJECT_GONE_MS        = 2500;

// Consistent colour per waste class (max 10 classes)
const CLASS_COLORS: Record<string, string> = {
  "Plastic Bottle":     "#38debb",
  "Plastic Bag":        "#5ffbd6",
  "Plastic Cup":        "#f4d35e",
  "Styrofoam / EPS":    "#ffb86b",
  "Fishing Net / Rope": "#9ff5b8",
  "Plastic Wrapper":    "#ff9f43",
  "Glass / Can":        "#74b9ff",
  "Cigarette Butt":     "#b2bec3",
  "Tyre / Rubber":      "#636e72",
  "General Debris":     "#fdcb6e",
};
const FALLBACK_COLORS = ["#38debb","#f4d35e","#ffb86b","#9ff5b8","#74b9ff","#ff9f43","#b2bec3","#fdcb6e"];
function classColor(name: string, idx: number) {
  return CLASS_COLORS[name] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ─── SVG Donut Pie Chart ───────────────────────────────────────────────────────
interface PieSlice { label: string; count: number; color: string }

function DonutChart({ slices, total }: { slices: PieSlice[]; total: number }) {
  const R = 54; // outer radius
  const r = 32; // inner radius (hole)
  const cx = 70, cy = 70;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const paths = slices.map((s, i) => {
    const fraction = s.count / total;
    const dash     = fraction * circumference;
    const gap      = circumference - dash;
    const el = (
      <circle
        key={i}
        cx={cx} cy={cy} r={R}
        fill="none"
        stroke={s.color}
        strokeWidth={R - r}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <svg viewBox="0 0 140 140" className="w-full h-full">
      {/* Track ring */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={R - r} />
      {/* rotate so first slice starts at top */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>{paths}</g>
      {/* Centre label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#5ffbd6" fontSize="18" fontWeight="bold">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">TOTAL</text>
    </svg>
  );
}

// ─── Detectable plastic types (all classes COCO-SSD maps to) ─────────────────
const DETECTABLE_TYPES = [
  { label: "Plastic Bottle",     color: "#38debb" },
  { label: "Plastic Bag",        color: "#a78bfa" },
  { label: "Plastic Cup",        color: "#f472b6" },
  { label: "Plastic Utensil",    color: "#60a5fa" },
  { label: "Plastic Container",  color: "#fb923c" },
  { label: "Electronic Waste",   color: "#facc15" },
  { label: "Plastic Debris",     color: "#34d399" },
  { label: "Plastic/Fabric Waste", color: "#f87171" },
];

// ─── Dashboard + Recent Logs panel (fetches from /api/stats and /api/history) ─
interface ApiStats   { totalScans: number; plasticsDetected: number; accuracy: number }
interface ApiLogItem { id: string; timestamp: string; source: string; totalDetections: number; summary: string }

function DashboardLogs() {
  const [stats, setStats]       = React.useState<ApiStats | null>(null);
  const [logs, setLogs]         = React.useState<ApiLogItem[]>([]);
  const [loading, setLoading]   = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/history"),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) setLogs((await hRes.json()).slice(0, 20));
    } catch { /* backend offline */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const accuracyPct = stats
    ? stats.totalScans > 0
      ? Math.round((stats.plasticsDetected / stats.totalScans) * 100)
      : 0
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Statistics Dashboard ── */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1c32] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Statistics</p>
            <h3 className="text-xl font-black text-white mt-0.5">Dashboard</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary-fixed/10 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-primary-fixed" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-white/5">
            {[
              { label: "TOTAL SCANS",    value: String(stats?.totalScans ?? 0)         },
              { label: "PLASTICS FOUND", value: String(stats?.plasticsDetected ?? 0)   },
              { label: "ACCURACY RATE",  value: `${accuracyPct}%`                      },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                <span className="text-lg font-black text-primary-fixed">{value}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={fetchData}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[11px] font-bold text-slate-400 uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* ── Recent Logs ── */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1c32] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">History</p>
            <h3 className="text-xl font-black text-white mt-0.5">Recent Logs</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary-fixed/10 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-primary-fixed" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-slate-600 text-sm py-4 text-center">No logs yet. Start a scan to record data.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1
            [&::-webkit-scrollbar]:w-[3px]
            [&::-webkit-scrollbar-thumb]:bg-primary-fixed/40
            [&::-webkit-scrollbar-track]:bg-transparent">
            {logs.map((log) => {
              const ts  = new Date(log.timestamp);
              const src = log.source?.toUpperCase() ?? "CAMERA";
              const hasPlastics = log.totalDetections > 0;
              return (
                <div key={log.id}
                  className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 flex items-start justify-between gap-3 relative overflow-hidden">
                  {/* left accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-primary-fixed" />
                  <div className="pl-1 min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {log.summary || "No detections"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {ts.toLocaleString()}
                    </p>
                    {hasPlastics && (
                      <p className="text-[11px] font-bold text-primary-fixed mt-1">
                        Plastics: {log.totalDetections}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0 mt-0.5">
                    {src}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detectable Plastic Types grid ───────────────────────────────────────────
function DetectableTypes() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1c32] p-5">
      <div className="flex items-center gap-2 mb-5">
        <Scan className="w-4 h-4 text-primary-fixed" />
        <span className="text-[11px] font-black text-primary-fixed uppercase tracking-widest">
          Detectable Plastic Types
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DETECTABLE_TYPES.map((t) => (
          <div key={t.label} className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
              style={{ backgroundColor: t.color, color: t.color }}
            />
            <span className="text-sm text-slate-300">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Object tracker ───────────────────────────────────────────────────────────
// Tracks each unique real-world object across frames using bbox centre distance.
// Much more robust than IoU alone — COCO-SSD shifts bboxes by up to 15% between
// frames which drops IoU below any reasonable threshold, but the centre point
// stays within a few percent of the object's true position.

interface TrackedObject {
  cls:      string;
  bbox:     [number, number, number, number]; // kept up-to-date each frame
  lastSeen: number;  // performance.now() timestamp
  counted:  boolean; // has this object been added to totalDetected?
}

// Returns normalised centre [cx, cy] (0..1) of a bbox
function bboxCenter(bbox: [number,number,number,number], vw: number, vh: number): [number,number] {
  return [(bbox[0] + bbox[2] / 2) / vw, (bbox[1] + bbox[3] / 2) / vh];
}

// Euclidean distance between two normalised centres
function centerDist(a: [number,number], b: [number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PlasticDetector() {
  // refs
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef   = useRef<CanvasRenderingContext2D | null>(null); // cached, willReadFrequently
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number>(0);
  const detectTimerRef = useRef<number>(0);
  const lastSaveRef    = useRef<number>(0);
  const lastDetectRef  = useRef<number>(0);
  const mountedRef     = useRef(true);
  const activeLabelRef = useRef<string>("Default camera");
  // Tracks objects already counted so we don't increment totalDetected repeatedly
  const trackedObjsRef = useRef<TrackedObject[]>([]);

  // camera
  const [devices, setDevices]                   = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [facingMode, setFacingMode]             = useState<"user" | "environment">("environment");

  // ui
  const [isRunning, setIsRunning]         = useState(false);
  const [modelLoading, setModelLoading]   = useState(true);
  const [modelError, setModelError]       = useState<string | null>(null);
  const [cameraError, setCameraError]     = useState<string | null>(null);
  const [confidence, setConfidence]       = useState(DEFAULT_CONFIDENCE);
  const [fps, setFps]                     = useState(0);
  const [detections, setDetections]       = useState<Detection[]>([]);
  const [history, setHistory]             = useState<ScanRecord[]>([]);
  const [totalDetected, setTotalDetected] = useState(0);

  // fps
  const fpsRef = useRef({ frames: 0, last: performance.now() });

  // ── Derived: cumulative class counts across ALL history ──────────────────
  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rec of history) {
      for (const item of rec.items) {
        map[item.class] = (map[item.class] ?? 0) + 1;
      }
    }
    return map;
  }, [history]);

  const pieSlices: PieSlice[] = useMemo(() =>
    (Object.entries(classCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], i) => ({ label, count, color: classColor(label, i) })),
    [classCounts]
  );

  const totalPie = pieSlices.reduce((s, p) => s + p.count, 0);

  // ── Device history: unique devices used across scans ────────────────────
  const deviceHistory = useMemo(() => {
    const seen: Record<string, { label: string; scans: number; items: number }> = {};
    for (const rec of history) {
      if (!seen[rec.device]) seen[rec.device] = { label: rec.device, scans: 0, items: 0 };
      seen[rec.device].scans++;
      seen[rec.device].items += rec.items.length;
    }
    return Object.values(seen).sort((a, b) => b.scans - a.scans);
  }, [history]);

  // ── Load model ────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        await loadModel();
        if (mountedRef.current) setModelLoading(false);
      } catch (err: any) {
        if (mountedRef.current) {
          setModelError(err?.message ?? "Failed to load AI model");
          setModelLoading(false);
        }
      }
    })();

    (async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach(t => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        if (mountedRef.current) setDevices(all.filter(d => d.kind === "videoinput"));
      } catch { /* permission pending */ }
    })();

    return () => { mountedRef.current = false; };
  }, []);

  // ── Draw loop — overlay only, video renders itself ───────────────────────
  // The <video> element handles its own rendering (browser compositor decodes
  // YUV natively — no green frame issues). The canvas is a transparent overlay
  // that only draws the detection bounding boxes on top.
  const drawLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !mountedRef.current) return;

    if (!canvasCtxRef.current) {
      canvasCtxRef.current = canvas.getContext("2d", { willReadFrequently: true });
    }
    const ctx = canvasCtxRef.current;
    if (!ctx) { rafRef.current = requestAnimationFrame(drawLoop); return; }

    // Sync canvas pixel size to its CSS display size
    const rect = canvas.getBoundingClientRect();
    const dw   = Math.round(rect.width)  || canvas.offsetWidth  || 640;
    const dh   = Math.round(rect.height) || canvas.offsetHeight || 360;
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width  = dw;
      canvas.height = dh;
    }

    // Clear previous frame's overlay, then draw detection boxes only
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (video.readyState >= 2 && video.videoWidth > 0) {
      drawDetections(ctx, detections, video.videoWidth, video.videoHeight);
    }

    const now = performance.now();
    fpsRef.current.frames++;
    if (now - fpsRef.current.last >= 1000) {
      if (mountedRef.current) setFps(fpsRef.current.frames);
      fpsRef.current.frames = 0;
      fpsRef.current.last   = now;
    }

    rafRef.current = requestAnimationFrame(drawLoop);
  }, [detections]);

  useEffect(() => {
    if (!isRunning) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawLoop);
  }, [isRunning, drawLoop]);

  // ── Inference timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const run = async () => {
      const video = videoRef.current;
      if (!video || !mountedRef.current || !isModelLoaded()) return;
      const now = performance.now();
      if (now - lastDetectRef.current < DETECT_INTERVAL_MS) return;
      lastDetectRef.current = now;

      const results = await detectFrame(video, confidence);
      if (!mountedRef.current) return;
      setDetections(results);

      if (results.length > 0) {
        const vw = video.videoWidth  || 640;
        const vh = video.videoHeight || 480;
        // Diagonal in normalised coords is always sqrt(2) ≈ 1.414
        // SAME_OBJECT_DIST_FRAC is already expressed as a fraction of that diagonal
        const maxDist = SAME_OBJECT_DIST_FRAC;

        // ── 1. Expire objects that haven't been seen recently ─────────────
        trackedObjsRef.current = trackedObjsRef.current.filter(
          t => now - t.lastSeen < OBJECT_GONE_MS
        );

        let newCount = 0;
        for (const det of results) {
          const cDet = bboxCenter(det.bbox, vw, vh);

          // Find the closest tracked object of the same class
          let bestIdx = -1;
          let bestDist = Infinity;
          trackedObjsRef.current.forEach((t, i) => {
            if (t.cls !== det.class) return;
            const d = centerDist(cDet, bboxCenter(t.bbox, vw, vh));
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          });

          if (bestIdx >= 0 && bestDist <= maxDist) {
            // Same object — update its bbox and lastSeen so it stays alive
            trackedObjsRef.current[bestIdx].bbox     = det.bbox;
            trackedObjsRef.current[bestIdx].lastSeen = now;
          } else {
            // Genuinely new object entering the frame
            trackedObjsRef.current.push({
              cls:      det.class,
              bbox:     det.bbox,
              lastSeen: now,
              counted:  true,
            });
            newCount++;
          }
        }

        if (newCount > 0) {
          setTotalDetected(prev => prev + newCount);
        }

        // ── Save snapshot to history / backend at most every SAVE_INTERVAL ─
        if (Date.now() - lastSaveRef.current > SAVE_INTERVAL_MS) {
          lastSaveRef.current = Date.now();
          const device = activeLabelRef.current;
          setHistory(prev =>
            [{ time: new Date().toLocaleTimeString(), items: results, device }, ...prev].slice(0, 50)
          );
          saveToBackend(results);
        }
      }
    };
    detectTimerRef.current = window.setInterval(run, DETECT_INTERVAL_MS);
    return () => clearInterval(detectTimerRef.current);
  }, [isRunning, confidence]);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setDetections([]);
    trackedObjsRef.current = []; // reset duplicate-detection tracking
    resetFrameBuffer();          // clear temporal smoother history
    if (!isModelLoaded()) {
      setCameraError("AI model is still loading. Please wait a moment and try again.");
      return;
    }
    try {
      const vc: MediaTrackConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } };

      const stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject   = stream;
      video.muted       = true;
      video.playsInline = true;

      // play() can throw if the element is unmounted or stream stops mid-call
      try {
        await video.play();
      } catch (playErr: any) {
        // Ignore AbortError — happens when stopCamera() is called before play resolves
        if (playErr?.name !== "AbortError") throw playErr;
        return;
      }

      if (!mountedRef.current) return;

      // Resolve camera label for device history
      const all  = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === "videoinput");
      if (mountedRef.current) setDevices(cams);

      const activeTrack = stream.getVideoTracks()[0];
      const trackLabel  = activeTrack?.label || "";
      const matchedDev  = cams.find(d => trackLabel && d.label === trackLabel);
      activeLabelRef.current = matchedDev?.label
        ? matchedDev.label.split("(")[0].trim()          // strip USB id
        : facingMode === "environment" ? "Rear Camera" : "Front Camera";

      setTotalDetected(0);
      fpsRef.current = { frames: 0, last: performance.now() };
      // Let the useEffect[isRunning, drawLoop] start the RAF loop — don't start it here
      setIsRunning(true);
    } catch (err: any) {
      let msg: string;
      switch (err?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          msg = "Camera permission denied. Click 'Allow' when your browser asks, then try again."; break;
        case "NotFoundError":
        case "DevicesNotFoundError":
          msg = "No camera found. Make sure a webcam or camera is connected and not blocked."; break;
        case "NotReadableError":
        case "TrackStartError":
          msg = "Camera is in use by another app (e.g. Zoom, Teams). Close it and retry."; break;
        case "OverconstrainedError":
          setSelectedDeviceId("");
          msg = "Selected camera failed. Switching to default — try again."; break;
        default:
          msg = `Camera error: ${err?.message ?? "Unknown error"}`;
      }
      setCameraError(msg);
    }
  }, [facingMode, selectedDeviceId]);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(detectTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas && canvasCtxRef.current) {
      canvasCtxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    }
    trackedObjsRef.current = [];
    resetFrameBuffer();
    setIsRunning(false);
    setDetections([]);
    setFps(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(detectTimerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Flip camera ───────────────────────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    const nf = facingMode === "user" ? "environment" : "user";
    setFacingMode(nf);
    setSelectedDeviceId("");
    if (isRunning) {
      stopCamera();
      trackedObjsRef.current = [];
      await new Promise(r => setTimeout(r, 300));
      if (!mountedRef.current) return;
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nf, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject   = stream;
        video.muted       = true;
        video.playsInline = true;
        try {
          await video.play();
        } catch (playErr: any) {
          if (playErr?.name !== "AbortError") throw playErr;
          return;
        }
        if (!mountedRef.current) return;
        activeLabelRef.current = nf === "environment" ? "Rear Camera" : "Front Camera";
        fpsRef.current = { frames: 0, last: performance.now() };
        // Let the useEffect[isRunning, drawLoop] start the RAF loop
        setIsRunning(true);
      } catch (err: any) {
        setCameraError("Could not switch camera: " + (err?.message ?? "unknown error"));
      }
    }
  }, [facingMode, isRunning, stopCamera]);

  // ── Refresh camera device list ────────────────────────────────────────────
  const [scanningDevices, setScanningDevices] = useState(false);
  const refreshDevices = useCallback(async () => {
    setScanningDevices(true);
    try {
      // Request permission first so labels are populated
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach(t => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      if (mountedRef.current) setDevices(all.filter(d => d.kind === "videoinput"));
    } catch { /* permission denied — show whatever we have */ }
    setScanningDevices(false);
  }, []);
  const saveToBackend = async (dets: Detection[]) => {
    const canvas = canvasRef.current;
    let thumbnail = "";
    try {
      // Only grab thumbnail if canvas has actual content
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        thumbnail = canvas.toDataURL("image/jpeg", 0.25).slice(0, 500);
      }
    } catch { /* tainted or unavailable */ }
    try {
      await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: thumbnail,
          detections: dets.map(d => ({ class: d.class, confidence: d.confidence, bbox: d.bbox })),
          source: "live-camera",
        }),
      });
    } catch { /* non-fatal */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pt-16 pb-6 min-h-screen bg-gradient-to-b from-[#020f1e] via-[#041329] to-[#020f1e]">
      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-primary-fixed" />
              Plastic AI Scanner
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
              Live camera · waste detection · Karnataka coast
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-xs font-mono text-slate-400">{fps} fps</span>
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${
              modelError ? "text-red-400" : modelLoading ? "text-yellow-400" : "text-emerald-400"
            }`}>
              {modelError ? "Error" : modelLoading ? "Loading AI…" : "AI Ready"}
            </span>
          </div>
        </div>

        {/* Model error */}
        {modelError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-300">AI Model Error</p>
              <p className="text-xs text-red-400/80 mt-1">{modelError}</p>
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">{cameraError}</p>
          </div>
        )}

        {/* Info banner */}
        {!modelLoading && !modelError && !isRunning && (
          <div className="rounded-xl bg-primary-fixed/5 border border-primary-fixed/20 p-3 flex gap-3">
            <Info className="w-4 h-4 text-primary-fixed shrink-0 mt-0.5" />
            <p className="text-xs text-primary-fixed/80">
              Point your camera at plastic bottles, bags, cups, or containers.
              The AI will detect and label them in real-time.
            </p>
          </div>
        )}

        {/* Video / Canvas — video renders natively (no YUV→green issue),
            canvas is a transparent overlay for detection boxes only */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10" style={{ aspectRatio: "16/9" }}>
          {/* Video renders itself — browser compositor handles YUV decoding */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          {/* Transparent overlay — only detection boxes drawn here, no video copy */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ background: "transparent" }}
          />

          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#020f1e]">
              <div className="rounded-full bg-white/5 border border-white/10 p-6">
                <Camera className="w-12 h-12 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500 uppercase tracking-widest">
                {modelLoading ? "Initialising AI model…" : "Tap Start Camera"}
              </p>
            </div>
          )}

          {isRunning && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/40">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Live</span>
              </div>
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary-fixed/30">
                <span className="text-xs font-mono text-primary-fixed">{detections.length} detected</span>
              </div>
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-mono text-slate-400">
                📷 {activeLabelRef.current}
              </div>
              <button onClick={flipCamera}
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm p-2 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                title="Flip camera">
                <FlipHorizontal className="w-5 h-5 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Camera selector — always visible */}
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary-fixed" />
              <span className="text-xs font-bold text-primary-fixed uppercase tracking-widest">Camera Source</span>
            </div>
            <button
              onClick={refreshDevices}
              disabled={scanningDevices}
              title="Scan for new devices (connect your phone first)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[11px] font-bold text-slate-400 uppercase tracking-widest disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${scanningDevices ? "animate-spin" : ""}`} />
              {scanningDevices ? "Scanning…" : "Refresh"}
            </button>
          </div>

          <select
            value={selectedDeviceId}
            onChange={e => {
              setSelectedDeviceId(e.target.value);
              if (isRunning) stopCamera();
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary-fixed/50 mb-2"
          >
            <option value="">💻 Laptop / Default Camera</option>
            {devices.map((d, i) => {
              const raw   = d.label || "";
              // Give human-friendly names based on label hints
              let label: string;
              if (!raw) {
                label = `Camera ${i + 1}`;
              } else if (/droidcam|ivcam|camo|epoccam|ndisplay|virtual|phone|android|iphone/i.test(raw)) {
                label = `📱 Phone — ${raw.split("(")[0].trim()}`;
              } else if (/usb|uvc|capture|external/i.test(raw)) {
                label = `🔌 USB — ${raw.split("(")[0].trim()}`;
              } else if (/integrated|built.?in|facetime|laptop|internal/i.test(raw)) {
                label = `💻 Laptop — ${raw.split("(")[0].trim()}`;
              } else {
                label = raw.split("(")[0].trim();
              }
              return (
                <option key={d.deviceId} value={d.deviceId}>{label}</option>
              );
            })}
          </select>

          {/* Helper text */}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {devices.length <= 1
              ? "Only your laptop camera is detected. Connect your phone (see instructions below) then tap Refresh."
              : `${devices.length} camera${devices.length > 1 ? "s" : ""} found. Select one, then tap Start Camera.`}
          </p>
        </div>

        {/* Start / Stop button */}
        <button onClick={isRunning ? stopCamera : startCamera}
          disabled={modelLoading || !!modelError}
          className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isRunning
              ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
              : "bg-primary-fixed text-on-primary-fixed hover:opacity-90 shadow-[0_0_24px_rgba(56,222,187,0.35)]"
          }`}>
          {isRunning
            ? <><CameraOff className="w-5 h-5" /> Stop Camera</>
            : modelLoading ? "Loading AI Model…"
            : <><Camera className="w-5 h-5" /> Start Camera</>}
        </button>

        {/* Phone connection instructions */}
        {!isRunning && (
          <div className="rounded-xl bg-white/3 border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📱</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Use Your Phone Camera</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-bold text-slate-300">Android:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Install <span className="text-primary-fixed font-bold">DroidCam</span> on your phone (free, Play Store)</li>
                <li>Install <span className="text-primary-fixed font-bold">DroidCam Client</span> on this laptop (dev47apps.com)</li>
                <li>Connect both to the same WiFi — open DroidCam on phone, enter the IP shown into the laptop client</li>
                <li>Come back here and tap <span className="text-primary-fixed font-bold">Refresh</span> — your phone will appear in the list above</li>
              </ol>
              <p className="font-bold text-slate-300 mt-2">iPhone:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Install <span className="text-primary-fixed font-bold">Camo</span> on iPhone (App Store) + Camo app on laptop (reincubate.com)</li>
                <li>Connect iPhone via USB or WiFi</li>
                <li>Tap <span className="text-primary-fixed font-bold">Refresh</span> above — phone camera appears in the list</li>
              </ol>
              <p className="mt-2 text-slate-500">Or simply open <span className="font-mono text-primary-fixed">http://{window.location.hostname}:3000</span> in your phone browser — the phone's own camera runs detection directly on the phone screen.</p>
            </div>
          </div>
        )}

        {/* ── STATISTICS SECTION ───────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary-fixed" />
            <h3 className="text-xs font-bold text-primary-fixed uppercase tracking-widest">Session Statistics</h3>
            {isRunning && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </div>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Total Detected",  value: totalDetected,     icon: TrendingUp,       color: "text-primary-fixed" },
              { label: "This Frame",      value: detections.length, icon: Trash2,           color: "text-amber-400"    },
              { label: "Scan Events",     value: history.length,    icon: Clock,            color: "text-emerald-400"  },
              { label: "Waste Types",     value: pieSlices.length,  icon: PieIcon,          color: "text-purple-400"   },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-500 uppercase leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Confidence slider inside stats */}
          <div className="pt-3 border-t border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min Confidence</span>
              <span className="text-sm font-mono text-primary-fixed">{Math.round(confidence * 100)}%</span>
            </div>
            <input type="range" min="0.10" max="0.90" step="0.05" value={confidence}
              onChange={e => setConfidence(parseFloat(e.target.value))} className="w-full accent-[#38debb]" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>More detections</span>
              <span>Higher accuracy</span>
            </div>
          </div>
        </div>

        {/* ── LIVE DETECTIONS ─────────────────────────────────────────────── */}
        {detections.length > 0 && (
          <div className="glass-card rounded-xl p-4">
            <h3 className="text-xs font-bold text-primary-fixed uppercase tracking-widest mb-3">Detected Now</h3>
            <div className="space-y-2">
              {detections.map((d, i) => {
                const conf  = Math.round(d.confidence * 100);
                const color = conf > 75 ? "text-red-400" : conf > 55 ? "text-amber-400" : "text-primary-fixed";
                const bar   = conf > 75 ? "bg-red-400" : conf > 55 ? "bg-amber-400" : "bg-primary-fixed";
                return (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: classColor(d.class, i) }} />
                    <span className="text-sm text-white flex-1">{d.class}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${conf}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-9 text-right ${color}`}>{conf}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PIE CHART — Waste Type Distribution ─────────────────────────── */}
        {totalPie > 0 && (
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-primary-fixed" />
              <h3 className="text-xs font-bold text-primary-fixed uppercase tracking-widest">Waste Type Distribution</h3>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">{totalPie} items</span>
            </div>

            <div className="flex items-center gap-5">
              {/* Donut chart */}
              <div className="w-36 h-36 shrink-0">
                <DonutChart slices={pieSlices} total={totalPie} />
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {pieSlices.map((s) => {
                  const pct = Math.round((s.count / totalPie) * 100);
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[11px] text-white flex-1 truncate">{s.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── DEVICE HISTORY ───────────────────────────────────────────────── */}
        {deviceHistory.length > 0 && (
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <MonitorSmartphone className="w-4 h-4 text-primary-fixed" />
              <h3 className="text-xs font-bold text-primary-fixed uppercase tracking-widest">Device History</h3>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">{deviceHistory.length} device{deviceHistory.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2">
              {deviceHistory.map((dv, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed/10 flex items-center justify-center shrink-0">
                    <MonitorSmartphone className="w-4 h-4 text-primary-fixed" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{dv.label}</p>
                    <p className="text-[10px] text-slate-500">{dv.scans} scan event{dv.scans > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary-fixed">{dv.items}</p>
                    <p className="text-[10px] text-slate-500">items</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SCAN HISTORY ─────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary-fixed" />
              <h3 className="text-xs font-bold text-primary-fixed uppercase tracking-widest">Scan History</h3>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">{history.length} events</span>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {history.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-slate-500 font-mono shrink-0 pt-0.5">{rec.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">{rec.items.map(it => it.class).join(" · ")}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">📷 {rec.device}</p>
                  </div>
                  <span className="text-primary-fixed font-bold shrink-0">{rec.items.length}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DASHBOARD + RECENT LOGS ──────────────────────────────────────── */}
        <DashboardLogs />

        {/* ── DETECTABLE PLASTIC TYPES ─────────────────────────────────────── */}
        <DetectableTypes />

      </div>
    </div>
  );
}
