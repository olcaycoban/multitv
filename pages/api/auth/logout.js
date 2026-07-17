import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const session = await getSession(req, res);
  session.destroy();
  return res.status(200).json({ ok: true });
}
