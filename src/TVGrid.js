import { useState } from 'react';
import ChannelCard from './ChannelCard';
import { gridConfigs, FEATURED_LAYOUT_COUNT } from './data';

export default function TVGrid({ channels, channelCount }) {
  const config = gridConfigs[channelCount] || gridConfigs[25];
  const isFeatured = channelCount === FEATURED_LAYOUT_COUNT;
  const visible = channels.slice(0, channelCount);

  // Aynı anda tüm kanalların sesi açık olmasın diye tek bir "aktif ses" kanalı tutuyoruz.
  // Bir kanala tıklandığında o kanalın sesi açılır, diğerleri otomatik susturulur.
  const [activeAudioKey, setActiveAudioKey] = useState(null);

  const handleToggleAudio = (key) => {
    setActiveAudioKey((prev) => (prev === key ? null : key));
  };

  return (
    <div
      className="tv-grid"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
        gridAutoFlow: isFeatured ? 'dense' : undefined,
      }}
    >
      {visible.map((ch, i) => {
        const key = ch.name + i;
        return (
          <ChannelCard
            key={key}
            channel={ch}
            style={isFeatured && i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : undefined}
            muted={activeAudioKey !== key}
            onToggleAudio={() => handleToggleAudio(key)}
          />
        );
      })}
    </div>
  );
}
