// Kalıcı Postgres (Neon / Vercel Postgres) implementasyonu.
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { defaultChannels } = require('./seed-channels');
const { FEATURED_LAYOUT_COUNT } = require('./constants');

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
            yt_channel_id TEXT    DEFAULT NULL,
            updated_at    TIMESTAMPTZ DEFAULT NOW()
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
          CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
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
          ALTER TABLE channels ADD COLUMN IF NOT EXISTS yt_channel_id TEXT DEFAULT NULL;
          ALTER TABLE channels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        `);

        const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM channels');
        if (rows[0].cnt === 0) {
          await seedChannels(pool);
        }

        const { rows: userRows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM users');
        if (userRows[0].cnt === 0) {
          const passwordHash = bcrypt.hashSync('password', 10);
          await seedUsers(passwordHash);
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

  async function ensureUserChannelOrder(userId, screen) {
    await ensureInit();
    const scr = screen || 'main';
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM user_channel_order WHERE user_id = $1 AND screen = $2',
      [userId, scr]
    );
    if (existing[0].cnt > 0) {
      const { rows: allCh } = await pool.query('SELECT id FROM channels WHERE screen = $1 ORDER BY position ASC', [scr]);
      const { rows: ordered } = await pool.query(
        'SELECT channel_id FROM user_channel_order WHERE user_id = $1 AND screen = $2',
        [userId, scr]
      );
      const orderedSet = new Set(ordered.map(r => r.channel_id));
      let maxPos = ordered.length;
      for (const ch of allCh) {
        if (!orderedSet.has(ch.id)) {
          await pool.query(
            `INSERT INTO user_channel_order (user_id, screen, channel_id, position)
             VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, screen, channel_id) DO NOTHING`,
            [userId, scr, ch.id, maxPos++]
          );
        }
      }
      return;
    }
    const { rows: channels } = await pool.query(
      'SELECT id, position FROM channels WHERE screen = $1 ORDER BY position ASC',
      [scr]
    );
    for (const ch of channels) {
      await pool.query(
        `INSERT INTO user_channel_order (user_id, screen, channel_id, position) VALUES ($1, $2, $3, $4)`,
        [userId, scr, ch.id, ch.position]
      );
    }
  }

  async function getChannelsForUser(userId, screen) {
    await ensureInit();
    await ensureSeedIfEmpty();
    const scr = screen || 'main';
    await ensureUserChannelOrder(userId, scr);
    const { rows } = await pool.query(
      `SELECT c.*, uco.position AS user_position
       FROM channels c
       INNER JOIN user_channel_order uco
         ON uco.channel_id = c.id AND uco.user_id = $1 AND uco.screen = $2
       WHERE c.screen = $2
       ORDER BY uco.position ASC`,
      [userId, scr]
    );
    return rows;
  }

  async function reorderUserChannels(userId, screen, ids) {
    await ensureInit();
    const scr = screen || 'main';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < ids.length; i++) {
        await client.query(
          `INSERT INTO user_channel_order (user_id, screen, channel_id, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, screen, channel_id) DO UPDATE SET position = $4`,
          [userId, scr, ids[i], i]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function getUserPreference(userId, screen) {
    await ensureInit();
    const scr = screen || 'main';
    const { rows } = await pool.query(
      'SELECT channel_count FROM user_preferences WHERE user_id = $1 AND screen = $2',
      [userId, scr]
    );
    if (rows.length) return rows[0].channel_count;
    await pool.query(
      `INSERT INTO user_preferences (user_id, screen, channel_count) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, screen) DO NOTHING`,
      [userId, scr, FEATURED_LAYOUT_COUNT]
    );
    return FEATURED_LAYOUT_COUNT;
  }

  async function setUserPreference(userId, screen, channelCount) {
    await ensureInit();
    const scr = screen || 'main';
    await pool.query(
      `INSERT INTO user_preferences (user_id, screen, channel_count) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, screen) DO UPDATE SET channel_count = $3`,
      [userId, scr, channelCount]
    );
    return channelCount;
  }

  async function findUserByUsername(username) {
    await ensureInit();
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  }

  async function createUser(username, passwordHash) {
    await ensureInit();
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, passwordHash]
    );
    return rows[0];
  }

  async function seedUsers(passwordHash) {
    let created = 0;
    for (let i = 1; i <= 100; i++) {
      const username = `user${i}`;
      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash) VALUES ($1, $2)
         ON CONFLICT (username) DO NOTHING RETURNING id`,
        [username, passwordHash]
      );
      if (rows.length) {
        created++;
        const userId = rows[0].id;
        for (const scr of ['main', 'bolge']) {
          await pool.query(
            `INSERT INTO user_preferences (user_id, screen, channel_count) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, screen) DO NOTHING`,
            [userId, scr, FEATURED_LAYOUT_COUNT]
          );
          const { rows: channels } = await pool.query(
            'SELECT id, position FROM channels WHERE screen = $1 ORDER BY position ASC',
            [scr]
          );
          for (const ch of channels) {
            await pool.query(
              `INSERT INTO user_channel_order (user_id, screen, channel_id, position) VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, screen, channel_id) DO NOTHING`,
              [userId, scr, ch.id, ch.position]
            );
          }
        }
      }
    }
    return created;
  }

  async function insert(channel) {
    await ensureInit();
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS m FROM channels WHERE screen = $1',
      [channel.screen || 'main']
    );
    const nextPos = maxRows[0].m + 1;
    const { rows } = await pool.query(
      `INSERT INTO channels (name, source, type, position, screen, yt_channel_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [channel.name, channel.source || '', channel.type || 'youtube', nextPos, channel.screen || 'main', channel.yt_channel_id || null]
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
      fields.push('updated_at = NOW()');
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

  return {
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
};
