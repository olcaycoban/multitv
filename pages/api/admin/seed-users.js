import bcrypt from 'bcryptjs';
import db from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const secret = process.env.ADMIN_SEED_SECRET || process.env.SESSION_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(403).json({ error: 'Yetkisiz' });
  }

  if (!db.seedUsers) {
    return res.status(500).json({ error: 'seedUsers desteklenmiyor' });
  }

  const passwordHash = bcrypt.hashSync('password', 10);
  const created = await db.seedUsers(passwordHash);
  return res.status(200).json({ created, message: `${created} yeni kullanıcı oluşturuldu` });
}
