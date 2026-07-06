import { useState } from 'react';
import YouTubePlayer from './YouTubePlayer';
import HlsPlayer from './HlsPlayer';

export default function ChannelCard({ channel, style, muted, onToggleAudio }) {
  const [hovered, setHovered] = useState(false);

  const showBtn = hovered || !muted; // hover'da göster, sesi açıksa her zaman göster

  return (
    <div
      className="channel-card"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {channel.type === 'youtube'
        ? <YouTubePlayer channel={channel} muted={muted} />
        : <HlsPlayer src={channel.source} name={channel.name} muted={muted} />
      }

      {/* iframe mouse olaylarını yutuyor; overlay sadece hover girişini yakalar.
          onMouseLeave kasıtlı yok — dış card div'i mouse'un tamamen çıkışını yakalar,
          böylece butona geçince hovered=false olmuyor. */}
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

      <button
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 9999,
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
          opacity: showBtn ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'all',
        }}
        onClick={(e) => { e.stopPropagation(); onToggleAudio?.(); }}
        title={muted ? 'Sesi aç' : 'Sesi kapat'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
