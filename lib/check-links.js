/**
 * Kanal link kontrolcüsü
 * - YouTube: YouTube Data API v3 ile canlı yayın kontrolü (videos.list → search.list)
 * - HLS: HTTP HEAD/GET isteği ile kontrol
 * - Bozuk linkler DB'de otomatik güncellenir
 */

const https = require('https');
const http = require('http');
const db = require('./db');

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

// YouTube kanal handle → YouTube Channel ID eşlemesi
// Eğer ID bilinmiyorsa handle üzerinden otomatik çözülür
const YT_CHANNEL_IDS = {
  'A Haber':             'UCdSHBamdV0pKJGXHPIQBFBg',
  'CNN Türk':            'UCbHX7EBgxNqvPXCWzBvdRoQ',
  'NTV':                 'UCr-9MsWxmfgFQYl0UpIkYWg',
  'TVNET':               'UCBiD7SJFKFfkMFuJ1S8nDpA',
  'Ulusal Kanal':        'UCwkjVBHFT3rFTgRPJzKuFpA',
  'Haber Global':        'UCe1BpzzMuEXD7vDrS8gCmNA',
  'Diyanet TV':          'UCX72RhpbwpCiqEwSULBNIXw',
  'Sözcü TV':            'UC7V4PpVjUDjInrqBeTjBNuA',
  'CNBC-e':              'UCwi6T_sIksAqIK7uSEhGYFg',
  'HT Spor':             'UCfGTxjqaHiTKMICMmfJFaKA',
  'ABC News':            'UCBi2mrWuNuyYy4gbM6fU18Q',
  'ARY News':            'UCpwvZwUam-URkxB7g4USKpg',
  'Sky News':            'UCoMdktPbSTixAyNGwb-UYkQ',
  'Al Jazeera Arabic':   'UCNye-wNBqNL5ZzHSJj3l8Bg',
  'Al Jazeera English':  'UCNye-wNBqNL5ZzHSJj3l8Bg',
  // bolge
  'BBC News':            'UC16niRr50-MSBwiO3YDb3RA',
  'NBC News':            'UCeY0bbntWzzVIaj2z3QigXg',
  'LiveNOW from FOX':    'UCoZezAMSFMbBpGDc4vuElrQ',
  'WION':                'UCEzOHFbSaZ4jYd4RiXDaEnA',
  'Al Arabiya':          'UCFhDnrBCnYe-aeVtgRuSPJw',
  'Al Hadath':           'UCpBCE2NfVUKNBPMBvmNqzCQ',
  'Al Mayadeen':         'UC2qpFxk4dKjBP-U0x3UbMnQ',
  'Al Qahera News':      'UCqzNfGBPFWgcD9fgHpIXChA',
  'Al Ikhbariya':        'UCTHg6DvE6hl6G_A9mIJ4fPw',
  'Roya News':           'UCHNOzPfH3G1bM0aZS7SRqYw',
  'BBC Arabic':          'UCVPjBMUFP-WRyHBZfBHHMiA',
  'Aaj Tak':             'UCt4t-jeY85JegMlZ-E5UWtA',
  'TV9 Bharatvarsh':     'UCXlqHnC2qrMJPvfmCLlGKrg',
  'ABP News':            'UCXH5RNbJURwJXjc7MKDXl_g',
  'Geo News':            'UCL9tB5pDGHohj-B0K-HXzpQ',
  'ARY News':            'UCAy0dmQ9bFXkxXkXhHzplDQ',
  'Dunya News':          'UCjR7D4GkKkRm5HZzj6RSobg',
  'SAMAA TV':            'UCJmIw3l7b7E5nGTGzJFSXvA',
};

function request(url, method = 'HEAD', timeout = 10000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method, timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      if (method === 'GET') res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, ok: res.statusCode < 400 }));
    });
    req.on('error', () => resolve({ status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false }); });
    req.end();
  });
}

async function checkHls(url) {
  const res = await request(url, 'HEAD');
  if (res.ok) return true;
  const res2 = await request(url, 'GET');
  return res2.ok;
}

