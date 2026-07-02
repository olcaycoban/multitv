const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On Vercel (read-only filesystem) use /tmp, otherwise use lib/
const DB_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'lib');
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

// Migration: eski DB'lerde yt_channel_id kolonu olmayabilir
const existingCols = db.prepare("PRAGMA table_info(channels)").all().map(c => c.name);
if (!existingCols.includes('yt_channel_id')) {
  db.exec('ALTER TABLE channels ADD COLUMN yt_channel_id TEXT DEFAULT NULL');
}

const defaultChannels = [
  { name: 'TRT Haber',           source: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',           type: 'hls',     screen: 'main' },
  { name: 'A Haber',             source: 'RlHW5wX9Iqc',                                                type: 'youtube', screen: 'main' },
  { name: 'CNN Türk',            source: '6N8_r2uwLEc',                                                 type: 'youtube', screen: 'main' },
  { name: 'NTV',                 source: 'pqq5c6k70kk',                                                 type: 'youtube', screen: 'main' },
  { name: 'TVNET',               source: 'Z5bqy4gwEmc',                                                 type: 'youtube', screen: 'main' },
  { name: 'Ulusal Kanal',        source: 'Gcxkjxhbhk8',                                                 type: 'youtube', screen: 'main' },
  { name: 'Bengütürk TV',        source: 'https://tv.ensonhaber.com/benguturk/benguturk.m3u8',          type: 'hls',     screen: 'main' },
  { name: 'TRT Avaz',            source: 'https://tv-trtavaz.medya.trt.com.tr/master.m3u8',             type: 'hls',     screen: 'main' },
  { name: '24 TV',               source: 'https://tv.ensonhaber.com/tv24/tv24.m3u8',                    type: 'hls',     screen: 'main' },
  { name: 'TGRT Haber',          source: 'https://canli.tgrthaber.com/tgrt.m3u8',                       type: 'hls',     screen: 'main' },
  { name: 'Haber Global',        source: 'EqoCJ8BPxtE',                                                 type: 'youtube', screen: 'main' },
  { name: 'Diyanet TV',          source: '8KOE6__ogN8',                                                 type: 'youtube', screen: 'main' },
  { name: 'Sözcü TV',            source: 'ztmY_cCtUl0',                                                 type: 'youtube', screen: 'main' },
  { name: 'Habertürk',           source: 'https://tv.ensonhaber.com/haberturk/haberturk.m3u8',          type: 'hls',     screen: 'main' },
  { name: 'Halk TV',             source: 'https://halktv-live.daioncdn.net/halktv/halktv.m3u8',         type: 'hls',     screen: 'main' },
  { name: 'CNBC-e',              source: 'aZ3ycSbSYBA',                                                 type: 'youtube', screen: 'main' },
  { name: 'Bloomberg HT',        source: 'https://tv.ensonhaber.com/bloomberght/bloomberght.m3u8',      type: 'hls',     screen: 'main' },
  // HT Spor'un YouTube yayınları Ciner Holding tarafından 3. parti sitelerde gömülü oynatmaya kapatılmış
  // ("Video kullanılamıyor" hatası); bu yüzden resmi HLS akışı CORS proxy üzerinden kullanılıyor.
  { name: 'HT Spor',             source: '/api/hls-proxy?url=' + encodeURIComponent('https://ciner.daioncdn.net/ht-spor/ht-spor.m3u8?app=web'), type: 'hls', screen: 'main' },
  { name: 'Ekol Spor',           source: 'https://ekoltv-live.ercdn.net/ekolsport/ekolsport.m3u8',      type: 'hls',     screen: 'main' },
  { name: 'ABC News',            source: 'iipR5yUp36o',                                                 type: 'youtube', screen: 'main' },
  { name: 'ARY News',            source: '0mfl0-jFPnQ',                                                 type: 'youtube', screen: 'main' },
  { name: 'Sky News',            source: 'NygUCOEHrF8',                                                 type: 'youtube', screen: 'main' },
  { name: 'Al Jazeera Arabic',   source: 'bNyUyrR0PHo',                                                 type: 'youtube', screen: 'main' },
  { name: 'Al Jazeera English',  source: 'gCNeDWCI0vo',                                                 type: 'youtube', screen: 'main' },
  { name: 'CCTV Chinese',        source: 'fN9uYWCjQaw',                                                 type: 'youtube', screen: 'main' },
  // bolge
  { name: 'BBC News',            source: 'KyG6amQVSco',  type: 'youtube', screen: 'bolge' },
  { name: 'Sky News',            source: 'NygUCOEHrF8',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Jazeera English',  source: 'gCNeDWCI0vo',  type: 'youtube', screen: 'bolge' },
  { name: 'NBC News',            source: 'RrR3Bn60J7I',  type: 'youtube', screen: 'bolge' },
  { name: 'ABC News',            source: 'iipR5yUp36o',  type: 'youtube', screen: 'bolge' },
  { name: 'LiveNOW from FOX',    source: 'R_lRjToLD3U',  type: 'youtube', screen: 'bolge' },
  { name: 'WION',                source: 'R5xoxZHurjQ',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Arabiya',          source: 'n7eQejkXbnM',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Jazeera Arabic',   source: 'bNyUyrR0PHo',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Hadath',           source: '0STUpSryLWY',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Mayadeen',         source: '4BkAZijHnDQ',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Qahera News',      source: 'G0JuCygkBkA',  type: 'youtube', screen: 'bolge' },
  { name: 'Al Ikhbariya',        source: 'yYJjtr3fbZE',  type: 'youtube', screen: 'bolge' },
  { name: 'Roya News',           source: 'A1cZxijueg4',  type: 'youtube', screen: 'bolge' },
  { name: 'BBC Arabic',          source: 'O1pGmVtj2Y8',  type: 'youtube', screen: 'bolge' },
  { name: 'Phoenix TV',          source: 'fN9uYWCjQaw',  type: 'youtube', screen: 'bolge' },
  { name: 'CCTV Chinese',        source: 'f6Kq93wnaZ8',  type: 'youtube', screen: 'bolge' },
  { name: 'CTi TV',              source: 'PA8kLd6m2Jc',  type: 'youtube', screen: 'bolge' },
  { name: 'Aaj Tak',             source: 'Ogw1-dwX4yA',  type: 'youtube', screen: 'bolge' },
  { name: 'TV9 Bharatvarsh',     source: 'YDahJR8XeK4',  type: 'youtube', screen: 'bolge' },
  { name: 'ABP News',            source: 'nyd-xznCpJc',  type: 'youtube', screen: 'bolge' },
  { name: 'Geo News',            source: 'Zc7P7sG0lNk',  type: 'youtube', screen: 'bolge' },
  { name: 'ARY News',            source: '0mfl0-jFPnQ',  type: 'youtube', screen: 'bolge' },
  { name: 'Dunya News',          source: 'Z4V6mQbMnPA',  type: 'youtube', screen: 'bolge' },
  { name: 'SAMAA TV',            source: 'wAy-Xq-ciLI',  type: 'youtube', screen: 'bolge' },
];

const count = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
if (count.cnt === 0) {
  const ins = db.prepare('INSERT INTO channels (name, source, type, position, screen) VALUES (?, ?, ?, ?, ?)');
  db.transaction((list) => list.forEach((ch, i) => ins.run(ch.name, ch.source, ch.type, i, ch.screen)))(defaultChannels);
}

function getAll(screen) {
  return db.prepare('SELECT * FROM channels WHERE screen = ? ORDER BY position ASC').all(screen || 'main');
}

function insert(channel) {
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM channels WHERE screen = ?').get(channel.screen || 'main').m;
  const r = db.prepare('INSERT INTO channels (name, source, type, position, screen) VALUES (?, ?, ?, ?, ?)').run(channel.name, channel.source, channel.type || 'youtube', maxPos + 1, channel.screen || 'main');
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(r.lastInsertRowid);
}

function update(id, data) {
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

function addJobLog(entry) {
  db.prepare(`INSERT INTO job_logs (ran_at, total, broken, fixed, unfixable, detail)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    entry.ran_at, entry.total, entry.broken, entry.fixed, entry.unfixable,
    JSON.stringify(entry.detail)
  );
}

function getJobLogs(limit = 10) {
  return db.prepare('SELECT * FROM job_logs ORDER BY id DESC LIMIT ?').all(limit);
}

function remove(id) {
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

function reorder(ids) {
  const stmt = db.prepare('UPDATE channels SET position = ? WHERE id = ?');
  db.transaction((list) => list.forEach((id, i) => stmt.run(i, id)))(ids);
}

module.exports = { getAll, insert, update, remove, reorder, addJobLog, getJobLogs };
