import { fetchAllLiveLinks } from '../../../lib/check-links';

export const maxDuration = 300;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const screen = req.body?.screen || null;
  try {
    const result = await fetchAllLiveLinks(screen);
    res.status(200).json(result);
  } catch (err) {
    console.error('[fetch-links]', err);
    res.status(500).json({ error: 'Linkler çekilemedi' });
  }
}
