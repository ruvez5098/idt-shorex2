import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const STORE_FILE = path.join(__dirname, 'detection_store.json');
const USERS_FILE = path.join(__dirname, 'users_store.json');
const MAX_HISTORY_ITEMS = 100;

// Admin credentials — env vars with secure defaults for development only
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shorex@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shorex0528';

const defaultStore = {
  history: [],
  stats: {
    totalScans: 0,
    plasticsDetected: 0,
    accuracy: 0,
  },
};

const defaultUsersStore: { users: UserRecord[] } = {
  users: [],
};

interface UserRecord {
  email: string;
  displayName: string;
  createdAt: string;
  lastLogin: string;
  loginCount: number;
  scanCount: number;
}

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

const readUsersStore = async (): Promise<{ users: UserRecord[] }> => {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { users: [] };
  }
};

const writeUsersStore = async (store: { users: UserRecord[] }) => {
  await fs.writeFile(USERS_FILE, JSON.stringify(store, null, 2), 'utf-8');
};

const ensureUsersStore = async () => {
  try {
    await fs.access(USERS_FILE);
  } catch {
    await writeUsersStore(defaultUsersStore);
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

app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin auth endpoint
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    return res.json({ success: true, role: 'admin' });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// Register/track user
app.post('/api/users/register', async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normalized = email.trim().toLowerCase();
    const store = await readUsersStore();
    const existing = store.users.find((u) => u.email === normalized);

    if (existing) {
      existing.lastLogin = new Date().toISOString();
      existing.loginCount = (existing.loginCount || 0) + 1;
    } else {
      store.users.push({
        email: normalized,
        displayName: displayName || normalized.split('@')[0],
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        loginCount: 1,
        scanCount: 0,
      });
    }

    await writeUsersStore(store);
    res.json({ success: true });
  } catch (error) {
    console.error('User register failed:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Admin: get all users
app.get('/api/admin/users', async (req, res) => {
  // Simple header-based auth for admin API
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const store = await readUsersStore();
    res.json(store.users);
  } catch (error) {
    console.error('Users read failed:', error);
    res.status(500).json({ error: 'Unable to read users' });
  }
});

// Admin: get full detection history
app.get('/api/admin/history', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const store = await readStore();
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read history' });
  }
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

    // Update user scan count if email provided
    if (req.body.userEmail) {
      const usersStore = await readUsersStore();
      const user = usersStore.users.find((u) => u.email === req.body.userEmail);
      if (user) {
        user.scanCount = (user.scanCount || 0) + 1;
        await writeUsersStore(usersStore);
      }
    }

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
  res.sendFile(path.join(__dirname, 'index.html'));
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

const findFreePort = async (initialPort: number): Promise<number> => {
  let port = initialPort;
  while (port < initialPort + 20) {
    try {
      await startServer(port);
      return port;
    } catch (error: any) {
      if (error?.code === 'EADDRINUSE') {
        port += 1;
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Unable to find a free port between ${initialPort} and ${initialPort + 19}`);
};

ensureStore().then(async () => {
  await ensureUsersStore();
  try {
    const activePort = await findFreePort(Number(PORT));
    console.log(`Server running on port ${activePort}`);
    console.log(`Health check: http://localhost:${activePort}/api/health`);
    console.log(`Admin email: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('Failed to find an available port:', error);
    process.exit(1);
  }
}).catch((error) => {
  console.error('Failed to initialize store:', error);
  process.exit(1);
});
