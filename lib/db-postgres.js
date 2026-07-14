// Kalıcı Postgres (Neon / Vercel Postgres) implementasyonu.
// NOT: @vercel/functions'ın attachDatabasePool'u Fluid Compute'a özgü
// varsayımlar yapıp production'da modül yüklenirken hataya yol açabildiği
// için kullanılmıyor. Bunun yerine basit bir singleton Pool; serverless
// fonksiyon sıcak (warm) kaldığı sürece Node modül cache'i sayesinde zaten
// yeniden kullanılıyor, soğuk başlangıçta da sorunsuz yeni bağlantı açılıyor.
const { Pool } = require('pg');
const { defaultChannels } = require('./seed-channels');

module.exports = function createDb(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });
  pool.on('error', (err) => {
    console.error('[db-postgres] beklenmeyen pool hatası:', err.message);
  });

  let initPromise = null;
  function ensureInit() {
    if (!initPromise) {
      initPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS channels (
            id            SERIAL PRIMARY KEY,
            name          TEXT    NOT NULL,
            source        TEXT    NOT NULL,
            type          TEXT    NOT NULL DEFAULT 'youtube',
            position      INTEGER NOT NULL DEFAULT 0,
            screen        TEXT    NOT NULL DEFAULT 'main',
            yt_channel_id TEXT    DEFAULT NULL
          );
          CREATE TABLE IF NOT EXISTS job_logs (
            id         SERIAL PRIMARY KEY,
            ran_at     TEXT    NOT NULL,
            total      INTEGER NOT NULL DEFAULT 0,
            broken     INTEGER NOT NULL DEFAULT 0,
            fixed      INTEGER NOT NULL DEFAULT 0,
            unfixable  INTEGER NOT NULL DEFAULT 0,
            detail     TEXT    DEFAULT NULL
          );
          ALTER TABLE channels ADD COLUMN IF NOT EXISTS yt_channel_id TEXT DEFAULT NULL;
        `);

        const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM channels');
        if (rows[0].cnt === 0) {
          await seedChannels(pool);
        }
      })();
    }
    return initPromise;
  }

  async function seedChannels(client) {
    for (let i = 0; i < defaultChannels.length; i++) {
      const ch = defaultChannels[i];
      await client.query(
        `INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [ch.name, ch.source, ch.type, i, ch.screen, ch.yt_channel_id || null]
      );
    }
  }

  async function ensureSeedIfEmpty() {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM channels');
    if (rows[0].cnt === 0) {
      await seedChannels(pool);
    }
  }

  async function forceReseed() {
    await ensureInit();
    await pool.query('TRUNCATE channels RESTART IDENTITY CASCADE');
    await seedChannels(pool);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM channels');
    return rows[0].cnt;
  }

  async function getAll(screen) {
    await ensureInit();
    await ensureSeedIfEmpty();
    const { rows } = await pool.query('SELECT * FROM channels WHERE screen = $1 ORDER BY position ASC', [screen || 'main']);
    return rows;
  }

  async function insert(channel) {
    await ensureInit();
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS m FROM channels WHERE screen = $1',
      [channel.screen || 'main']
    );
    const nextPos = maxRows[0].m + 1;
    const { rows } = await pool.query(
      `INSERT INTO channels (name, source, type, position, screen) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [channel.name, channel.source, channel.type || 'youtube', nextPos, channel.screen || 'main']
    );
    return rows[0];
  }

  async function update(id, data) {
    await ensureInit();
    const fields = [], values = [];
    let i = 1;
    if (data.name !== undefined)          { fields.push(`name = $${i++}`);          values.push(data.name); }
    if (data.source !== undefined)        { fields.push(`source = $${i++}`);        values.push(data.source); }
    if (data.type !== undefined)          { fields.push(`type = $${i++}`);          values.push(data.type); }
    if (data.yt_channel_id !== undefined) { fields.push(`yt_channel_id = $${i++}`); values.push(data.yt_channel_id || null); }

    if (fields.length) {
      values.push(id);
      await pool.query(`UPDATE channels SET ${fields.join(', ')} WHERE id = $${i}`, values);
    }
    const { rows } = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
    return rows[0];
  }

  async function remove(id) {
    await ensureInit();
    await pool.query('DELETE FROM channels WHERE id = $1', [id]);
  }

  async function reorder(ids) {
    await ensureInit();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < ids.length; i++) {
        await client.query('UPDATE channels SET position = $1 WHERE id = $2', [i, ids[i]]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function addJobLog(entry) {
    await ensureInit();
    await pool.query(
      `INSERT INTO job_logs (ran_at, total, broken, fixed, unfixable, detail) VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.ran_at, entry.total, entry.broken, entry.fixed, entry.unfixable, JSON.stringify(entry.detail)]
    );
  }

  async function getJobLogs(limit = 10) {
    await ensureInit();
    const { rows } = await pool.query('SELECT * FROM job_logs ORDER BY id DESC LIMIT $1', [limit]);
    return rows;
  }

  return { getAll, insert, update, remove, reorder, addJobLog, getJobLogs, forceReseed };
};
