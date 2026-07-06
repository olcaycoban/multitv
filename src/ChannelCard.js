import YouTubePlayer from './YouTubePlayer';
import HlsPlayer from './HlsPlayer';

const btnStyle = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.8)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 5,
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer',
  pointerEvents: 'all',
  userSelect: 'none',
};

const btnActiveStyle = {
  ...btnStyle,
  background: '#c61d23',
  border: '1px solid rgba(255,255,255,0.7)',
};

export default function ChannelCard({ channel, style, muted, onToggleAudio }) {
  return (
    <div className="channel-card" style={style}>
      {channel.type === 'youtube'
        ? <YouTubePlayer channel={channel} muted={muted} />
        : <HlsPlayer src={channel.source} name={channel.name} muted={muted} />
      }
      <div className="channel-label">{channel.name}</div>

      {/* wrapper hover ile göster/gizle, aktifse her zaman görünür */}
      <div className={`audio-btn-wrap${muted ? '' : ' active'}`}>
        <button
          style={muted ? btnStyle : btnActiveStyle}
          onClick={(e) => { e.stopPropagation(); onToggleAudio?.(); }}
          title={muted ? 'Sesi aç' : 'Sesi kapat'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
