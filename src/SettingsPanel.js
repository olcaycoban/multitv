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
import { addChannel, updateChannel, deleteChannel, reorderChannels, runLinkCheck } from './api';

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

  useEffect(() => {
    if (isOpen) setDraft(channels.map(ch => ({ ...ch })));
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
      // Yeni linkler DB'ye kaydedildiyse draft'ı güncelle
      if (result.fixed && result.fixed.length > 0) {
        setDraft(prev => prev.map(ch => {
          const fix = result.fixed.find(f => f.name === ch.name);
          return fix ? { ...ch, source: fix.new } : ch;
        }));
      }
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
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

          {/* Link Kontrolü */}
          <div style={{ marginTop: 24, borderTop: '1px solid #1e1e1e', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="section-title" style={{ margin: 0 }}>Link Kontrolü</p>
              <button
                style={{ padding: '6px 12px', background: '#1a1a2e', border: '1px solid #333', color: checking ? 'rgba(255,255,255,0.4)' : '#7eb8f7', fontSize: 11, cursor: checking ? 'not-allowed' : 'pointer', borderRadius: 3, fontWeight: 600 }}
                onClick={handleCheckLinks}
                disabled={checking}
              >
                {checking ? '⏳ Kontrol ediliyor…' : '🔍 Şimdi Kontrol Et'}
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: checking ? 8 : 0 }}>
              Tüm kanalları test eder, bozuk YouTube linklerini otomatik günceller. HLS linkler bozuksa aşağıda gösterilir.
            </p>

            {checking && (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Kanallar kontrol ediliyor, bu birkaç dakika sürebilir…
              </div>
            )}

            {checkResult && !checkResult.error && (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: '10px 12px', fontSize: 11 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#22c55e' }}>✓ Çalışan: {(draft.length) - (checkResult.broken?.length || 0)}</span>
                  <span style={{ color: '#f87171' }}>✗ Bozuk: {checkResult.broken?.length || 0}</span>
                  <span style={{ color: '#60a5fa' }}>⟳ Otomatik düzeltilen: {checkResult.fixed?.length || 0}</span>
                </div>

                {checkResult.fixed && checkResult.fixed.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ color: '#60a5fa', margin: '0 0 4px', fontWeight: 600 }}>Otomatik güncellenenler:</p>
                    {checkResult.fixed.map((f, i) => (
                      <div key={i} style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                        <span style={{ color: '#fff' }}>{f.name}</span>: <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{f.old}</span> → <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#22c55e' }}>{f.new}</span>
                      </div>
                    ))}
                  </div>
                )}

                {checkResult.unfixable && checkResult.unfixable.length > 0 && (
                  <div>
                    <p style={{ color: '#f87171', margin: '0 0 4px', fontWeight: 600 }}>Manuel güncelleme gerekli:</p>
                    {checkResult.unfixable.map((name, i) => (
                      <div key={i} style={{ color: '#f87171', marginBottom: 2 }}>⚠ {name}</div>
                    ))}
                    <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 6, fontSize: 10 }}>
                      Yukarıdaki kanal listesinde bu kanalların linklerini güncelleyin ve Kaydet'e basın.
                    </p>
                  </div>
                )}

                {checkResult.broken?.length === 0 && (
                  <div style={{ color: '#22c55e', fontWeight: 600 }}>Tüm linkler çalışıyor 🎉</div>
                )}
              </div>
            )}

            {checkResult?.error && (
              <div style={{ background: '#1a0a0a', border: '1px solid #5a1a1a', borderRadius: 4, padding: '10px 12px', fontSize: 11, color: '#f87171' }}>
                Hata: {checkResult.error}
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
