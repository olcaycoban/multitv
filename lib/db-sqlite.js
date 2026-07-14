// Yalnızca DATABASE_URL tanımlı DEĞİLKEN kullanılan geçici local fallback.
// Production'da (Vercel) KULLANILMAMALI — /tmp kalıcı değildir.
// Dışa açılan fonksiyonlar Postgres implementasyonuyla aynı async arayüze
// sahip olsun diye Promise döndürür (better-sqlite3'ün kendisi senkrondur).
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.cwd(), 'lib');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'channels.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    source        TEXT    NOT NULL,
    type          TEXT    NOT NULL DEFAULT 'youtube',
    position      INTEGER NOT NULL DEFAULT 0,
    screen        TEXT    NOT NULL DEFAULT 'main',
    yt_channel_id TEXT    DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at     TEXT    NOT NULL,
    total      INTEGER NOT NULL DEFAULT 0,
    broken     INTEGER NOT NULL DEFAULT 0,
    fixed      INTEGER NOT NULL DEFAULT 0,
    unfixable  INTEGER NOT NULL DEFAULT 0,
    detail     TEXT    DEFAULT NULL
  );
`);

const existingCols = db.prepare("PRAGMA table_info(channels)").all().map(c => c.name);
if (!existingCols.includes('yt_channel_id')) {
  db.exec('ALTER TABLE channels ADD COLUMN yt_channel_id TEXT DEFAULT NULL');
}

const { defaultChannels } = require('./seed-channels');

function seedChannels() {
  const ins = db.prepare('INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction((list) => list.forEach((ch, i) => ins.run(ch.name, ch.source, ch.type, i, ch.screen, ch.yt_channel_id || null)))(defaultChannels);
}

const count = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
if (count.cnt === 0) {
  seedChannels();
}

function ensureSeedIfEmpty() {
  const c = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
  if (c.cnt === 0) seedChannels();
}

async function getAll(screen) {
  ensureSeedIfEmpty();
  return db.prepare('SELECT * FROM channels WHERE screen = ? ORDER BY position ASC').all(screen || 'main');
}

async function insert(channel) {
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM channels WHERE screen = ?').get(channel.screen || 'main').m;
  const r = db.prepare('INSERT INTO channels (name, source, type, position, screen) VALUES (?, ?, ?, ?, ?)').run(channel.name, channel.source, channel.type || 'youtube', maxPos + 1, channel.screen || 'main');
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(r.lastInsertRowid);
}

async function update(id, data) {
  const fields = [], values = [];
  if (data.name !== undefined)          { fields.push('name = ?');          values.push(data.name); }
  if (data.source !== undefined)        { fields.push('source = ?');        values.push(data.source); }
  if (data.type !== undefined)          { fields.push('type = ?');          values.push(data.type); }
  if (data.yt_channel_id !== undefined) { fields.push('yt_channel_id = ?'); values.push(data.yt_channel_id || null); }
  if (!fields.length) return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  values.push(id);
  db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
}

async function addJobLog(entry) {
  db.prepare(`INSERT INTO job_logs (ran_at, total, broken, fixed, unfixable, detail)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    entry.ran_at, entry.total, entry.broken, entry.fixed, entry.unfixable,
    JSON.stringify(entry.detail)
  );
}

async function getJobLogs(limit = 10) {
  return db.prepare('SELECT * FROM job_logs ORDER BY id DESC LIMIT ?').all(limit);
}

async function remove(id) {
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

async function reorder(ids) {
  const stmt = db.prepare('UPDATE channels SET position = ? WHERE id = ?');
  db.transaction((list) => list.forEach((id, i) => stmt.run(i, id)))(ids);
}

async function forceReseed() {
  db.exec('DELETE FROM channels');
  seedChannels();
  return db.prepare('SELECT COUNT(*) as cnt FROM channels').get().cnt;
}

module.exports = { getAll, insert, update, remove, reorder, addJobLog, getJobLogs, forceReseed };
