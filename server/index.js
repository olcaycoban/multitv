const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { checkAndUpdate } = require('./check-links');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// GET /api/channels?screen=main
app.get('/api/channels', (req, res) => {
  const screen = req.query.screen || 'main';
  res.json(db.getAll(screen));
});

// POST /api/channels
app.post('/api/channels', (req, res) => {
  const { name, source, type, screen } = req.body;
  if (!name || !source) return res.status(400).json({ error: 'name and source required' });
  const channel = db.insert({ name, source, type: type || 'youtube', screen: screen || 'main' });
  res.status(201).json(channel);
});

// PATCH /api/channels/:id
app.patch('/api/channels/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, source, type } = req.body;
  const updated = db.update(id, { name, source, type });
  res.json(updated);
});

// DELETE /api/channels/:id
app.delete('/api/channels/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.remove(id);
  res.status(204).end();
});

// POST /api/check-links  — manuel link kontrolü tetikle
app.post('/api/check-links', async (req, res) => {
  try {
    const result = await checkAndUpdate();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/channels/reorder  { ids: [1, 3, 2, ...] }
app.put('/api/channels/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  db.reorder(ids);
  res.json({ ok: true });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

// Her sabah 06:00'da link kontrolü (Türkiye saati = UTC+3, cron UTC ile çalışır → 03:00 UTC)
cron.schedule('0 3 * * *', () => {
  console.log('[cron] Sabah link kontrolü başlatılıyor…');
  checkAndUpdate().catch(console.error);
}, { timezone: 'Europe/Istanbul' });

console.log('[cron] Link kontrolü her sabah 06:00\'da (Türkiye saati) çalışacak.');
