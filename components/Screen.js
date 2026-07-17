import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import TVGrid from '../src/TVGrid';
import SettingsPanel from '../src/SettingsPanel';
import { FEATURED_LAYOUT_COUNT } from '../src/data';
import { fetchChannels, fetchUserPreferences, saveUserPreferences, fetchMe, logout } from '../src/api';

const POLL_INTERVAL_MS = 30000;

export default function Screen({ screen, topbarClass, subtitle, accentColor, navHref, navLabel }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [channelCount, setChannelCount] = useState(FEATURED_LAYOUT_COUNT);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const channelsRef = useRef([]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchMe().catch(() => null),
      fetchUserPreferences(screen).catch(() => ({ channelCount: FEATURED_LAYOUT_COUNT })),
      fetchChannels(screen).catch(() => []),
    ])
      .then(([me, prefs, data]) => {
        if (cancelled) return;
        if (me?.username) setUsername(me.username);
        setChannelCount(prefs?.channelCount ?? FEATURED_LAYOUT_COUNT);
        setChannels(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [screen]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchChannels(screen)
        .then(fresh => {
          if (!Array.isArray(fresh) || fresh.length === 0) return;
          setChannels(prev => {
            const order = prev.map(c => c.id);
            const freshMap = new Map(fresh.map(c => [c.id, c]));
            const ordered = order
              .map(id => freshMap.get(id))
              .filter(Boolean);
            const orderedIds = new Set(ordered.map(c => c.id));
            const appended = fresh.filter(c => !orderedIds.has(c.id));
            return [...ordered, ...appended];
          });
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [screen]);

  const handleCountChange = async (value) => {
    setChannelCount(value);
    try {
      await saveUserPreferences(screen, value);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
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
          {username && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{username}</span>
          )}
          <button className="nav-btn" onClick={() => router.push(navHref)}>{navLabel}</button>
          <button className="nav-btn" onClick={handleLogout} title="Çıkış">Çıkış</button>
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
