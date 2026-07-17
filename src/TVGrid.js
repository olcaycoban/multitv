import { useState, useEffect, useCallback } from 'react';
import ChannelCard from './ChannelCard';
import { gridConfigs, FEATURED_LAYOUT_COUNT } from './data';

function channelKey(ch, i) {
  return `${ch.id ?? ch.name}-${i}`;
}

export default function TVGrid({ channels, channelCount }) {
  const config = gridConfigs[channelCount] || gridConfigs[25];
  const isFeatured = channelCount === FEATURED_LAYOUT_COUNT;
  const visible = channels.slice(0, channelCount);

  const [activeAudioKey, setActiveAudioKey] = useState(null);
  const [fullscreenKey, setFullscreenKey] = useState(null);

  const handleToggleAudio = (key) => {
    setActiveAudioKey((prev) => (prev === key ? null : key));
  };

  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      setFullscreenKey(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);

  const handleEnterFullscreen = (key) => {
    setFullscreenKey(key);
    setActiveAudioKey(key);
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
        const key = channelKey(ch, i);
        return (
          <ChannelCard
            key={key}
            channel={ch}
            style={isFeatured && i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : undefined}
            muted={activeAudioKey !== key}
            onToggleAudio={() => handleToggleAudio(key)}
            onEnterFullscreen={() => handleEnterFullscreen(key)}
            isFullscreen={fullscreenKey === key}
          />
        );
      })}
    </div>
  );
}
