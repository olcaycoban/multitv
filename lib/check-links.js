/**
 * Kanal link kontrolcüsü
 * - HLS: HTTP HEAD isteği ile kontrol
 * - YouTube: oEmbed API ile kontrol, bozuksa kanalın /live sayfasından yeni ID çek
 * - Bozuk linkler DB'de otomatik güncellenir
 */

const https = require('https');
const http = require('http');
const db = require('./db');

// YouTube yerine HLS kullanılacak kanallar (YouTube'dan kaldırılmış/kısıtlı)
// YouTube ID bozuk çıkarsa bu HLS URL'si ile değiştirilir
const HLS_FALLBACKS = {
  'CCTV Chinese': 'https://news.cgtn.com/resource/live/chinese/cgtn-chinese.m3u8',
  'Phoenix TV':   'https://live.phoenixtv.com/phoenixtv/phoenixtv.m3u8',
};

// YouTube kanal handle → name eşlemesi (birden fazla fallback desteklenir)
// Her değer tek string ya da string[] olabilir; sırayla denenir
const YT_HANDLES = {
  'A Haber':             ['@ahaber', '@AHaber'],
  'CNN Türk':            ['@cnnturk', '@CNNTurk'],
  'NTV':                 ['@NTVTurkiye', '@ntv'],
  'TVNET':               ['@tvnet', '@TVNETHaber'],
  'Ulusal Kanal':        ['@ulusalkanal', '@UlusalKanal'],
  'Haber Global':        ['@HaberGlobal', '@haberglobal'],
  'Diyanet TV':          ['@diyanettv', '@DiyanetTV'],
  'Sözcü TV':            ['@sozcutv', '@sozcu'],
  'CNBC-e':              ['@CNBCe', '@cnbce'],
  'HT Spor':             ['@HTSpor', '@htspor'],
  'ABC News':            ['@ABCNews', '@abcnews'],
  'ARY News':            ['@ARYNewsLive', '@ARYNews'],
  'Sky News':            ['@SkyNews', '@skynews'],
  'Al Jazeera Arabic':   ['@AlJazeeraChannel', '@aljazeera'],
  'Al Jazeera English':  ['@AlJazeeraEnglish', '@aljazeeraenglish'],
  // CCTV YouTube'dan kısıtlandığı için CGTN (uluslararası yayın kolu) denenir
  'CCTV Chinese':        ['@CGTNOfficial', '@cgtn', '@CCTVNews'],
  // bolge
  'BBC News':            ['@BBCNews', '@bbcnews'],
  'NBC News':            ['@NBCNews', '@nbcnews'],
  'LiveNOW from FOX':    ['@LiveNOWfromFOX', '@LiveNOWFOX'],
  'WION':                ['@WIONews', '@wion'],
  'Al Arabiya':          ['@AlArabiya', '@alarabiya'],
  'Al Hadath':           ['@AlHadath', '@alhadath'],
  'Al Mayadeen':         ['@AlMayadeen', '@almayadeen', '@AlMayadeenEnglish', '@almayadeennetwork'],
  'Al Qahera News':      ['@AlQaheraNews', '@alqaheranews'],
  'Al Ikhbariya':        ['@AlIkhbariyaTV', '@alikhbariya', '@AlIkhbariya'],
  'Roya News':           ['@RoyaNews', '@royanews'],
  'BBC Arabic':          ['@BBCArabic', '@bbcarabic'],
  'Phoenix TV':          ['@PhoenixTVAsia', '@PhoenixTV', '@phoenixtv'],
  'CTi TV':              ['@CtivNewsChannel', '@ctitvnews', '@CTiTV'],
  'Aaj Tak':             ['@aajtak', '@AajTak'],
  'TV9 Bharatvarsh':     ['@TV9Bharatvarsh', '@tv9bharatvarsh'],
  'ABP News':            ['@abpnews', '@ABPNews'],
  'Geo News':            ['@GeoNews', '@geonews'],
  'Dunya News':          ['@dunyanews', '@DunyaNews'],
  'SAMAA TV':            ['@SAMAATVNews', '@SAMAATVHD', '@samaatvnews'],
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
  // Bazı HLS sunucuları HEAD'i reddeder, GET dene
  const res2 = await request(url, 'GET');
  return res2.ok;
}

