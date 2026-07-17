import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const session = await getSession(req, res);
  if (!session.userId) {
    return res.status(401).json({ error: 'Oturum yok' });
  }

  return res.status(200).json({
    userId: session.userId,
    username: session.username,
  });
}
