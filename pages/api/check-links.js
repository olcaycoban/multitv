import { checkAndUpdate } from '../../lib/check-links';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  try {
    const result = await checkAndUpdate();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
