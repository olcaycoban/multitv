import db from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const screen = req.query.screen || 'main';
    return res.status(200).json(await db.getAll(screen));
  }

  if (req.method === 'POST') {
    const { name, source, type, screen, yt_channel_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const channelType = type || 'youtube';
    if (channelType === 'hls' && !(source || '').trim()) {
      return res.status(400).json({ error: 'HLS kanalları için source gerekli' });
    }
    const channel = await db.insert({
      name,
      source: (source || '').trim(),
      type: channelType,
      screen: screen || 'main',
      yt_channel_id: yt_channel_id || null,
    });
    return res.status(201).json(channel);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}
