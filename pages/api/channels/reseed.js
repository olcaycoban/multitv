import db from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const force = req.body?.force === true;

  try {
    if (force) {
      if (!db.forceReseed) return res.status(500).json({ error: 'forceReseed not supported' });
      const count = await db.forceReseed();
      return res.status(200).json({ ok: true, count, forced: true });
    }

    const main = await db.getAll('main');
    const bolge = await db.getAll('bolge');
    if (main.length === 0 && bolge.length === 0 && db.forceReseed) {
      const count = await db.forceReseed();
      return res.status(200).json({ ok: true, count, forced: false });
    }

    return res.status(200).json({ ok: true, main: main.length, bolge: bolge.length, message: 'Kanallar zaten mevcut' });
  } catch (err) {
    console.error('[reseed]', err);
    return res.status(500).json({ error: err.message });
  }
}
