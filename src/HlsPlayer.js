import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const MAX_RETRIES = 5;

export default function HlsPlayer({ src, name }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const retriesRef = useRef(0);
  const [status, setStatus] = useState('loading'); // loading | ok | failed

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    retriesRef.current = 0;
    setStatus('loading');

    let destroyed = false;
    let retryTimer = null;

    const attach = () => {
      if (destroyed) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true, startLevel: -1, liveSyncDuration: 15 });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('ok'));

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
        video.addEventListener('loadedmetadata', () => setStatus('ok'), { once: true });
        video.addEventListener('error', () => setStatus('failed'), { once: true });
      }
    };

    attach();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [src]);

  const handleManualRetry = () => {
    retriesRef.current = 0;
    setStatus('loading');
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
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
