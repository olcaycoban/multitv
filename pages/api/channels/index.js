import db from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const screen = req.query.screen || 'main';
    return res.status(200).json(await db.getAll(screen));
  }

  if (req.method === 'POST') {
    const { name, source, type, screen } = req.body;
    if (!name || !source) return res.status(400).json({ error: 'name and source required' });
    const channel = await db.insert({ name, source, type: type || 'youtube', screen: screen || 'main' });
    return res.status(201).json(channel);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}
