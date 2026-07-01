import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import TVGrid from '../src/TVGrid';
import SettingsPanel from '../src/SettingsPanel';
import { fetchChannels } from '../src/api';

const STORAGE_KEY_COUNT = 'multitv-count';

function loadCount(screen) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNT));
    return raw?.[screen] ?? 13;
  } catch { return 13; }
}

function saveCount(screen, value) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNT)) || {};
    localStorage.setItem(STORAGE_KEY_COUNT, JSON.stringify({ ...raw, [screen]: value }));
  } catch {}
}

export default function Screen({ screen, topbarClass, subtitle, accentColor, navHref, navLabel }) {
  const router = useRouter();
  const [channelCount, setChannelCount] = useState(13);
  const [channels, setChannels]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setChannelCount(loadCount(screen));
  }, [screen]);

  useEffect(() => {
    setLoading(true);
    fetchChannels(screen)
      .then(setChannels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [screen]);

  const handleCountChange = (value) => {
    setChannelCount(value);
    saveCount(screen, value);
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  return (
    <div className="app">
      <header className={`topbar ${topbarClass}`}>
        <span className="topbar-title">T.C. CUMHURBAŞKANLIĞI İLETİŞİM BAŞKANLIĞI</span>
        <span className="topbar-sub">{subtitle}</span>
        <div className="topbar-right">
          <button className="nav-btn" onClick={() => router.push(navHref)}>{navLabel}</button>
          <div className="live-badge"><span className="live-dot" /><span>CANLI</span></div>
          <span className="count-text">{channelCount} Kanal</span>
        </div>
      </header>

      <div className="grid-wrap">
        {loading
          ? <div style={{ color: '#fff', padding: '2rem', textAlign: 'center' }}>Yükleniyor…</div>
          : <TVGrid channels={channels} channelCount={channelCount} />
        }
      </div>

      <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Ayarlar">⚙</button>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        channelCount={channelCount}
        onCountChange={handleCountChange}
        channels={channels}
        onChannelsUpdate={setChannels}
        onFullscreen={toggleFullscreen}
        accentColor={accentColor}
        screen={screen}
      />
    </div>
  );
}
