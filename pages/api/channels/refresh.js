import db from '../../../lib/db';
import { findLiveVideoByChannelId } from '../../../lib/check-links';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const { id, yt_channel_id } = req.body;
  if (!id || !yt_channel_id) return res.status(400).json({ error: 'id ve yt_channel_id gerekli' });

  // yt_channel_id'yi kaydet
  db.update(id, { yt_channel_id });

  // YouTube API ile canlı yayın bul
  const liveId = await findLiveVideoByChannelId(yt_channel_id);
  if (liveId) {
    db.update(id, { source: liveId });
  }

  const updated = db.getAll('main').find(c => c.id === id)
    || db.getAll('bolge').find(c => c.id === id);

  res.status(200).json({ channel: updated, liveId, updated: !!liveId });
}
