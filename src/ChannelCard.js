import YouTubePlayer from './YouTubePlayer';
import HlsPlayer from './HlsPlayer';

export default function ChannelCard({ channel, style }) {
  return (
    <div className="channel-card" style={style}>
      {channel.type === 'youtube'
        ? <YouTubePlayer channel={channel} />
        : <HlsPlayer src={channel.source} name={channel.name} />
      }
      <div className="channel-label">{channel.name}</div>
    </div>
  );
}
