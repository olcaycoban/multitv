/**
 * Kanal link kontrolcüsü
 * - YouTube: YouTube Data API v3 ile canlı yayın kontrolü (videos.list → search.list)
 * - HLS: HTTP HEAD/GET isteği ile kontrol
 * - Bozuk linkler DB'de otomatik güncellenir
 */

const https = require('https');
const http = require('http');
const { getAll, update, addJobLog } = require('./db');

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// YouTube Data API: kanal ID'si üzerinden aktif canlı yayın bul (100 birim)
// Google'ın search.list ucunda bilinen aralıklı "accountDelegationForbidden" 403 hatası
// oluşabiliyor; bu geçici bir servis hatası olduğu için birkaç kez tekrar deneriz.
async function findLiveVideoByChannelId(channelId, retries = 5) {
  if (!YT_API_KEY) return null;
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&eventType=live&maxResults=1&key=${YT_API_KEY}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await request(url, 'GET');
    if (res.ok) {
      try {
        const data = JSON.parse(res.body);
        return data.items?.[0]?.id?.videoId || null;
      } catch { return null; }
    }
    // 403 accountDelegationForbidden gibi geçici hatalarda tekrar dene
    if (attempt < retries) await sleep(500 * (attempt + 1));
  }
  return null;
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
  const [main, bolge] = await Promise.all([getAll('main'), getAll('bolge')]);
  const channels = [...main, ...bolge];
  const broken = [], fixed = [], unfixable = [];
  const ran_at = new Date().toISOString();

  console.log(`[check-links] ${ran_at} — ${channels.length} kanal kontrol ediliyor…`);

  for (const ch of channels) {
    let alive = false;

    if (ch.type === 'hls') {
      alive = await checkHls(ch.source);
    } else {
      const liveStatus = await isVideoLive(ch.source);
      alive = liveStatus === true;
      if (liveStatus === null) {
        const r = await request(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ch.source}&format=json`, 'GET');
        alive = r.ok;
      }
    }

    if (alive) continue;

    broken.push(ch.name);
    console.log(`  ✗ ${ch.name} (${ch.type}) — bozuk`);

    if (ch.type === 'youtube') {
      // Önce DB'den yt_channel_id bak, sonra hardcoded map, sonra API ile çöz
      let channelId = ch.yt_channel_id || YT_CHANNEL_IDS[ch.name];
      if (!channelId) {
        console.log(`  ? ${ch.name} — Channel ID yok, handle ile çözülüyor…`);
        channelId = await resolveChannelId(ch.name);
        if (channelId) {
          // Çözülen ID'yi DB'ye kaydet
          await update(ch.id, { yt_channel_id: channelId });
          console.log(`  ℹ ${ch.name} — Channel ID kaydedildi: ${channelId}`);
        }
      }

      if (channelId) {
        const newId = await findLiveVideoByChannelId(channelId);
        if (newId && newId !== ch.source) {
          await update(ch.id, { source: newId });
          fixed.push({ name: ch.name, old: ch.source, new: newId });
          console.log(`  ✓ ${ch.name} güncellendi: ${ch.source} → ${newId}`);
        } else {
          unfixable.push(ch.name);
          console.log(`  ? ${ch.name} — aktif canlı yayın bulunamadı`);
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

  // Sonucu DB'ye kaydet
  await addJobLog({
    ran_at,
    total: channels.length,
    broken: broken.length,
    fixed: fixed.length,
    unfixable: unfixable.length,
    detail: { broken, fixed, unfixable },
  });

  return { broken, fixed, unfixable };
}

/** Tüm YouTube kanalları için canlı yayın ID'sini API'den çeker (bozuk olsun olmasın). */
async function fetchAllLiveLinks(screen) {
  const channels = screen ? await getAll(screen) : [...(await getAll('main')), ...(await getAll('bolge'))];
  const updated = [], unchanged = [], notFound = [], skipped = [];
  const ran_at = new Date().toISOString();

  console.log(`[fetch-links] ${ran_at} — ${channels.length} kanal (${screen || 'tümü'})`);

  for (const ch of channels) {
    if (ch.type !== 'youtube') {
      skipped.push(ch.name);
      continue;
    }

    let channelId = (ch.yt_channel_id || '').trim() || YT_CHANNEL_IDS[ch.name];
    if (!channelId) {
      channelId = await resolveChannelId(ch.name);
    }
    if (!channelId) {
      notFound.push(ch.name);
      console.log(`  ? ${ch.name} — Channel ID yok`);
      continue;
    }

    let liveId = await findLiveVideoByChannelId(channelId);
    if (!liveId && YT_CHANNEL_IDS[ch.name] && YT_CHANNEL_IDS[ch.name] !== channelId) {
      channelId = YT_CHANNEL_IDS[ch.name];
      liveId = await findLiveVideoByChannelId(channelId);
    }
    if (!liveId) {
      notFound.push(ch.name);
      console.log(`  ? ${ch.name} — canlı yayın bulunamadı`);
      await sleep(200);
      continue;
    }

    const patch = { source: liveId };
    if (channelId !== ch.yt_channel_id) patch.yt_channel_id = channelId;

    if (liveId === ch.source && channelId === ch.yt_channel_id) {
      unchanged.push(ch.name);
    } else {
      await update(ch.id, patch);
      updated.push({ name: ch.name, old: ch.source, new: liveId });
      console.log(`  ✓ ${ch.name}: ${ch.source || '(boş)'} → ${liveId}`);
    }

    await sleep(200);
  }

  console.log(`[fetch-links] Güncellenen: ${updated.length} | Değişmeyen: ${unchanged.length} | Bulunamayan: ${notFound.length}`);

  await addJobLog({
    ran_at,
    total: channels.length,
    broken: notFound.length,
    fixed: updated.length,
    unfixable: notFound.length,
    detail: { updated, unchanged, notFound, skipped, screen: screen || 'all' },
  });

  return { updated, unchanged, notFound, skipped };
}

module.exports = { checkAndUpdate, findLiveVideoByChannelId, fetchAllLiveLinks };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  checkAndUpdate().then(() => process.exit(0)).catch(console.error);
}
