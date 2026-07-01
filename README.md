# MultiTV — Statik Çoklu TV

npm, Node.js veya veritabanı gerekmez.

## Sunucuya atılacak dosyalar

```
index.html
bolge.html
css/style.css
js/data.js
js/app.js
```

## Özellikler

- Varsayılan **13 kanal** (TRT Haber solda büyük, diğerleri küçük)
- YouTube + HLS yayınları
- Ayarlardan kanal sayısı ve kanal listesi (tarayıcıda saklanır)

## Kanal adreslerini güncelleme

**Kalıcı (dosyadan):** `js/data.js`
- Ana ekran → `defaultChannels`
- Bölge ekranı → `regionalChannels`

Her kanal:
```js
{ name: "Kanal Adı", source: "YouTubeID veya m3u8 URL", type: "youtube" | "hls" }
```

**Geçici (tarayıcıdan):** Sağdaki ⚙ ayarlar → Kanalları Değiştir → Kaydet  
(Bu sadece o tarayıcıda saklanır, `localStorage`)

## Çalıştırma

```bash
cd multitv
npm start
```

Tarayıcı: http://localhost:8080

(`app.js` tarayıcı kodudur; sunucuyu `js/server.js` başlatır.)
