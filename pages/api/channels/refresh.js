import db from '../../../lib/db';
import { findLiveVideoByChannelId } from '../../../lib/check-links';
import { requireUser } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireUser(req, res);
  if (!session) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const { id, yt_channel_id } = req.body;
  if (!id || !yt_channel_id) return res.status(400).json({ error: 'id ve yt_channel_id gerekli' });

  // yt_channel_id'yi kaydet
  await db.update(id, { yt_channel_id });

  // YouTube API ile canlı yayın bul
  const liveId = await findLiveVideoByChannelId(yt_channel_id);
  if (liveId) {
    await db.update(id, { source: liveId });
  } else {
    // Canlı yayın bulunamadıysa, eski/geçersiz bir source (ör. tür değişiminden
    // kalma m3u8 linki) kalmışsa temizle; boş bırakmak siyah ekranda takılı
    // kalmaktan daha güvenli (player 'yayın bulunamadı' durumuna düşer).
    const [mainList, bolgeList] = await Promise.all([db.getAll('main'), db.getAll('bolge')]);
    const current = mainList.find(c => c.id === id) || bolgeList.find(c => c.id === id);
    if (current && current.source && /^https?:\/\//.test(current.source)) {
      await db.update(id, { source: '' });
    }
  }

  const [mainList, bolgeList] = await Promise.all([db.getAll('main'), db.getAll('bolge')]);
  const updated = mainList.find(c => c.id === id) || bolgeList.find(c => c.id === id);

  res.status(200).json({ channel: updated, liveId, updated: !!liveId });
}