async function checkYoutube(videoId) {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await request(oembedUrl, 'GET');
  return res.ok;
}

async function findYoutubeLiveId(handle) {
  const liveUrl = `https://www.youtube.com/${handle}/live`;
  const res = await request(liveUrl, 'GET');

  // Redirect location header
  if (res.headers && res.headers.location) {
    const match = res.headers.location.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  if (!res.body) return null;

  // "videoId":"XXXXXXXXXXX" formatı (en güvenilir)
  const m1 = res.body.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (m1) return m1[1];

  // "url":"/watch?v=XXXXXXXXXXX"
  const m2 = res.body.match(/"url":"\/watch\?v=([a-zA-Z0-9_-]{11})"/);
  if (m2) return m2[1];

  // Genel watch?v= referansı
  const m3 = res.body.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (m3) return m3[1];

  return null;
}

// Birden fazla handle sırayla dener, ilk çalışanı döndürür
async function tryHandles(handles) {
  const list = Array.isArray(handles) ? handles : [handles];
  for (const handle of list) {
    const id = await findYoutubeLiveId(handle);
    if (id) return id;
  }
  return null;
}

async function checkAndUpdate() {
  const channels = [
    ...db.getAll('main'),
    ...db.getAll('bolge'),
  ];

  const broken = [];
  const fixed = [];
  const unfixable = [];

  console.log(`[check-links] ${new Date().toISOString()} — ${channels.length} kanal kontrol ediliyor…`);

  for (const ch of channels) {
    let alive = false;

    if (ch.type === 'hls') {
      alive = await checkHls(ch.source);
    } else {
      alive = await checkYoutube(ch.source);
    }

    if (alive) continue;

    broken.push(ch.name);
    console.log(`  ✗ ${ch.name} (${ch.type}) — bozuk`);

    // YouTube kanallar için yeni ID bulmayı dene
    if (ch.type === 'youtube') {
      let resolved = false;

      // Önce YouTube handle ile dene
      const handles = YT_HANDLES[ch.name];
      if (handles) {
        const newId = await tryHandles(handles);
        if (newId && newId !== ch.source) {
          db.update(ch.id, { source: newId });
          fixed.push({ name: ch.name, old: ch.source, new: newId });
          console.log(`  ✓ ${ch.name} güncellendi (YT): ${ch.source} → ${newId}`);
          resolved = true;
        } else if (newId && newId === ch.source) {
          console.log(`  ? ${ch.name} — yayın şu an offline olabilir (ID aynı)`);
        }
      }

      // YouTube çalışmadıysa HLS fallback'e geç
      if (!resolved && HLS_FALLBACKS[ch.name]) {
        const hlsUrl = HLS_FALLBACKS[ch.name];
        const hlsAlive = await checkHls(hlsUrl);
        if (hlsAlive) {
          db.update(ch.id, { source: hlsUrl, type: 'hls' });
          fixed.push({ name: ch.name, old: ch.source, new: `${hlsUrl} (HLS)` });
          console.log(`  ✓ ${ch.name} HLS kaynağına geçildi: ${hlsUrl}`);
          resolved = true;
        }
      }

      if (!resolved) {
        unfixable.push(ch.name);
        console.log(`  ✗ ${ch.name} — otomatik düzeltilemedi`);
      }
    } else {
      // HLS için otomatik düzeltme yapılamaz, sadece raporla
      unfixable.push(ch.name);
    }
  }

  console.log(`\n[check-links] Tamamlandı:`);
  console.log(`  Çalışan: ${channels.length - broken.length}`);
  console.log(`  Bozuk: ${broken.length}`);
  console.log(`  Otomatik düzeltilen: ${fixed.length}`);
  console.log(`  Manuel müdahale gerekli: ${unfixable.length}`);
  if (unfixable.length > 0) {
    console.log(`  → Manuel güncellenmesi gerekenler: ${unfixable.join(', ')}`);
  }

  return { broken, fixed, unfixable };
}

module.exports = { checkAndUpdate };

// Doğrudan çalıştırılırsa hemen kontrol et
if (require.main === module) {
  checkAndUpdate().then(() => process.exit(0)).catch(console.error);
}
