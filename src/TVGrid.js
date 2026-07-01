import ChannelCard from './ChannelCard';
import { gridConfigs, FEATURED_LAYOUT_COUNT } from './data';

export default function TVGrid({ channels, channelCount }) {
  const config = gridConfigs[channelCount] || gridConfigs[25];
  const isFeatured = channelCount === FEATURED_LAYOUT_COUNT;
  const visible = channels.slice(0, channelCount);

  return (
    <div
      className="tv-grid"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
        gridAutoFlow: isFeatured ? 'dense' : undefined,
      }}
    >
      {visible.map((ch, i) => (
        <ChannelCard
          key={ch.name + i}
          channel={ch}
          style={isFeatured && i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : undefined}
        />
      ))}
    </div>
  );
}
