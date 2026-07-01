import YouTubePlayer from './YouTubePlayer';
import HlsPlayer from './HlsPlayer';

export default function ChannelCard({ channel, style }) {
  return (
    <div className="channel-card" style={style}>
      {channel.type === 'youtube'
        ? <YouTubePlayer videoId={channel.source} name={channel.name} />
        : <HlsPlayer src={channel.source} name={channel.name} />
      }
      <div className="channel-label">{channel.name}</div>
    </div>
  );
}
