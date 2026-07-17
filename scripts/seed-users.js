#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../lib/db');

async function main() {
  if (!db.seedUsers) {
    console.error('seedUsers desteklenmiyor');
    process.exit(1);
  }
  const passwordHash = bcrypt.hashSync('password', 10);
  const created = await db.seedUsers(passwordHash);
  console.log(`Tamamlandı: ${created} yeni kullanıcı oluşturuldu (user1–user100, şifre: password)`);
}

main().catch((err) => {
  console.error('HATA:', err.message);
  process.exit(1);
});
