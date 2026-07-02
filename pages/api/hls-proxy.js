// Bazı yayıncılar (ör. Ciner Holding CDN'i) m3u8 playlist dosyalarında CORS
// header'ı göndermiyor; tarayıcı bu yüzden hls.js ile doğrudan oynatmayı
// engelliyor. Bu proxy playlist'i sunucu tarafında çekip CORS ekleyerek
// geri verir ve içindeki göreli linkleri tekrar bu proxy üzerinden geçecek
// şekilde yeniden yazar (master -> variant -> segment zinciri).
export const config = { api: { responseLimit: false } };

const PLAYLIST_EXT = /\.m3u8(\?|$)/i;

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parametresi gerekli' });

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'geçersiz url' });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return res.status(400).json({ error: 'sadece http(s) desteklenir' });
  }

  try {
    const upstream = await fetch(target.href, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: target.origin },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const contentType = upstream.headers.get('content-type') || '';
    const isPlaylist = PLAYLIST_EXT.test(target.pathname) || contentType.includes('mpegurl') || contentType.includes('x-mpegurl');

    if (isPlaylist) {
      const text = await upstream.text();
      const rewritten = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const abs = new URL(trimmed, target.href).href;
          return `/api/hls-proxy?url=${encodeURIComponent(abs)}`;
        })
        .join('\n');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(rewritten);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('[hls-proxy]', err.message);
    return res.status(502).json({ error: 'upstream hatası' });
  }
}
