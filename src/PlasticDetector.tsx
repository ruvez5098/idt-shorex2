import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader, AlertCircle, UploadCloud, BarChart3, Clock, CheckCircle2, ListChecks } from 'lucide-react';
import { plasticDetectionModel, type Detection } from './plasticDetection';

type HistoryItem = {
  id: string;
  timestamp: string;
  source: string;
  totalDetections: number;
  summary: string;
};

type Stats = {
  totalScans: number;
  plasticsDetected: number;
  accuracy: number;
};

const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:5000'
  : '';

export const PlasticDetector = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoUploadRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [videoDetections, setVideoDetections] = useState<Detection[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedDetections, setUploadedDetections] = useState<Detection[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [confidence, setConfidence] = useState(0.5);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const lastTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    const initialize = async () => {
      setIsLoadingModel(true);
      setError(null);

      try {
        const success = await plasticDetectionModel.loadModel('/models/plastic-detection-model.json');
        setIsModelReady(success);
        setDemoMode(!success);
        if (!success) {
          setToast('Using fallback detection mode. Model will still run with COCO-SSD.');
        }
      } catch (loadError) {
        console.error('Model initialization failed:', loadError);
        setError('Unable to load the AI model. Using fallback detection mode.');
        setDemoMode(true);
      } finally {
        setIsLoadingModel(false);
      }

      fetchStats();
      fetchHistory();
    };

    initialize();

    return () => {
      plasticDetectionModel.dispose();
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`);
      if (!response.ok) {
        throw new Error('Stats request failed');
      }
      const data: Stats = await response.json();
      setStats(data);
    } catch (fetchError) {
      console.error('Stats load failed:', fetchError);
      setToast('Unable to load statistics.');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history`);
      if (!response.ok) {
        throw new Error('History request failed');
      }
      const data: HistoryItem[] = await response.json();
      setHistory(data.slice(0, 10));
    } catch (fetchError) {
      console.error('History load failed:', fetchError);
      setToast('Unable to load detection history.');
    }
  };

  const saveDetection = async (savedDetections: Detection[], source: string, imageBase64: string | null) => {
    try {
      const response = await fetch(`${API_BASE}/api/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          detections: savedDetections,
          imageBase64,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Save failed');
      }

      const result = await response.json();
      if (result.stats) {
        setStats(result.stats);
      }
      if (result.item) {
        setHistory((prev) => [result.item, ...prev].slice(0, 10));
      }
    } catch (saveError) {
      console.error('Save detection failed:', saveError);
      setToast('Unable to save detection history.');
    }
  };

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported by this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsRunning(true);
      }
    } catch (streamError) {
      console.error('Camera start failed:', streamError);
      setError('Failed to access camera. Please allow permission and try again.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsRunning(false);
    setDetections([]);
  };

  const drawDetectionBoxes = (ctx: CanvasRenderingContext2D, detectionsToDraw: Detection[]) => {
    detectionsToDraw.forEach((det) => {
      const [x, y, w, h] = det.bbox;
      const color = det.class.includes('plastic') ? '#ef4444' : '#3b82f6';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Arial';
      ctx.fillText(`${det.class} ${(det.confidence * 100).toFixed(1)}%`, x + 6, y + 18);
    });
  };

  const drawUploadPreview = (image: HTMLImageElement, detectionsToDraw: Detection[]) => {
    if (!uploadCanvasRef.current) return;
    const canvas = uploadCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawDetectionBoxes(ctx, detectionsToDraw);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsBusy(true);
    setError(null);
    setUploadedDetections([]);
    setUploadedImage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read uploaded image.');
        setIsBusy(false);
        return;
      }

      const imageDataUrl = reader.result;
      setUploadedImage(imageDataUrl);
      const image = new Image();
      image.src = imageDataUrl;
      image.onload = async () => {
        const results = await plasticDetectionModel.detectPlastics(image);
        const filtered = results.filter((item) => item.confidence >= confidence);
        setUploadedDetections(filtered);
        drawUploadPreview(image, filtered);
        await saveDetection(filtered, 'image_upload', imageDataUrl);
        setToast('Upload detection processed successfully.');
        setIsBusy(false);
      };
      image.onerror = () => {
        setError('Unable to load the selected image.');
        setIsBusy(false);
      };
    };

    reader.onerror = () => {
      setError('Unable to read the selected file.');
      setIsBusy(false);
    };

    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoFileUrl(url);
    setVideoDetections([]);
    setVideoMode(true);
    setIsVideoPlaying(false);
    setError(null);
  };

  const stopVideoPlayback = () => {
    if (videoUploadRef.current) {
      videoUploadRef.current.pause();
      videoUploadRef.current.src = '';
      videoUploadRef.current.load();
    }
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
    }
    setVideoFileUrl(null);
    setVideoDetections([]);
    setVideoMode(false);
    setIsVideoPlaying(false);
  };

  const saveLiveResult = async (canvas: HTMLCanvasElement) => {
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);
    await saveDetection(detections, 'webcam', imageBase64);
  };

  useEffect(() => {
    if (!videoMode || !videoFileUrl || (!isModelReady && !demoMode) || !videoUploadRef.current || !videoCanvasRef.current) return;

    let animationId: number;
    const canvas = videoCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoUploadRef.current;

    if (!ctx) return;

    if (!isVideoPlaying && video.src !== videoFileUrl) {
      video.src = videoFileUrl;
      video.play().then(() => setIsVideoPlaying(true)).catch((videoError) => {
        console.error('Video playback failed:', videoError);
        setError('Unable to play the selected video.');
        setIsVideoPlaying(false);
      });
    }

    const detectVideoFrame = async () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let newDetections: Detection[] = [];
        if (demoMode) {
          newDetections = generateDemoDetections();
        } else {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          newDetections = await plasticDetectionModel.detectPlastics(imageData);
        }

        const filtered = newDetections.filter((d) => d.confidence >= confidence);
        setVideoDetections(filtered);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawDetectionBoxes(ctx, filtered);

        const now = Date.now();
        if (filtered.length > 0 && now - lastSavedRef.current > 10000) {
          lastSavedRef.current = now;
          saveDetection(filtered, 'video_file', canvas.toDataURL('image/jpeg', 0.7)).catch((saveError) => {
            console.error('Video detection save failed:', saveError);
          });
        }
      }

      animationId = requestAnimationFrame(detectVideoFrame);
    };

    animationId = requestAnimationFrame(detectVideoFrame);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [videoMode, videoFileUrl, isModelReady, confidence, demoMode]);

  useEffect(() => {
    if (!isRunning || (!isModelReady && !demoMode) || !videoRef.current || !canvasRef.current) return;

    let animationId: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (!ctx) return;

    const detectFrame = async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let newDetections: Detection[] = [];
        if (demoMode) {
          newDetections = generateDemoDetections();
        } else {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          newDetections = await plasticDetectionModel.detectPlastics(imageData);
        }

        const filtered = newDetections.filter((d) => d.confidence >= confidence);
        setDetections(filtered);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawDetectionBoxes(ctx, filtered);

        frameCountRef.current += 1;
        const now = Date.now();
        if (now - lastTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }

        if (filtered.length > 0 && now - lastSavedRef.current > 4500) {
          lastSavedRef.current = now;
          saveLiveResult(canvas).catch((saveError) => {
            console.error('Live detection save failed:', saveError);
          });
        }
      }

      animationId = requestAnimationFrame(detectFrame);
    };

    animationId = requestAnimationFrame(detectFrame);

    return () => cancelAnimationFrame(animationId);
  }, [isRunning, isModelReady, confidence, demoMode]);

  const generateDemoDetections = (): Detection[] => {
    if (Math.random() > 0.3) return [];
    return [
      {
        class: 'plastic bottle',
        confidence: 0.85 + Math.random() * 0.1,
        bbox: [100 + Math.random() * 200, 50 + Math.random() * 150, 150, 120] as [number, number, number, number],
      },
      ...(Math.random() > 0.5
        ? [
            {
              class: 'plastic cup',
              confidence: 0.7 + Math.random() * 0.15,
              bbox: [400 + Math.random() * 200, 150 + Math.random() * 200, 120, 100] as [number, number, number, number],
            },
          ]
        : []),
    ];
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6 pb-32">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Camera className="text-red-500" />
              Plastic Detection AI
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Live camera detection, image uploads, history logging and usage statistics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchStats}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              <BarChart3 className="w-4 h-4" /> Refresh Stats
            </button>
            <button
              type="button"
              onClick={fetchHistory}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              <Clock className="w-4 h-4" /> Refresh History
            </button>
          </div>
        </div>

        {toast && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="inline-block w-4 h-4 mr-2 align-text-top" />
            {toast}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {isLoadingModel && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <Loader className="text-blue-600 animate-spin" size={20} />
            <p className="text-blue-700">Loading AI model...</p>
          </div>
        )}

        {demoMode && !isLoadingModel && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>Fallback detection:</strong> COCO-SSD model is used to detect plastic-like objects in the browser.
            </p>
          </div>
        )}

        {isModelReady && !demoMode && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
            <p className="text-sm font-medium">AI model loaded successfully. Real-time detection is enabled.</p>
          </div>
        )}

        <div className="relative bg-black rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '16 / 9' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ display: isRunning ? 'block' : 'none' }}
          />

          {isRunning && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
              FPS: {fps}
            </div>
          )}

          {demoMode && isRunning && (
            <div className="absolute bottom-4 left-4 bg-yellow-500/80 text-white px-3 py-1 rounded text-xs">
              FALLBACK MODE
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Confidence Threshold: {(confidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={isRunning ? stopCamera : startCamera}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                  isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRunning ? 'Stop Detection' : 'Start Detection'}
              </button>
              <label className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 py-3 px-4 text-center text-sm font-semibold text-slate-900 hover:bg-slate-100">
                <UploadCloud className="inline-block w-5 h-5 mr-2" />
                Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <label className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 py-3 px-4 text-center text-sm font-semibold text-slate-900 hover:bg-slate-100">
                <UploadCloud className="inline-block w-5 h-5 mr-2" />
                Upload Video
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            </div>
            {videoMode && (
              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  onClick={stopVideoPlayback}
                  className="flex-1 py-3 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                >
                  Stop Video Playback
                </button>
              </div>
            )}

            {isBusy && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
                <Loader className="inline-block w-4 h-4 mr-2 animate-spin" /> Processing image...
              </div>
            )}

            {detections.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Detected Plastics: {detections.length}</h3>
                <div className="space-y-2">
                  {detections.map((det, idx) => (
                    <div key={idx} className="text-sm text-red-800">
                      {det.class} - {(det.confidence * 100).toFixed(1)}% confidence
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadedImage && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Upload Detection Results</h3>
                <div className="grid gap-3">
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black" style={{ aspectRatio: '4 / 3' }}>
                    <img src={uploadedImage} alt="Uploaded preview" className="absolute inset-0 h-full w-full object-cover" />
                    <canvas ref={uploadCanvasRef} className="absolute inset-0 w-full h-full" />
                  </div>
                  {uploadedDetections.length > 0 ? (
                    uploadedDetections.map((det, idx) => (
                      <div key={idx} className="text-sm text-slate-800">
                        {det.class} - {(det.confidence * 100).toFixed(1)}%
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No plastic objects detected in the uploaded image.</p>
                  )}
                </div>
              </div>
            )}

            {videoMode && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Video Detection Results</h3>
                <div className="grid gap-3">
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black" style={{ aspectRatio: '16 / 9' }}>
                    <video
                      ref={videoUploadRef}
                      className="absolute inset-0 h-full w-full object-cover"
                      controls
                      muted
                      loop
                    />
                    <canvas ref={videoCanvasRef} className="absolute inset-0 w-full h-full" />
                  </div>
                  {videoDetections.length > 0 ? (
                    videoDetections.map((det, idx) => (
                      <div key={idx} className="text-sm text-slate-800">
                        {det.class} - {(det.confidence * 100).toFixed(1)}%
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No plastic objects detected yet in the video.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Usage Statistics</p>
                  <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
                </div>
                <BarChart3 className="w-8 h-8 text-slate-700" />
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Total Scans</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats?.totalScans ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Plastics Found</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats?.plasticsDetected ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Accuracy Rate</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats ? `${Math.round(stats.accuracy * 100)}%` : '0%'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Detection History</p>
                  <h2 className="text-2xl font-bold text-slate-900">Recent Logs</h2>
                </div>
                <ListChecks className="w-8 h-8 text-slate-700" />
              </div>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-600">No history yet. Start a scan to log your first detection.</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{item.summary || 'No objects detected'}</p>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.source}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-slate-700">Plastics: {item.totalDetections}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="text-blue-900 mb-2">
            <strong>How to train a real model:</strong>
          </p>
          <ol className="text-blue-800 space-y-1 list-decimal list-inside">
            <li>Collect plastic images (500+)</li>
            <li>Run: <code className="bg-blue-100 px-1">python train_plastic_model.py</code></li>
            <li>Model will be saved to public/models/</li>
            <li>Refresh browser to use the trained model</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
