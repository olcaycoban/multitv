import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function HlsPlayer({ src, name }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ capLevelToPlayerSize: true, startLevel: -1, liveSyncDuration: 15 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      controls
      autoPlay
      muted
      playsInline
      title={name}
    />
  );
}
