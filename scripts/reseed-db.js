#!/usr/bin/env node
// Veritabanını seed-channels.js'deki varsayılan kanallarla doldurur.
// Kullanım:
//   node scripts/reseed-db.js          → sadece tablo boşsa seed yapar
//   node scripts/reseed-db.js --force  → mevcut tüm kanalları silip yeniden yükler

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../lib/db');

async function main() {
  const force = process.argv.includes('--force');

  if (force) {
    if (!db.forceReseed) {
      console.error('forceReseed desteklenmiyor');
      process.exit(1);
    }
    const cnt = await db.forceReseed();
    console.log(`Force reseed tamamlandı: ${cnt} kanal yüklendi.`);
    return;
  }

  const mainCh = await db.getAll('main');
  const bolgeCh = await db.getAll('bolge');
  console.log(`Mevcut: main=${mainCh.length}, bolge=${bolgeCh.length}`);

  if (mainCh.length === 0 && bolgeCh.length === 0) {
    const cnt = await db.forceReseed();
    console.log(`Tablo boştu, seed yapıldı: ${cnt} kanal.`);
  } else {
    console.log('Kanallar mevcut, seed atlandı. Sıfırdan yüklemek için: node scripts/reseed-db.js --force');
  }
}

main().catch((err) => {
  console.error('HATA:', err.message);
  process.exit(1);
});
