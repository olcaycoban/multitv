import { getIronSession } from 'iron-session';

const SESSION_PASSWORD = process.env.SESSION_SECRET
  || 'multitv_dev_secret_key_min_32_chars!!';

export const sessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: 'multitv_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

export async function requireUser(req, res) {
  const session = await getSession(req, res);
  if (!session.userId) {
    res.status(401).json({ error: 'Oturum gerekli' });
    return null;
  }
  return session;
}
