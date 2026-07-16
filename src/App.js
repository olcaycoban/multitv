import { useState, useCallback, useEffect } from 'react';
import TVGrid from './TVGrid';
import SettingsPanel from './SettingsPanel';
import { FEATURED_LAYOUT_COUNT } from './data';
import { fetchChannels } from './api';
import './App.css';

const STORAGE_KEY_COUNT = 'multitv-count';

function loadCount(screen) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNT));
    return raw?.[screen] ?? FEATURED_LAYOUT_COUNT;
  } catch { return FEATURED_LAYOUT_COUNT; }
}

function saveCount(screen, value) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNT)) || {};
    localStorage.setItem(STORAGE_KEY_COUNT, JSON.stringify({ ...raw, [screen]: value }));
  } catch {}
}

function getPage() {
  return window.location.hash === '#bolge' ? 'bolge' : 'main';
}

function Screen({ screen, topbarClass, subtitle, accentColor, onNavigate, navLabel }) {
  const [channelCount, setChannelCount] = useState(() => loadCount(screen));
  const [channels, setChannels]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchChannels(screen)
      .then(data => setChannels(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error(err);
        setChannels([]);
      })
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
          <button className="nav-btn" onClick={onNavigate}>{navLabel}</button>
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

export default function App() {
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const goToBolge = () => { window.location.hash = '#bolge'; };
  const goToMain  = () => { window.location.hash = '#main'; };

  if (page === 'bolge') {
    return (
      <Screen
        key="bolge"
        screen="bolge"
        topbarClass="topbar--bolge"
        subtitle="🌐 Bölge Ekranı"
        accentColor="#1a3a6b"
        onNavigate={goToMain}
        navLabel="📺 Ana Ekran"
      />
    );
  }

  return (
    <Screen
      key="main"
      screen="main"
      topbarClass="topbar--main"
      subtitle="Çoklu TV İzleme"
      accentColor="#c61d23"
      onNavigate={goToBolge}
      navLabel="🌐 Bölge Ekranı"
    />
  );
}
