import { useState, useRef, useEffect, useCallback } from 'react';
import { loadYouTubeIframeApi } from './youtubeApiLoader';
import { refreshChannel } from './api';

// Bozuk/yayından kaldırılmış video hata kodları
const BROKEN_ERROR_CODES = new Set([2, 5, 100, 101, 150]);
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 60000; // API kotasını korumak için: başarısız denemeden sonra en az 1 dk bekle
const BROKEN_CONFIRM_MS = 60000; // API'ye gitmeden önce kanalın en az 1 dk kesintisiz "çalışmıyor" olması şart
const BROKEN_POLL_MS = 10000; // bu süre içinde birkaç kez kendiliğinden düzelip düzelmediğine (ücretsiz) bakılır

export default function YouTubePlayer({ channel, muted = true }) {
  const { id, name, source, yt_channel_id } = channel;

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | fixing | failed

  const containerRef = useRef(null);
  const elementIdRef = useRef(`ytp-${id}-${Math.random().toString(36).slice(2, 8)}`);
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(source);
  const fixAttemptsRef = useRef(0);
  const fixingRef = useRef(false);
  const brokenPollTimerRef = useRef(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Reaktif düzeltme: yayın koptuğu/bittiği ANDA sadece bu kanal için API'ye gidip yeni linki bulur.
  // Zamanlanmış bir job yok — tetikleyici her zaman gerçek oynatım hatasıdır.
  const handleBroken = useCallback(() => {
    if (fixingRef.current) return;
    if (!yt_channel_id) { setStatus('failed'); return; }
    if (fixAttemptsRef.current >= MAX_AUTO_RETRIES) { setStatus('failed'); return; }

    fixingRef.current = true;
    fixAttemptsRef.current += 1;
    setStatus('fixing');

    refreshChannel(id, yt_channel_id)
      .then((result) => {
        const newId = result?.channel?.source;
        if (newId && playerRef.current?.loadVideoById) {
          // Aynı video ID döndüyse (yayın hiç değişmemiş, sadece geçici bir blip
          // yaşanmış) reload yerine basitçe devam ettirmek yeterli.
          if (newId === currentVideoIdRef.current) {
            playerRef.current.playVideo();
          } else {
            currentVideoIdRef.current = newId;
            playerRef.current.loadVideoById(newId);
          }
          setStatus('idle');
          fixAttemptsRef.current = 0;
          fixingRef.current = false;
        } else {
          // Henüz yeni canlı yayın başlamamış olabilir, kısa süre sonra tekrar dene
          fixingRef.current = false;
          setTimeout(() => handleBrokenRef.current(), RETRY_DELAY_MS);
        }
      })
      .catch(() => {
        fixingRef.current = false;
        setStatus('failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, yt_channel_id]);

  // Event handler'lar player oluşturulurken bir kez bağlanır; güncel handleBroken'a
  // her zaman erişebilmek için ref üzerinden çağırıyoruz (stale closure engellenir).
  const handleBrokenRef = useRef(handleBroken);
  useEffect(() => { handleBrokenRef.current = handleBroken; }, [handleBroken]);

  // API kotasını korumak için: bir arıza şüphesi (ENDED/hata) görüldüğünde hemen
  // YouTube API'sine gitmiyoruz. Bunun yerine `BROKEN_CONFIRM_MS` (1 dk) boyunca
  // periyodik olarak (ücretsiz) playVideo() ile kendiliğinden düzelip düzelmediğine
  // bakıyoruz; kanal bu süre boyunca kesintisiz "çalışmıyor" kalırsa ancak o zaman
  // gerçek API çağrısını (handleBroken) tetikliyoruz.
  const confirmBrokenThenFix = useCallback((YT) => {
    if (brokenPollTimerRef.current) return; // zaten bir doğrulama döngüsü sürüyor
    const startedAt = Date.now();

    const poll = () => {
      const player = playerRef.current;
      const state = player?.getPlayerState ? player.getPlayerState() : null;
      const stillBad = state === YT.PlayerState.ENDED || state === -1;

      if (!stillBad) {
        brokenPollTimerRef.current = null; // kendiliğinden düzeldi, API'ye hiç gitmedik
        return;
      }

      player?.playVideo?.();

      if (Date.now() - startedAt >= BROKEN_CONFIRM_MS) {
        brokenPollTimerRef.current = null;
        handleBrokenRef.current();
      } else {
        brokenPollTimerRef.current = setTimeout(poll, BROKEN_POLL_MS);
      }
    };

    brokenPollTimerRef.current = setTimeout(poll, BROKEN_POLL_MS);
  }, []);
  const confirmBrokenRef = useRef(confirmBrokenThenFix);
  useEffect(() => { confirmBrokenRef.current = confirmBrokenThenFix; }, [confirmBrokenThenFix]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        setTimeout(() => setVisible(true), Math.random() * 2000);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!currentVideoIdRef.current) {
      // Geçerli bir video ID yok (ör. henüz canlı yayın bulunamadı); direkt kurtarma akışına gir.
      handleBrokenRef.current();
      return;
    }
    let destroyed = false;

    loadYouTubeIframeApi().then((YT) => {
      if (destroyed || !YT || !document.getElementById(elementIdRef.current)) return;

      playerRef.current = new YT.Player(elementIdRef.current, {
        videoId: currentVideoIdRef.current,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1,
          controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
          cc_load_policy: 0, cc_lang_pref: 'none',
        },
        events: {
          // autoplay parametresi tek başına bazı tarayıcılarda yeterli olmuyor,
          // player hazır olduğunda oynatmayı açıkça tetikliyoruz.
          onReady: (e) => {
            if (mutedRef.current) e.target.mute(); else e.target.unMute();
            e.target.playVideo();
            // Aynı anda çok sayıda YouTube akışı oynatıldığı için bant genişliğini
            // korumak amacıyla en düşük kaliteyi talep ediyoruz.
            try { e.target.setPlaybackQuality('small'); } catch { /* no-op */ }
          },
          onPlaybackQualityChange: (e) => {
            // YouTube bazen kaliteyi kendiliğinden yükseltebiliyor; düşük tutmaya zorla
            if (e.data !== 'tiny' && e.data !== 'small') {
              try { e.target.setPlaybackQuality('small'); } catch { /* no-op */ }
            }
          },
          onError: (e) => {
            // Hata kodu bozuk/kaldırılmış videoya işaret etse bile API kotasını
            // korumak için hemen değil, 1 dk kesintisiz doğrulama sonrası tetikleriz.
            if (BROKEN_ERROR_CODES.has(e.data)) confirmBrokenRef.current(YT);
          },
          onStateChange: (e) => {
            // Kiosk modu: video hiçbir zaman durmamalı, duraklarsa hemen devam ettir
            if (e.data === YT.PlayerState.PAUSED) {
              setTimeout(() => {
                const player = playerRef.current;
                if (player?.getPlayerState && player.getPlayerState() === YT.PlayerState.PAUSED) {
                  player.playVideo();
                }
              }, 600);
            }
            // ENDED (0) çoğunlukla geçici bir blip (tampon/kalite geçişi). API'ye
            // gitmeden önce kanalın kesintisiz en az 1 dk "çalışmıyor" kalması şart.
            if (e.data === YT.PlayerState.ENDED) {
              confirmBrokenRef.current(YT);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (brokenPollTimerRef.current) { clearTimeout(brokenPollTimerRef.current); brokenPollTimerRef.current = null; }
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch { /* no-op */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Kullanıcı hoparlör butonuna bastığında (kart yeniden kurulmadan) sesi anında yansıt.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (muted) player.mute?.();
      else { player.unMute?.(); player.setVolume?.(100); }
    } catch { /* no-op */ }
  }, [muted]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}>
      {visible ? (
        <div id={elementIdRef.current} style={{ width: '100%', height: '100%' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div className="spinner" />
          <span style={{ fontSize: 9, marginTop: 8 }}>{name}</span>
        </div>
      )}

      {status === 'fixing' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', color: '#7eb8f7', fontSize: 10, gap: 4 }}>
          ⟳ Yayın güncelleniyor…
        </div>
      )}

      {status === 'failed' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', color: '#f87171', fontSize: 10, gap: 6 }}>
          <span>Yayın bulunamadı</span>
          <button
            style={{ fontSize: 10, padding: '4px 10px', background: '#1a1a2e', border: '1px solid #333', color: '#7eb8f7', borderRadius: 3, cursor: 'pointer' }}
            onClick={() => { fixAttemptsRef.current = 0; handleBroken(); }}
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}
