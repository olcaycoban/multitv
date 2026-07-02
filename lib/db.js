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

// NOT: Bu liste periyodik olarak local geliştirme veritabanının o anki güncel
// hâliyle senkronize edilir (bkz. "veritabanını senkronize et" işlemleri).
// Vercel'de /tmp kalıcı olmadığı için her soğuk başlangıçta DB burada
// tanımlı hâliyle yeniden oluşturulur — bu yüzden burasının local ile
// mümkün olduğunca güncel tutulması önemlidir.
const defaultChannels = [
  { name: 'A Haber',             source: 'jCoBWUqi6AI',  type: 'youtube', screen: 'main', yt_channel_id: 'UCKQhfw-lzz0uKnE1fY1PsAA' },
  { name: 'TRT Haber',           source: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8', type: 'hls', screen: 'main', yt_channel_id: 'UCBgTP2LOFVPmq15W-RH-WXA' },
  { name: 'CNN Türk',            source: '9wr7TdawWDM',  type: 'youtube', screen: 'main', yt_channel_id: 'UCV6zcRug6Hqp1UX_FdyUeBg' },
  { name: 'NTV',                 source: 'pqq5c6k70kk',  type: 'youtube', screen: 'main', yt_channel_id: 'UC9TDTjbOjFB9jADmPhSAPsw' },
  { name: 'TVNET',               source: 'Z5bqy4gwEmc',  type: 'youtube', screen: 'main', yt_channel_id: 'UC8rh34IlJTN0lDZlTwzWzjg' },
  { name: 'Ulusal Kanal',        source: 'Gcxkjxhbhk8',  type: 'youtube', screen: 'main', yt_channel_id: 'UC6T0L26KS1NHMPbTwI1L4Eg' },
  { name: 'Bengütürk TV',        source: 'W-wgfi-XdN8',  type: 'youtube', screen: 'main', yt_channel_id: 'UChNgvcVZ_ggDdZ0zCcuuzFw' },
  { name: 'TRT Avaz',            source: 'https://tv-trtavaz.medya.trt.com.tr/master.m3u8', type: 'hls', screen: 'main', yt_channel_id: null },
  { name: '24 TV',               source: '6B-nPOdP720',  type: 'youtube', screen: 'main', yt_channel_id: 'UCN7VYCsI4Lx1-J4_BtjoWUA' },
  { name: 'TGRT Haber',          source: 'WX29nlgdqho',  type: 'youtube', screen: 'main', yt_channel_id: 'UCzgrZ-CndOoylh2_e72nSBQ' },
  { name: 'Haber Global',        source: 'iB3PHjSQbD8',  type: 'youtube', screen: 'main', yt_channel_id: 'UCtc-a9ZUIg0_5HpsPxEO7Qg' },
  { name: 'Sözcü TV',            source: '2HeJEAclom0',  type: 'youtube', screen: 'main', yt_channel_id: 'UCOulx_rep5O4i9y6AyDqVvw' },
  { name: 'Bloomberg HT',        source: 'https://tv.ensonhaber.com/bloomberght/bloomberght.m3u8', type: 'hls', screen: 'main', yt_channel_id: null },
  // HT Spor'un YouTube yayınları Ciner Holding tarafından 3. parti sitelerde gömülü oynatmaya kapatılmış
  // ("Video kullanılamıyor" hatası); bu yüzden resmi HLS akışı CORS proxy üzerinden kullanılıyor.
  { name: 'HT Spor',             source: '/api/hls-proxy?url=' + encodeURIComponent('https://ciner.daioncdn.net/ht-spor/ht-spor.m3u8?app=web'), type: 'hls', screen: 'main', yt_channel_id: 'UCK3mI2lsk3LSo8PBUc8JTSw' },
  { name: 'Ekol Spor',           source: 'https://ekoltv-live.ercdn.net/ekolsport/ekolsport.m3u8', type: 'hls', screen: 'main', yt_channel_id: null },
  { name: 'Habertürk',           source: 'https://tv.ensonhaber.com/haberturk/haberturk.m3u8', type: 'hls', screen: 'main', yt_channel_id: null },
  { name: 'Halk TV',             source: 'https://halktv-live.daioncdn.net/halktv/halktv.m3u8', type: 'hls', screen: 'main', yt_channel_id: null },
  { name: 'CNBC-e',              source: 'aZ3ycSbSYBA',  type: 'youtube', screen: 'main', yt_channel_id: 'UCaO-M1dXacMwtyg0Pvovk4w' },
  { name: 'ABC News',            source: 'iipR5yUp36o',  type: 'youtube', screen: 'main', yt_channel_id: 'UCBi2mrWuNuyYy4gbM6fU18Q' },
  { name: 'ARY News',            source: '0mfl0-jFPnQ',  type: 'youtube', screen: 'main', yt_channel_id: 'UCMmpLL2ucRHAXbNHiCPyIyg' },
  { name: 'Diyanet TV',          source: '8KOE6__ogN8',  type: 'youtube', screen: 'main', yt_channel_id: 'UC3d1AdmvAP6Jq16-WpD086g' },
  { name: 'Sky News',            source: 'NygUCOEHrF8',  type: 'youtube', screen: 'main', yt_channel_id: null },
  { name: 'Al Jazeera Arabic',   source: 'bNyUyrR0PHo',  type: 'youtube', screen: 'main', yt_channel_id: null },
  { name: 'Al Jazeera English',  source: 'gCNeDWCI0vo',  type: 'youtube', screen: 'main', yt_channel_id: null },
  { name: 'CCTV Chinese',        source: 'fN9uYWCjQaw',  type: 'youtube', screen: 'main', yt_channel_id: null },
  // bolge
  { name: 'BBC News',            source: 'KyG6amQVSco',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UC16niRr50-MSBwiO3YDb3RA' },
  { name: 'Al Ikhbariya',        source: '-GNCZ-jQxds',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UClm30t2F4FHzzkN9Irtr-8A' },
  { name: 'LiveNOW from FOX',    source: 'STIC5CtlwG0',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UCJg9wBPyKMNA5sRDnvzmkdg' },
  { name: 'Al Hadath',           source: 'YH7jiYciTq4',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UCrj5BGAhtWxDfqbza9T9hqA' },
  { name: 'Al Mayadeen',         source: 'gfOMo6c6dlo',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UCZCFHCU-2eGF7V5ciMkoPHw' },
  { name: 'Al Qahera News',      source: 'Y0zifigSWSo',  type: 'youtube', screen: 'bolge', yt_channel_id: 'UCktyejXTxWaKfrgp1Oq7CMQ' },
  { name: 'Sky News',            source: 'NygUCOEHrF8',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Al Jazeera English',  source: 'gCNeDWCI0vo',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'NBC News',            source: 'RrR3Bn60J7I',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'ABC News',            source: 'iipR5yUp36o',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'LiveNOW from FOX',    source: 'R_lRjToLD3U',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'WION',                source: 'R5xoxZHurjQ',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Al Arabiya',          source: 'n7eQejkXbnM',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Al Jazeera Arabic',   source: 'bNyUyrR0PHo',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Roya News',           source: 'A1cZxijueg4',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'BBC Arabic',          source: 'O1pGmVtj2Y8',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Phoenix TV',          source: 'fN9uYWCjQaw',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'CCTV Chinese',        source: 'f6Kq93wnaZ8',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'CTi TV',              source: 'PA8kLd6m2Jc',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Aaj Tak',             source: 'Ogw1-dwX4yA',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'TV9 Bharatvarsh',     source: 'YDahJR8XeK4',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'ABP News',            source: 'nyd-xznCpJc',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Geo News',            source: 'Zc7P7sG0lNk',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'ARY News',            source: '0mfl0-jFPnQ',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'Dunya News',          source: 'Z4V6mQbMnPA',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
  { name: 'SAMAA TV',            source: 'wAy-Xq-ciLI',  type: 'youtube', screen: 'bolge', yt_channel_id: null },
];

const count = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
if (count.cnt === 0) {
  const ins = db.prepare('INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction((list) => list.forEach((ch, i) => ins.run(ch.name, ch.source, ch.type, i, ch.screen, ch.yt_channel_id || null)))(defaultChannels);
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
