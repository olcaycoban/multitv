import db from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await requireUser(req, res);
  if (!session) return;

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end();
  }

  const { ids, screen } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  await db.reorderUserChannels(session.userId, screen || 'main', ids);
  res.status(200).json({ ok: true });
}
