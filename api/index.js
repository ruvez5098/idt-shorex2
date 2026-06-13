// Vercel serverless function — handles all /api/* routes
import express from 'express';

const app = express();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'shorex@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shorex0528';
const MAX_HISTORY    = 100;

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// In-memory store (resets on cold start — sufficient for demo/production use)
let store = {
  history: [],
  stats: { totalScans: 0, plasticsDetected: 0, accuracy: 0 },
};
let usersStore = { users: [] };

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/stats',  (req, res) => res.json(store.stats));
app.get('/api/history',(req, res) => res.json(store.history));

app.post('/api/detect', (req, res) => {
  const { detections = [], source = 'webcam', imageBase64 } = req.body;
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
    timestamp: new Date().toISOString(),
    source,
    totalDetections: Array.isArray(detections) ? detections.length : 0,
    summary: Array.isArray(detections)
      ? detections.map(d => `${d.class} (${Math.round(d.confidence*100)}%)`).join(', ')
      : 'No detections',
    detections: Array.isArray(detections) ? detections : [],
    imageBase64: typeof imageBase64 === 'string' ? imageBase64.slice(0,200) : undefined,
  };
  store.history.unshift(record);
  store.history = store.history.slice(0, MAX_HISTORY);
  store.stats.totalScans += 1;
  store.stats.plasticsDetected += record.totalDetections;
  store.stats.accuracy = store.stats.totalScans > 0
    ? Number((store.stats.plasticsDetected / store.stats.totalScans).toFixed(2)) : 0;
  res.json({ item: record, stats: store.stats });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Required' });
  if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD)
    return res.json({ success: true, role: 'admin' });
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/users/register', (req, res) => {
  const { email, displayName } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const normalized = email.trim().toLowerCase();
  const existing = usersStore.users.find(u => u.email === normalized);
  if (existing) {
    existing.lastLogin = new Date().toISOString();
    existing.loginCount = (existing.loginCount || 0) + 1;
  } else {
    usersStore.users.push({
      email: normalized,
      displayName: displayName || normalized.split('@')[0],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginCount: 1, scanCount: 0,
    });
  }
  res.json({ success: true });
});

app.get('/api/admin/users', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD)
    return res.status(403).json({ error: 'Forbidden' });
  res.json(usersStore.users);
});

export default app;
