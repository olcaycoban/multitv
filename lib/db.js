// Kalıcı veritabanı katmanı — Postgres (Neon/Vercel Postgres) kullanır.
// `DATABASE_URL` (veya `POSTGRES_URL`) tanımlıysa hem local hem production
// AYNI veritabanına bağlanır; bu sayede local ve production her zaman
// birebir senkron kalır (Vercel'in /tmp'i kalıcı olmadığı için sqlite-in-tmp
// yaklaşımı production'da veri kaybına yol açıyordu).
//
// `DATABASE_URL` henüz tanımlı değilse (ör. ilk kurulum sırasında), local
// geliştirmenin kesintiye uğramaması için otomatik olarak eski sqlite
// dosyasına düşer — ama bu mod production'da (Vercel) KULLANILMAMALI.

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let impl;

if (connectionString) {
  impl = require('./db-postgres')(connectionString);
} else {
  console.warn('[db] DATABASE_URL tanımlı değil, geçici olarak local sqlite kullanılıyor. Kalıcılık için .env dosyasına DATABASE_URL ekleyin.');
  impl = require('./db-sqlite');
}

module.exports = impl;
