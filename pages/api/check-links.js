import { checkAndUpdate } from '../../lib/check-links';

// Link kontrolü uzun sürebilir, Next.js default 30sn'yi uzat
export const config = { api: { responseLimit: false } };
export const maxDuration = 300; // 5 dakika (Vercel Pro)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  try {
    const result = await checkAndUpdate();
    res.status(200).json(result);
  } catch (err) {
    console.error('[check-links]', err);
    res.status(500).json({ error: err.message });
  }
}
