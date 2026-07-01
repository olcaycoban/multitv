export const FEATURED_LAYOUT_COUNT = 13;

export const channelCounts = [4, 6, 9, 10, 13, 16, 18, 21, 25];

export const gridConfigs = {
  4:  { cols: 2, rows: 2 },
  6:  { cols: 3, rows: 2 },
  9:  { cols: 3, rows: 3 },
  10: { cols: 5, rows: 2 },
  13: { cols: 4, rows: 4 },
  16: { cols: 4, rows: 4 },
  18: { cols: 6, rows: 3 },
  21: { cols: 7, rows: 3 },
  25: { cols: 5, rows: 5 },
};

export const defaultChannels = [
  { name: 'TRT Haber',    source: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',           type: 'hls' },
  { name: 'A Haber',      source: 'RlHW5wX9Iqc',                                                type: 'youtube' },
  { name: 'CNN Türk',     source: '6N8_r2uwLEc',                                                 type: 'youtube' },
  { name: 'NTV',          source: 'pqq5c6k70kk',                                                 type: 'youtube' },
  { name: 'TVNET',        source: 'Z5bqy4gwEmc',                                                 type: 'youtube' },
  { name: 'Ulusal Kanal', source: 'Gcxkjxhbhk8',                                                 type: 'youtube' },
  { name: 'Bengütürk TV', source: 'https://tv.ensonhaber.com/benguturk/benguturk.m3u8',          type: 'hls' },
  { name: 'TRT Avaz',     source: 'https://tv-trtavaz.medya.trt.com.tr/master.m3u8',             type: 'hls' },
  { name: '24 TV',        source: 'https://tv.ensonhaber.com/tv24/tv24.m3u8',                    type: 'hls' },
  { name: 'TGRT Haber',   source: 'https://canli.tgrthaber.com/tgrt.m3u8',                       type: 'hls' },
  { name: 'Haber Global', source: 'EqoCJ8BPxtE',                                                 type: 'youtube' },
  { name: 'Diyanet TV',   source: '8KOE6__ogN8',                                                 type: 'youtube' },
  { name: 'Sözcü TV',     source: 'ztmY_cCtUl0',                                                 type: 'youtube' },
  { name: 'Habertürk',    source: 'https://tv.ensonhaber.com/haberturk/haberturk.m3u8',          type: 'hls' },
  { name: 'Halk TV',      source: 'https://halktv-live.daioncdn.net/halktv/halktv.m3u8',         type: 'hls' },
  { name: 'CNBC-e',       source: 'aZ3ycSbSYBA',                                                 type: 'youtube' },
  { name: 'Bloomberg HT', source: 'https://tv.ensonhaber.com/bloomberght/bloomberght.m3u8',      type: 'hls' },
  { name: 'HT Spor',      source: 'gcWaPe_LBMc',                                                 type: 'youtube' },
  { name: 'Ekol Spor',    source: 'https://ekoltv-live.ercdn.net/ekolsport/ekolsport.m3u8',      type: 'hls' },
  { name: 'ABC News',     source: 'iipR5yUp36o',                                                 type: 'youtube' },
  { name: 'ARY News',     source: '0mfl0-jFPnQ',                                                 type: 'youtube' },
  { name: 'Sky News',     source: 'NygUCOEHrF8',                                                 type: 'youtube' },
  { name: 'Al Jazeera Arabic',   source: 'bNyUyrR0PHo',                                          type: 'youtube' },
  { name: 'Al Jazeera English',  source: 'gCNeDWCI0vo',                                          type: 'youtube' },
  { name: 'CCTV Chinese', source: 'fN9uYWCjQaw',                                                 type: 'youtube' },
];

export const regionalChannels = [
  // İngilizce (önce)
  { name: 'BBC News',           source: 'KyG6amQVSco', type: 'youtube' },
  { name: 'Sky News',           source: 'NygUCOEHrF8', type: 'youtube' },
  { name: 'Al Jazeera English', source: 'gCNeDWCI0vo', type: 'youtube' },
  { name: 'NBC News',           source: 'RrR3Bn60J7I', type: 'youtube' },
  { name: 'ABC News',           source: 'iipR5yUp36o', type: 'youtube' },
  { name: 'LiveNOW from FOX',   source: 'R_lRjToLD3U', type: 'youtube' },
  { name: 'WION',               source: 'R5xoxZHurjQ', type: 'youtube' },
  // Arapça
  { name: 'Al Arabiya',         source: 'n7eQejkXbnM', type: 'youtube' },
  { name: 'Al Jazeera Arabic',  source: 'bNyUyrR0PHo', type: 'youtube' },
  { name: 'Al Hadath',          source: '0STUpSryLWY', type: 'youtube' },
  { name: 'Al Mayadeen',        source: '4BkAZijHnDQ', type: 'youtube' },
  { name: 'Al Qahera News',     source: 'G0JuCygkBkA', type: 'youtube' },
  { name: 'Al Ikhbariya',       source: 'yYJjtr3fbZE', type: 'youtube' },
  { name: 'Roya News',          source: 'A1cZxijueg4', type: 'youtube' },
  { name: 'BBC Arabic',         source: 'O1pGmVtj2Y8', type: 'youtube' },
  // Çince
  { name: 'Phoenix TV',         source: 'fN9uYWCjQaw', type: 'youtube' },
  { name: 'CCTV Chinese',       source: 'f6Kq93wnaZ8', type: 'youtube' },
  { name: 'CTi TV',             source: 'PA8kLd6m2Jc', type: 'youtube' },
  // Hintçe
  { name: 'Aaj Tak',            source: 'Ogw1-dwX4yA', type: 'youtube' },
  { name: 'TV9 Bharatvarsh',    source: 'YDahJR8XeK4', type: 'youtube' },
  { name: 'ABP News',           source: 'nyd-xznCpJc', type: 'youtube' },
  // Urduca
  { name: 'Geo News',           source: 'Zc7P7sG0lNk', type: 'youtube' },
  { name: 'ARY News',           source: '0mfl0-jFPnQ', type: 'youtube' },
  { name: 'Dunya News',         source: 'Z4V6mQbMnPA', type: 'youtube' },
  { name: 'SAMAA TV',           source: 'wAy-Xq-ciLI', type: 'youtube' },
];
