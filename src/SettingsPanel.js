import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { channelCounts } from './data';
import { addChannel, updateChannel, deleteChannel, reorderChannels, runLinkCheck, getJobLogs, refreshChannel } from './api';

function SortableRow({ ch, index, isActive, accentColor, onNameChange, onSourceChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });

  const activeGreen = '#22c55e';

  const rowStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: isDragging ? '#1e2e1e' : '#161616',
    borderLeft: `3px solid ${isActive ? activeGreen : 'transparent'}`,
    padding: '4px 6px 4px 4px',
    borderRadius: 4,
    marginBottom: 5,
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={rowStyle}>
      {/* Drag handle — only this element triggers drag */}
      <span
        {...attributes}
        {...listeners}
        title="Sürükle"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          color: isActive ? activeGreen : 'rgba(255,255,255,0.25)',
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          userSelect: 'none',
          padding: '4px 3px',
          touchAction: 'none',
        }}
      >
        ⠿
      </span>

      {/* Active indicator number */}
      <span style={{
        fontSize: 10,
        color: isActive ? activeGreen : 'rgba(255,255,255,0.2)',
        width: 18,
        textAlign: 'right',
        flexShrink: 0,
        fontWeight: isActive ? 700 : 400,
      }}>
        {isActive ? index + 1 : '—'}
      </span>

      <input
        style={{ flex: 1, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 11, padding: '6px 8px', borderRadius: 3, outline: 'none' }}
        placeholder="Kanal adı"
        value={ch.name}
        onChange={e => onNameChange(e.target.value)}
        onFocus={e => (e.target.style.borderColor = accentColor)}
        onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
      />

      <input
        style={{ flex: 1.6, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 11, padding: '6px 8px', borderRadius: 3, outline: 'none', fontFamily: 'monospace' }}
        placeholder="YouTube ID veya m3u8 URL"
        value={ch.source}
        onChange={e => onSourceChange(e.target.value)}
        onFocus={e => (e.target.style.borderColor = accentColor)}
        onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
      />

      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', width: 26, textAlign: 'center', flexShrink: 0 }}>
        {ch.type === 'hls' ? 'HLS' : 'YT'}
      </span>

      <button
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,80,80,0.5)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
        onClick={onRemove}
        title="Sil"
      >×</button>
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose, channelCount, onCountChange, channels, onChannelsUpdate, onFullscreen, accentColor, screen }) {
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);
  const [ytTab, setYtTab] = useState(false);
  const [ytDraft, setYtDraft] = useState({});   // { channelDbId: yt_channel_id string }
  const [ytStatus, setYtStatus] = useState({}); // { channelDbId: 'saving'|'ok'|'notfound'|'error' }

  useEffect(() => {
    if (isOpen) {
      setDraft(channels.map(ch => ({ ...ch })));
      // YouTube kanallarının mevcut yt_channel_id'lerini yükle
      const map = {};
      channels.filter(c => c.type === 'youtube').forEach(c => {
        map[c.id] = c.yt_channel_id || '';
      });
      setYtDraft(map);
      // Job loglarını yükle
      getJobLogs().then(setJobLogs).catch(() => {});
    }
  }, [isOpen]); // intentionally omit `channels` to only reset draft when panel opens

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft(prev => {
      const oldIdx = prev.findIndex(c => c.id === active.id);
      const newIdx = prev.findIndex(c => c.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const updateName = (id, val) =>
    setDraft(prev => prev.map(ch => ch.id === id ? { ...ch, name: val } : ch));

  const updateSource = (id, val) => {
    const isHls = val.includes('.m3u8') || (val.startsWith('http') && !val.includes('youtu'));
    setDraft(prev => prev.map(ch => ch.id === id ? { ...ch, source: val, type: isHls ? 'hls' : 'youtube' } : ch));
  };

  const handleCheckLinks = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await runLinkCheck();
      setCheckResult(result);
      if (result.fixed && result.fixed.length > 0) {
        setDraft(prev => prev.map(ch => {
          const fix = result.fixed.find(f => f.name === ch.name);
          return fix ? { ...ch, source: fix.new } : ch;
        }));
      }
      // Logları güncelle
      getJobLogs().then(setJobLogs).catch(() => {});
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  const handleRefreshOne = async (ch) => {
    const ytId = (ytDraft[ch.id] || '').trim();
    if (!ytId) return;
    setYtStatus(s => ({ ...s, [ch.id]: 'saving' }));
    try {
      const result = await refreshChannel(ch.id, ytId);
      setYtStatus(s => ({ ...s, [ch.id]: result.liveId ? 'ok' : 'notfound' }));
      // Kanalın source'unu state'de güncelle (kalıcı)
      if (result.channel) {
        onChannelsUpdate(prev => prev.map(c => c.id === ch.id ? result.channel : c));
        setDraft(prev => prev.map(c => c.id === ch.id ? { ...c, source: result.channel.source, yt_channel_id: result.channel.yt_channel_id } : c));
      }
    } catch {
      setYtStatus(s => ({ ...s, [ch.id]: 'error' }));
    }
  };

  const handleRefreshAll = async () => {
    const ytChannels = channels.filter(c => c.type === 'youtube' && (ytDraft[c.id] || '').trim());
    for (const ch of ytChannels) await handleRefreshOne(ch);
  };

  const handleAdd = () => {
    setDraft(prev => [...prev, { id: `new-${Date.now()}`, name: '', source: '', type: 'youtube', screen: screen || 'main', _new: true }]);
  };

  const handleRemove = (id) => {
    setDraft(prev => prev.filter(ch => ch.id !== id));
  };

  const save = async () => {
    setSaving(true);
    try {
      const origIds = new Set(channels.map(c => c.id));
      const draftIds = new Set(draft.filter(c => !c._new).map(c => c.id));

      for (const orig of channels) {
        if (!draftIds.has(orig.id)) await deleteChannel(orig.id);
      }

      const savedChannels = [];
      for (const ch of draft) {
        if (!ch.source.trim()) continue;
        if (ch._new) {
          const created = await addChannel({ name: ch.name, source: ch.source, type: ch.type, screen: screen || 'main' });
          savedChannels.push(created);
        } else {
          const orig = channels.find(c => c.id === ch.id);
          if (orig && (orig.name !== ch.name || orig.source !== ch.source || orig.type !== ch.type)) {
            const updated = await updateChannel(ch.id, { name: ch.name, source: ch.source, type: ch.type });
            savedChannels.push(updated);
          } else if (origIds.has(ch.id)) {
            savedChannels.push(ch);
          }
        }
      }

      const ids = savedChannels.map(c => c.id);
      if (ids.length > 0) await reorderChannels(ids);

      onChannelsUpdate(savedChannels);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const panel = (
    <>
      <div
        style={{
          display: isOpen ? 'block' : 'none',
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
        onClick={onClose}
      />

      <aside
        style={{
          position: 'fixed', top: 0, right: 0, height: '100%',
          width: 500, maxWidth: '95vw',
          background: '#0f0f0f',
          borderLeft: '1px solid #1e1e1e',
          zIndex: 9999,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e1e1e' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Ayarlar</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" onClick={() => { onFullscreen(); onClose(); }} title="Tam ekran">⛶</button>
            <button className="icon-btn" onClick={onClose} title="Kapat">✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Kanal sayısı */}
          <p className="section-title">Kanal Sayısı</p>
          <div className="count-grid">
            {channelCounts.map(c => (
              <button
                key={c}
                className="count-btn"
                style={c === channelCount ? { background: accentColor, color: '#fff' } : {}}
                onClick={() => onCountChange(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Kanal editörü */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 4 }}>
            <p className="section-title" style={{ margin: 0 }}>Kanalları Düzenle</p>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>●</span> İlk {channelCount} kanal aktif
            </span>
          </div>
          <p className="section-hint">
            Sol kenardan tutup sürükleyerek sıralayın. YouTube için video ID'si, HLS için .m3u8 adresi girin.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draft.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {draft.map((ch, i) => (
                <SortableRow
                  key={ch.id}
                  ch={ch}
                  index={i}
                  isActive={i < channelCount}
                  accentColor={accentColor}
                  onNameChange={(val) => updateName(ch.id, val)}
                  onSourceChange={(val) => updateSource(ch.id, val)}
                  onRemove={() => handleRemove(ch.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            style={{ width: '100%', marginBottom: 6, marginTop: 2, padding: '8px', background: 'transparent', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', borderRadius: 3 }}
            onClick={handleAdd}
          >
            + Kanal Ekle
          </button>

          <button
            style={{ width: '100%', padding: 10, background: accentColor, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 3, opacity: saving ? 0.6 : 1 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>

          {/* YouTube Kanal ID'leri */}
          <div style={{ marginTop: 24, borderTop: '1px solid #1e1e1e', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="section-title" style={{ margin: 0 }}>YouTube Kanal ID'leri</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {ytTab && (
                  <button
                    style={{ padding: '4px 10px', background: '#1a2a1a', border: '1px solid #2a4a2a', color: '#4ade80', fontSize: 10, cursor: 'pointer', borderRadius: 3, fontWeight: 700 }}
                    onClick={handleRefreshAll}
                  >
                    ⟳ Tümünü Güncelle
                  </button>
                )}
                <button
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', color: 'rgba(255,255,255,0.5)', fontSize: 10, cursor: 'pointer', borderRadius: 3 }}
                  onClick={() => setYtTab(v => !v)}
                >
                  {ytTab ? '▲ Gizle' : '▼ Göster'}
                </button>
              </div>
            </div>
            {ytTab && (
              <>
                <p className="section-hint" style={{ marginBottom: 8 }}>
                  Channel ID gir → Güncelle → sistem canlı yayın linkini otomatik bulur ve kaydeder.
                  <br />Bulmak için: <span style={{ fontFamily: 'monospace', fontSize: 10 }}>commentpicker.com/youtube-channel-id.php</span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {channels.filter(c => c.type === 'youtube').map(ch => {
                    const status = ytStatus[ch.id];
                    const isSaving = status === 'saving';
                    return (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#161616', padding: '4px 6px', borderRadius: 4 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                        <input
                          style={{ flex: 1, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.85)', fontSize: 10, padding: '5px 8px', borderRadius: 3, outline: 'none', fontFamily: 'monospace' }}
                          placeholder="UC… (Channel ID)"
                          value={ytDraft[ch.id] ?? (ch.yt_channel_id || '')}
                          onChange={e => setYtDraft(prev => ({ ...prev, [ch.id]: e.target.value }))}
                          onFocus={e => (e.target.style.borderColor = accentColor)}
                          onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
                        />
                        {/* Durum göstergesi */}
                        <span style={{ width: 16, textAlign: 'center', fontSize: 12, flexShrink: 0 }}>
                          {status === 'ok' && '✅'}
                          {status === 'notfound' && '⚠️'}
                          {status === 'error' && '❌'}
                          {!status && ch.yt_channel_id && '🔗'}
                        </span>
                        <button
                          style={{ padding: '4px 8px', background: isSaving ? '#111' : '#1a1a2e', border: '1px solid #333', color: isSaving ? 'rgba(255,255,255,0.3)' : '#7eb8f7', fontSize: 10, cursor: isSaving ? 'not-allowed' : 'pointer', borderRadius: 3, flexShrink: 0, fontWeight: 600 }}
                          onClick={() => handleRefreshOne(ch)}
                          disabled={isSaving || !(ytDraft[ch.id] ?? ch.yt_channel_id)}
                        >
                          {isSaving ? '⏳' : '⟳ Güncelle'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                  🔗 = kayıtlı ID var &nbsp;|&nbsp; ✅ = canlı link güncellendi &nbsp;|&nbsp; ⚠️ = canlı yayın bulunamadı
                </p>
              </>
            )}
          </div>

          {/* Link Kontrolü */}
          <div style={{ marginTop: 24, borderTop: '1px solid #1e1e1e', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="section-title" style={{ margin: 0 }}>Link Kontrolü</p>
              <button
                style={{ padding: '6px 14px', background: checking ? '#111' : '#1a1a2e', border: '1px solid #333', color: checking ? 'rgba(255,255,255,0.3)' : '#7eb8f7', fontSize: 11, cursor: checking ? 'not-allowed' : 'pointer', borderRadius: 3, fontWeight: 700 }}
                onClick={handleCheckLinks}
                disabled={checking}
              >
                {checking ? '⏳ Kontrol ediliyor…' : '🔍 Şimdi Kontrol Et'}
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: 8 }}>
              Tüm kanalları test eder, bozuk YouTube linklerini otomatik günceller. Her 30 dakikada bir otomatik çalışır.
            </p>

            {checking && (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                Kanallar kontrol ediliyor, bu birkaç dakika sürebilir…
              </div>
            )}

            {checkResult && !checkResult.error && (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: '10px 12px', fontSize: 11, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#22c55e' }}>✓ {draft.length - (checkResult.broken?.length || 0)} çalışıyor</span>
                  <span style={{ color: '#f87171' }}>✗ {checkResult.broken?.length || 0} bozuk</span>
                  <span style={{ color: '#60a5fa' }}>⟳ {checkResult.fixed?.length || 0} otomatik düzeltildi</span>
                </div>
                {checkResult.fixed?.length > 0 && checkResult.fixed.map((f, i) => (
                  <div key={i} style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2, fontSize: 10 }}>
                    <span style={{ color: '#22c55e' }}>✓</span> <span style={{ color: '#fff' }}>{f.name}</span>: <span style={{ fontFamily: 'monospace' }}>{f.old}</span> → <span style={{ fontFamily: 'monospace', color: '#22c55e' }}>{f.new}</span>
                  </div>
                ))}
                {checkResult.unfixable?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>Manuel güncelleme gerekli: </span>
                    <span style={{ color: '#f87171' }}>{checkResult.unfixable.join(', ')}</span>
                  </div>
                )}
                {checkResult.broken?.length === 0 && <span style={{ color: '#22c55e', fontWeight: 600 }}>Tüm linkler çalışıyor 🎉</span>}
              </div>
            )}
            {checkResult?.error && (
              <div style={{ background: '#1a0a0a', border: '1px solid #5a1a1a', borderRadius: 4, padding: '10px 12px', fontSize: 11, color: '#f87171', marginBottom: 8 }}>
                Hata: {checkResult.error}
              </div>
            )}

            {/* Job Geçmişi */}
            {jobLogs.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Son Kontroller</p>
                {jobLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#111', borderRadius: 3, marginBottom: 3, fontSize: 10 }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                      {new Date(log.ran_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: '#22c55e' }}>✓ {log.total - log.broken}</span>
                    {log.broken > 0 && <span style={{ color: '#f87171' }}>✗ {log.broken}</span>}
                    {log.fixed > 0 && <span style={{ color: '#60a5fa' }}>⟳ {log.fixed}</span>}
                    {log.unfixable > 0 && <span style={{ color: '#f97316' }}>⚠ {log.unfixable}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #1e1e1e', textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
            T.C. Cumhurbaşkanlığı İletişim Başkanlığı
          </p>
        </div>
      </aside>
    </>
  );

  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(panel, document.body);
}
