import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const MAX_RETRIES = 8;
const STALL_TIMEOUT_MS = 9000; // bu süre boyunca görüntü ilerlemezse (siyah ekran) kurtarma tetiklenir

export default function HlsPlayer({ src, name }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const retriesRef = useRef(0);
  const [status, setStatus] = useState('loading'); // loading | ok | failed
  const attachRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    retriesRef.current = 0;
    setStatus('loading');

    let destroyed = false;
    let retryTimer = null;
    let stallTimer = null;
    let lastProgressTime = 0;

    const clearStallTimer = () => {
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    };

    // Görüntü gerçekten ilerlemiyorsa (siyah ekran/donma) belirli bir süre sonra
    // player'ı sıfırdan kurar. MANIFEST_PARSED tek başına gerçek oynatımı garanti etmiyor.
    const armStallWatchdog = () => {
      clearStallTimer();
      stallTimer = setTimeout(() => {
        if (destroyed) return;
        const advanced = video.currentTime > lastProgressTime + 0.5;
        if (!advanced) {
          if (retriesRef.current >= MAX_RETRIES) {
            setStatus('failed');
            return;
          }
          retriesRef.current += 1;
          if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* no-op */ } hlsRef.current = null; }
          attachRef.current();
        } else {
          lastProgressTime = video.currentTime;
          armStallWatchdog();
        }
      }, STALL_TIMEOUT_MS);
    };

    const onTimeUpdate = () => {
      if (video.currentTime > 0) {
        setStatus('ok');
        lastProgressTime = video.currentTime;
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('playing', onTimeUpdate);

    const attach = () => {
      if (destroyed) return;
      setStatus('loading');
      lastProgressTime = 0;

      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true, startLevel: 0, liveSyncDuration: 15, maxBufferLength: 20 });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          armStallWatchdog();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (retriesRef.current >= MAX_RETRIES) {
            setStatus('failed');
            return;
          }
          retriesRef.current += 1;

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              retryTimer = setTimeout(() => { if (!destroyed) hls.startLoad(); }, 2000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Kurtarılamayan hata: player'ı yeniden kur
              hls.destroy();
              retryTimer = setTimeout(attach, 3000);
              break;
          }
        });

        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.addEventListener('loadedmetadata', () => { video.play().catch(() => {}); armStallWatchdog(); }, { once: true });
        video.addEventListener('error', () => setStatus('failed'), { once: true });
      }
    };
    attachRef.current = attach;

    attach();

    return () => {
      destroyed = true;
      clearStallTimer();
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('playing', onTimeUpdate);
      if (retryTimer) clearTimeout(retryTimer);
      if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* no-op */ } hlsRef.current = null; }
    };
  }, [src]);

  const handleManualRetry = () => {
    retriesRef.current = 0;
    setStatus('loading');
    if (attachRef.current) attachRef.current();
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        controls
        autoPlay
        muted
        playsInline
        title={name}
      />

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
          <div className="spinner" />
          <span style={{ fontSize: 9, marginTop: 8 }}>{name}</span>
        </div>
      )}

      {status === 'failed' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', color: '#f87171', fontSize: 10, gap: 6 }}>
          <span>Yayın bulunamadı</span>
          <button
            style={{ fontSize: 10, padding: '4px 10px', background: '#1a1a2e', border: '1px solid #333', color: '#7eb8f7', borderRadius: 3, cursor: 'pointer' }}
            onClick={handleManualRetry}
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}
