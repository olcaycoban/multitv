import { useState, useRef, useEffect, useCallback } from 'react';
import { loadYouTubeIframeApi } from './youtubeApiLoader';
import { refreshChannel } from './api';

// Bozuk/yayından kaldırılmış video hata kodları
const BROKEN_ERROR_CODES = new Set([2, 5, 100, 101, 150]);
const MAX_AUTO_RETRIES = 4;
const RETRY_DELAY_MS = 15000;

export default function YouTubePlayer({ channel }) {
  const { id, name, source, yt_channel_id } = channel;

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | fixing | failed

  const containerRef = useRef(null);
  const elementIdRef = useRef(`ytp-${id}-${Math.random().toString(36).slice(2, 8)}`);
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(source);
  const fixAttemptsRef = useRef(0);
  const fixingRef = useRef(false);

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
          currentVideoIdRef.current = newId;
          playerRef.current.loadVideoById(newId);
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
    let destroyed = false;

    loadYouTubeIframeApi().then((YT) => {
      if (destroyed || !YT || !document.getElementById(elementIdRef.current)) return;

      playerRef.current = new YT.Player(elementIdRef.current, {
        videoId: currentVideoIdRef.current,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onError: (e) => {
            if (BROKEN_ERROR_CODES.has(e.data)) handleBrokenRef.current();
          },
          onStateChange: (e) => {
            // ENDED (0) bazen geçici bir durum blip'i olabilir (tampon/kalite geçişi).
            // Birkaç saniye sonra hâlâ ENDED ise gerçekten yayın bitmiş demektir.
            if (e.data === YT.PlayerState.ENDED) {
              setTimeout(() => {
                const player = playerRef.current;
                if (player?.getPlayerState && player.getPlayerState() === YT.PlayerState.ENDED) {
                  handleBrokenRef.current();
                }
              }, 4000);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch { /* no-op */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
