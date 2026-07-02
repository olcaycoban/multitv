import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }
  const raw = await db.getJobLogs(10);
  const logs = raw.map(log => ({
    ...log,
    detail: log.detail ? JSON.parse(log.detail) : null,
  }));
  res.status(200).json(logs);
}
