import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const STORE_FILE = path.join(__dirname, 'detection_store.json');
const MAX_HISTORY_ITEMS = 100;

const defaultStore = {
  history: [],
  stats: {
    totalScans: 0,
    plasticsDetected: 0,
    accuracy: 0,
  },
};

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...defaultStore };
  }
};

const writeStore = async (store: typeof defaultStore) => {
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
};

const ensureStore = async () => {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await writeStore(defaultStore);
  }
};

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/history', async (req, res) => {
  try {
    const store = await readStore();
    res.json(store.history);
  } catch (error) {
    console.error('History read failed:', error);
    res.status(500).json({ error: 'Unable to read detection history' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const store = await readStore();
    res.json(store.stats);
  } catch (error) {
    console.error('Stats read failed:', error);
    res.status(500).json({ error: 'Unable to read statistics' });
  }
});

app.post('/api/detect', async (req, res) => {
  try {
    const { imageBase64, detections = [], source = 'webcam' } = req.body;

    if (!imageBase64 && (!Array.isArray(detections) || detections.length === 0)) {
      return res.status(400).json({ error: 'Missing imageBase64 or detections' });
    }

    const store = await readStore();
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      source,
      totalDetections: Array.isArray(detections) ? detections.length : 0,
      summary: Array.isArray(detections)
        ? detections.map((d: any) => `${d.class} (${Math.round(d.confidence * 100)}%)`).join(', ')
        : 'No detections',
      detections: Array.isArray(detections) ? detections : [],
      imageBase64: typeof imageBase64 === 'string' ? imageBase64.slice(0, 200) : undefined,
    };

    store.history.unshift(record);
    store.history = store.history.slice(0, MAX_HISTORY_ITEMS);
    store.stats.totalScans += 1;
    store.stats.plasticsDetected += record.totalDetections;
    store.stats.accuracy = store.stats.totalScans > 0
      ? Number((store.stats.plasticsDetected / store.stats.totalScans).toFixed(2))
      : 0;

    await writeStore(store);
    res.json({ item: record, stats: store.stats });
  } catch (error) {
    console.error('Detection save failed:', error);
    res.status(500).json({ error: 'Failed to save detection result' });
  }
});

app.get('/api/model/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'public', 'models', filename);
  res.download(filepath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Model file not found' });
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const startServer = async (port: number) => {
  return new Promise<number>((resolve, reject) => {
    const server = app.listen(port)
      .once('listening', () => resolve(port))
      .once('error', (error: NodeJS.ErrnoException) => reject(error));

    process.on('SIGINT', () => server.close());
    process.on('SIGTERM', () => server.close());
  });
};

ensureStore().then(async () => {
  try {
    const activePort = await startServer(Number(PORT));
    console.log(`Server running on port ${activePort}`);
    console.log(`Health check: http://localhost:${activePort}/api/health`);
  } catch (error: any) {
    if (error?.code === 'EADDRINUSE') {
      const fallbackPort = Number(PORT) + 1;
      console.warn(`Port ${PORT} is in use. Trying fallback port ${fallbackPort}...`);
      try {
        const activePort = await startServer(fallbackPort);
        console.log(`Server running on fallback port ${activePort}`);
        console.log(`Health check: http://localhost:${activePort}/api/health`);
      } catch (fallbackError) {
        console.error('Fallback port failed:', fallbackError);
        process.exit(1);
      }
    } else {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}).catch((error) => {
  console.error('Failed to initialize store:', error);
  process.exit(1);
});