// YouTube Data API: mevcut video ID'si hâlâ canlı mı? (1 birim)
async function isVideoLive(videoId) {
  if (!YT_API_KEY) return null; // API key yoksa bilinmiyor
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${YT_API_KEY}`;
  const res = await request(url, 'GET');
  if (!res.ok) return false;
  try {
    const data = JSON.parse(res.body);
    const item = data.items?.[0];
    if (!item) return false;
    // Canlı yayın aktif mi?
    return item.snippet?.liveBroadcastContent === 'live';
  } catch { return false; }
}

// YouTube Data API: kanal ID'si üzerinden aktif canlı yayın bul (100 birim)
async function findLiveVideoByChannelId(channelId) {
  if (!YT_API_KEY) return null;
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&eventType=live&maxResults=1&key=${YT_API_KEY}`;
  const res = await request(url, 'GET');
  if (!res.ok) return null;
  try {
    const data = JSON.parse(res.body);
    return data.items?.[0]?.id?.videoId || null;
  } catch { return null; }
}

// Handle üzerinden Channel ID çöz (channels.list - 1 birim)
async function resolveChannelId(handle) {
  if (!YT_API_KEY) return null;
  const cleanHandle = handle.replace('@', '');
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${cleanHandle}&key=${YT_API_KEY}`;
  const res = await request(url, 'GET');
  if (!res.ok) return null;
  try {
    const data = JSON.parse(res.body);
    return data.items?.[0]?.id || null;
  } catch { return null; }
}

async function checkAndUpdate() {
  const channels = [...db.getAll('main'), ...db.getAll('bolge')];
  const broken = [], fixed = [], unfixable = [];

  console.log(`[check-links] ${new Date().toISOString()} — ${channels.length} kanal kontrol ediliyor…`);

  for (const ch of channels) {
    let alive = false;

    if (ch.type === 'hls') {
      alive = await checkHls(ch.source);
    } else {
      // YouTube: önce ucuz kontrol (1 birim)
      const liveStatus = await isVideoLive(ch.source);
      alive = liveStatus === true;
      // API key yoksa oEmbed ile fallback kontrol
      if (liveStatus === null) {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ch.source}&format=json`;
        const r = await request(oembedUrl, 'GET');
        alive = r.ok;
      }
    }

    if (alive) continue;

    broken.push(ch.name);
    console.log(`  ✗ ${ch.name} (${ch.type}) — bozuk`);

    if (ch.type === 'youtube') {
      // Kanal ID bul
      let channelId = YT_CHANNEL_IDS[ch.name];
      if (!channelId) {
        console.log(`  ? ${ch.name} — Channel ID bilinmiyor, handle ile çözülüyor…`);
        channelId = await resolveChannelId(ch.name);
      }

      if (channelId) {
        // Aktif canlı yayın ara (100 birim)
        const newId = await findLiveVideoByChannelId(channelId);
        if (newId && newId !== ch.source) {
          db.update(ch.id, { source: newId });
          fixed.push({ name: ch.name, old: ch.source, new: newId });
          console.log(`  ✓ ${ch.name} güncellendi: ${ch.source} → ${newId}`);
        } else {
          unfixable.push(ch.name);
          console.log(`  ? ${ch.name} — şu an aktif canlı yayın yok`);
        }
      } else {
        unfixable.push(ch.name);
        console.log(`  ? ${ch.name} — Channel ID bulunamadı`);
      }
    } else {
      unfixable.push(ch.name);
    }
  }

  console.log(`\n[check-links] Tamamlandı: Çalışan: ${channels.length - broken.length} | Bozuk: ${broken.length} | Düzeltilen: ${fixed.length} | Manuel gerekli: ${unfixable.length}`);
  if (unfixable.length) console.log(`  → Manuel: ${unfixable.join(', ')}`);

  return { broken, fixed, unfixable };
}

module.exports = { checkAndUpdate };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  checkAndUpdate().then(() => process.exit(0)).catch(console.error);
}
