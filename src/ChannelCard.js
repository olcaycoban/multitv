import { useRef, useState } from 'react';
import YouTubePlayer from './YouTubePlayer';
import HlsPlayer from './HlsPlayer';

export default function ChannelCard({ channel, style, muted, onToggleAudio, onEnterFullscreen, isFullscreen }) {
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  const showBtn = hovered || !muted || isFullscreen;

  const handleFullscreen = async (e) => {
    e.stopPropagation();
    if (document.fullscreenElement === cardRef.current) {
      await document.exitFullscreen?.();
      return;
    }
    try {
      await cardRef.current?.requestFullscreen?.();
      onEnterFullscreen?.();
    } catch (err) {
      console.error('Fullscreen failed:', err);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`channel-card${isFullscreen ? ' channel-card--fullscreen' : ''}`}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {channel.type === 'youtube'
        ? <YouTubePlayer channel={channel} muted={muted} />
        : <HlsPlayer src={channel.source} name={channel.name} muted={muted} />
      }

      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'transparent',
          pointerEvents: 'all',
          cursor: 'default',
        }}
        onMouseEnter={() => setHovered(true)}
      />

      <div className="channel-label">{channel.name}</div>

      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 9999,
          display: 'flex',
          gap: 4,
          opacity: showBtn ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'all',
        }}
      >
        <button
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 5,
            fontSize: 13,
            lineHeight: 1,
            cursor: 'pointer',
            userSelect: 'none',
            color: '#fff',
          }}
          onClick={handleFullscreen}
          title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
        >
          {isFullscreen ? '⛶' : '⛶'}
        </button>
        <button
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: muted ? 'rgba(0,0,0,0.8)' : '#c61d23',
            border: `1px solid ${muted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)'}`,
            borderRadius: 5,
            fontSize: 14,
            lineHeight: 1,
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={(e) => { e.stopPropagation(); onToggleAudio?.(); }}
          title={muted ? 'Sesi aç' : 'Sesi kapat'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
