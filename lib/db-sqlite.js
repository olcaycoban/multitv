// Yalnızca DATABASE_URL tanımlı DEĞİLKEN kullanılan geçici local fallback.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { defaultChannels } = require('./seed-channels');
const { FEATURED_LAYOUT_COUNT } = require('./constants');

const DB_DIR = path.join(process.cwd(), 'lib');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'channels.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    source        TEXT    NOT NULL,
    type          TEXT    NOT NULL DEFAULT 'youtube',
    position      INTEGER NOT NULL DEFAULT 0,
    screen        TEXT    NOT NULL DEFAULT 'main',
    yt_channel_id TEXT    DEFAULT NULL,
    updated_at    TEXT    DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    screen        TEXT NOT NULL DEFAULT 'main',
    channel_count INTEGER NOT NULL DEFAULT 13,
    PRIMARY KEY (user_id, screen)
  );
  CREATE TABLE IF NOT EXISTS user_channel_order (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    screen     TEXT NOT NULL DEFAULT 'main',
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, screen, channel_id)
  );
`);

const existingCols = db.prepare('PRAGMA table_info(channels)').all().map(c => c.name);
if (!existingCols.includes('yt_channel_id')) db.exec('ALTER TABLE channels ADD COLUMN yt_channel_id TEXT DEFAULT NULL');
if (!existingCols.includes('updated_at')) db.exec("ALTER TABLE channels ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");

function seedChannels() {
  const ins = db.prepare('INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction((list) => list.forEach((ch, i) => ins.run(ch.name, ch.source, ch.type, i, ch.screen, ch.yt_channel_id || null)))(defaultChannels);
}

const count = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
if (count.cnt === 0) seedChannels();

const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const bcrypt = require('bcryptjs');
  const passwordHash = bcrypt.hashSync('password', 10);
  seedUsersSync(passwordHash);
}

function seedUsersSync(passwordHash) {
  let created = 0;
  for (let i = 1; i <= 100; i++) {
    const username = `user${i}`;
    const r = db.prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
    if (r.changes > 0) {
      created++;
      const userId = r.lastInsertRowid;
      for (const scr of ['main', 'bolge']) {
        db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, screen, channel_count) VALUES (?, ?, ?)').run(userId, scr, FEATURED_LAYOUT_COUNT);
        const channels = db.prepare('SELECT id, position FROM channels WHERE screen = ? ORDER BY position ASC').all(scr);
        const ins = db.prepare('INSERT OR IGNORE INTO user_channel_order (user_id, screen, channel_id, position) VALUES (?, ?, ?, ?)');
        channels.forEach(ch => ins.run(userId, scr, ch.id, ch.position));
      }
    }
  }
  return created;
}

function ensureSeedIfEmpty() {
  const c = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
  if (c.cnt === 0) seedChannels();
}

function ensureUserChannelOrder(userId, screen) {
  const scr = screen || 'main';
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM user_channel_order WHERE user_id = ? AND screen = ?').get(userId, scr);
  if (existing.cnt > 0) {
    const allCh = db.prepare('SELECT id FROM channels WHERE screen = ? ORDER BY position ASC').all(scr);
    const ordered = db.prepare('SELECT channel_id FROM user_channel_order WHERE user_id = ? AND screen = ?').all(userId, scr);
    const orderedSet = new Set(ordered.map(r => r.channel_id));
    let maxPos = ordered.length;
    const ins = db.prepare('INSERT OR IGNORE INTO user_channel_order (user_id, screen, channel_id, position) VALUES (?, ?, ?, ?)');
    for (const ch of allCh) {
      if (!orderedSet.has(ch.id)) ins.run(userId, scr, ch.id, maxPos++);
    }
    return;
  }
  const channels = db.prepare('SELECT id, position FROM channels WHERE screen = ? ORDER BY position ASC').all(scr);
  const ins = db.prepare('INSERT INTO user_channel_order (user_id, screen, channel_id, position) VALUES (?, ?, ?, ?)');
  db.transaction((list) => list.forEach(ch => ins.run(userId, scr, ch.id, ch.position)))(channels);
}

async function getAll(screen) {
  ensureSeedIfEmpty();
  return db.prepare('SELECT * FROM channels WHERE screen = ? ORDER BY position ASC').all(screen || 'main');
}

async function getChannelsForUser(userId, screen) {
  ensureSeedIfEmpty();
  const scr = screen || 'main';
  ensureUserChannelOrder(userId, scr);
  return db.prepare(`
    SELECT c.*, uco.position AS user_position
    FROM channels c
    INNER JOIN user_channel_order uco
      ON uco.channel_id = c.id AND uco.user_id = ? AND uco.screen = ?
    WHERE c.screen = ?
    ORDER BY uco.position ASC
  `).all(userId, scr, scr);
}

async function reorderUserChannels(userId, screen, ids) {
  const scr = screen || 'main';
  const upsert = db.prepare(`
    INSERT INTO user_channel_order (user_id, screen, channel_id, position) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, screen, channel_id) DO UPDATE SET position = excluded.position
  `);
  db.transaction((list) => list.forEach((id, i) => upsert.run(userId, scr, id, i)))(ids);
}

async function getUserPreference(userId, screen) {
  const scr = screen || 'main';
  const row = db.prepare('SELECT channel_count FROM user_preferences WHERE user_id = ? AND screen = ?').get(userId, scr);
  if (row) return row.channel_count;
  db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, screen, channel_count) VALUES (?, ?, ?)').run(userId, scr, FEATURED_LAYOUT_COUNT);
  return FEATURED_LAYOUT_COUNT;
}

async function setUserPreference(userId, screen, channelCount) {
  const scr = screen || 'main';
  db.prepare(`
    INSERT INTO user_preferences (user_id, screen, channel_count) VALUES (?, ?, ?)
    ON CONFLICT(user_id, screen) DO UPDATE SET channel_count = excluded.channel_count
  `).run(userId, scr, channelCount);
  return channelCount;
}

async function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

async function createUser(username, passwordHash) {
  const r = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
}

async function seedUsers(passwordHash) {
  return seedUsersSync(passwordHash);
}

async function insert(channel) {
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM channels WHERE screen = ?').get(channel.screen || 'main').m;
  const r = db.prepare('INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES (?, ?, ?, ?, ?, ?)').run(channel.name, channel.source || '', channel.type || 'youtube', maxPos + 1, channel.screen || 'main', channel.yt_channel_id || null);
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(r.lastInsertRowid);
}

async function update(id, data) {
  const fields = [], values = [];
  if (data.name !== undefined)          { fields.push('name = ?');          values.push(data.name); }
  if (data.source !== undefined)        { fields.push('source = ?');        values.push(data.source); }
  if (data.type !== undefined)          { fields.push('type = ?');          values.push(data.type); }
  if (data.yt_channel_id !== undefined) { fields.push('yt_channel_id = ?'); values.push(data.yt_channel_id || null); }
  if (!fields.length) return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
}

async function addJobLog(entry) {
  db.prepare(`INSERT INTO job_logs (ran_at, total, broken, fixed, unfixable, detail) VALUES (?, ?, ?, ?, ?, ?)`).run(
    entry.ran_at, entry.total, entry.broken, entry.fixed, entry.unfixable, JSON.stringify(entry.detail)
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

module.exports = {
  getAll,
  getChannelsForUser,
  reorderUserChannels,
  getUserPreference,
  setUserPreference,
  findUserByUsername,
  createUser,
  seedUsers,
  insert,
  update,
  remove,
  reorder,
  addJobLog,
  getJobLogs,
  forceReseed,
};
