import db from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireUser(req, res);
  if (!session) return;

  const screen = req.query.screen || 'main';

  if (req.method === 'GET') {
    const channelCount = await db.getUserPreference(session.userId, screen);
    return res.status(200).json({ channelCount, screen });
  }

  if (req.method === 'PUT') {
    const { channelCount } = req.body || {};
    if (!channelCount || typeof channelCount !== 'number') {
      return res.status(400).json({ error: 'channelCount gerekli' });
    }
    const saved = await db.setUserPreference(session.userId, screen, channelCount);
    return res.status(200).json({ channelCount: saved, screen });
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end();
}
