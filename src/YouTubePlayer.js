import { useState, useRef, useEffect } from 'react';

export default function YouTubePlayer({ videoId, name }) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

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

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#111' }}>
      {visible ? (
        <iframe
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          src={embedUrl}
          title={name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div className="spinner" />
          <span style={{ fontSize: 9, marginTop: 8 }}>{name}</span>
        </div>
      )}
    </div>
  );
}
