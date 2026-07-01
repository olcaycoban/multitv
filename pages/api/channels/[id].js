import db from '../../../lib/db';

export default function handler(req, res) {
  const id = parseInt(req.query.id, 10);

  if (req.method === 'PATCH') {
    const { name, source, type } = req.body;
    const updated = db.update(id, { name, source, type });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    db.remove(id);
    return res.status(204).end();
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  res.status(405).end();
}
