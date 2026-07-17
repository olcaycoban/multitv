import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Giriş başarısız');
        return;
      }
      const from = typeof router.query.from === 'string' ? router.query.from : '/';
      router.push(from === '/login' ? '/' : from);
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Giriş — MultiTV</title></Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        padding: 24,
      }}>
        <form onSubmit={handleSubmit} style={{
          width: '100%',
          maxWidth: 360,
          background: '#111',
          border: '1px solid #222',
          borderRadius: 8,
          padding: 32,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            MultiTV
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            T.C. Cumhurbaşkanlığı İletişim Başkanlığı
          </p>

          {error && (
            <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
            Kullanıcı adı
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="user1"
            autoComplete="username"
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 16,
              background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
              color: '#fff', fontSize: 14, boxSizing: 'border-box',
            }}
          />

          <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
            Şifre
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 24,
              background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
              color: '#fff', fontSize: 14, boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 12,
              background: '#c61d23', color: '#fff', border: 'none',
              borderRadius: 4, fontSize: 14, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </>
  );
}
