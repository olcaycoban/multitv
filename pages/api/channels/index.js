import db from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireUser(req, res);
  if (!session) return;

  const screen = req.query.screen || req.body?.screen || 'main';

  if (req.method === 'GET') {
    const channels = await db.getChannelsForUser(session.userId, screen);
    return res.status(200).json(channels);
  }

  if (req.method === 'POST') {
    const { name, source, type, yt_channel_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const channelType = type || 'youtube';
    if (channelType === 'hls' && !(source || '').trim()) {
      return res.status(400).json({ error: 'HLS kanalları için source gerekli' });
    }
    const channel = await db.insert({
      name,
      source: (source || '').trim(),
      type: channelType,
      screen,
      yt_channel_id: yt_channel_id || null,
    });
    const existing = await db.getChannelsForUser(session.userId, screen);
    const ids = existing.map(c => c.id);
    if (!ids.includes(channel.id)) ids.push(channel.id);
    await db.reorderUserChannels(session.userId, screen, ids);
    return res.status(201).json(channel);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}
