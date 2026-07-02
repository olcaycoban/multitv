import { useState, useEffect } from 'react';
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

function SortableRow({ ch, index, isActive, accentColor, refreshStatus, onNameChange, onFieldChange, onToggleType, onRefreshOne, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });

  const activeGreen = '#22c55e';
  const isYoutube = ch.type === 'youtube';
  const isSaving = refreshStatus === 'saving';

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

      <span style={{
        fontSize: 10,
        color: isActive ? activeGreen : 'rgba(255,255,255,0.2)',
        width: 16,
        textAlign: 'right',
        flexShrink: 0,
        fontWeight: isActive ? 700 : 400,
      }}>
        {isActive ? index + 1 : '—'}
      </span>

      <input
        style={{ flex: 1, minWidth: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 11, padding: '6px 8px', borderRadius: 3, outline: 'none' }}
        placeholder="Kanal adı"
        value={ch.name}
        onChange={e => onNameChange(e.target.value)}
        onFocus={e => (e.target.style.borderColor = accentColor)}
        onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
      />

      {isYoutube ? (
        <input
          style={{ flex: 1.4, minWidth: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 10, padding: '6px 8px', borderRadius: 3, outline: 'none', fontFamily: 'monospace' }}
          placeholder="Kanal ID (UC…)"
          value={ch.yt_channel_id || ''}
          onChange={e => onFieldChange('yt_channel_id', e.target.value)}
          onFocus={e => (e.target.style.borderColor = accentColor)}
          onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
        />
      ) : (
        <input
          style={{ flex: 1.4, minWidth: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 11, padding: '6px 8px', borderRadius: 3, outline: 'none', fontFamily: 'monospace' }}
          placeholder="m3u8 URL"
          value={ch.source || ''}
          onChange={e => onFieldChange('source', e.target.value)}
          onFocus={e => (e.target.style.borderColor = accentColor)}
          onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
        />
      )}

      {/* Sabit genişlikli alan: satır türünden bağımsız hizalama için her zaman render edilir */}
      <span style={{ width: 16, textAlign: 'center', fontSize: 12, flexShrink: 0 }} title="Canlı link durumu">
        {isYoutube && refreshStatus === 'ok' && '✅'}
        {isYoutube && refreshStatus === 'notfound' && '⚠️'}
        {isYoutube && refreshStatus === 'error' && '❌'}
        {isYoutube && !refreshStatus && ch.yt_channel_id && ch.source && '🔗'}
      </span>
      <button
        style={{
          background: 'transparent', border: 'none',
          color: !isYoutube ? 'transparent' : (isSaving ? 'rgba(255,255,255,0.2)' : '#7eb8f7'),
          fontSize: 13, cursor: (!isYoutube || isSaving) ? 'default' : 'pointer',
          padding: '0 3px', lineHeight: 1, flexShrink: 0, width: 18,
          pointerEvents: isYoutube ? 'auto' : 'none',
        }}
        onClick={onRefreshOne}
        disabled={!isYoutube || isSaving || !ch.yt_channel_id || ch._new}
        title={!isYoutube ? '' : (ch._new ? 'Önce kaydedin' : 'Canlı linki şimdi yenile')}
      >
        {isYoutube ? (isSaving ? '⏳' : '⟳') : ''}
      </button>

      <button
        style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.4)', fontSize: 9, cursor: 'pointer', padding: '4px 6px', borderRadius: 3, flexShrink: 0, fontWeight: 700, width: 34 }}
        onClick={onToggleType}
        title="Tür değiştir"
      >
        {isYoutube ? 'YT' : 'HLS'}
      </button>

      <button
        style={{ background: 'transparent', border: 'none', color: 'rgba(255,80,80,0.5)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
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
  const [refreshStatus, setRefreshStatus] = useState({}); // { channelId: 'saving'|'ok'|'notfound'|'error' }

  useEffect(() => {
    if (isOpen) {
      setDraft(channels.map(ch => ({ ...ch })));
      setRefreshStatus({});
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

  const updateField = (id, field, val) =>
    setDraft(prev => prev.map(ch => ch.id === id ? { ...ch, [field]: val } : ch));

  const toggleType = (id) => {
    setDraft(prev => prev.map(ch => {
      if (ch.id !== id) return ch;
      const nextType = ch.type === 'youtube' ? 'hls' : 'youtube';
      return nextType === 'hls'
        ? { ...ch, type: nextType, source: '' }
        : { ...ch, type: nextType, yt_channel_id: ch.yt_channel_id || '' };
    }));
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
      getJobLogs().then(setJobLogs).catch(() => {});
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  // Tek bir kayıtlı kanalın canlı linkini anında yenile (mimari: sadece bozulan/istenen kanal için API çağrısı)
  const handleRefreshOne = async (ch) => {
    const ytId = (ch.yt_channel_id || '').trim();
    if (!ytId || ch._new) return;
    setRefreshStatus(s => ({ ...s, [ch.id]: 'saving' }));
    try {
      const result = await refreshChannel(ch.id, ytId);
      setRefreshStatus(s => ({ ...s, [ch.id]: result.liveId ? 'ok' : 'notfound' }));
      if (result.channel) {
        setDraft(prev => prev.map(c => c.id === ch.id ? { ...c, source: result.channel.source, yt_channel_id: result.channel.yt_channel_id } : c));
        onChannelsUpdate(prev => prev.map(c => c.id === ch.id ? result.channel : c));
      }
    } catch {
      setRefreshStatus(s => ({ ...s, [ch.id]: 'error' }));
    }
  };

  const handleAdd = () => {
    setDraft(prev => [...prev, { id: `new-${Date.now()}`, name: '', source: '', type: 'youtube', yt_channel_id: '', screen: screen || 'main', _new: true }]);
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
        const isYoutube = ch.type === 'youtube';
        const ytId = (ch.yt_channel_id || '').trim();
        if (isYoutube && !ytId) continue;       // YouTube kanalı Channel ID olmadan kaydedilmez
        if (!isYoutube && !ch.source.trim()) continue; // HLS kanalı m3u8 olmadan kaydedilmez

        if (ch._new) {
          const created = await addChannel({ name: ch.name, source: isYoutube ? '' : ch.source, type: ch.type, screen: screen || 'main' });
          if (isYoutube) {
            const refreshed = await refreshChannel(created.id, ytId);
            savedChannels.push(refreshed.channel || created);
          } else {
            savedChannels.push(created);
          }
        } else {
          const orig = channels.find(c => c.id === ch.id);
          let result = orig;

          const nameChanged = orig && orig.name !== ch.name;
          const typeChanged = orig && orig.type !== ch.type;
          const hlsSourceChanged = !isYoutube && orig && orig.source !== ch.source;

          if (nameChanged || typeChanged || hlsSourceChanged) {
            result = await updateChannel(ch.id, {
              name: ch.name,
              type: ch.type,
              ...(!isYoutube ? { source: ch.source } : {}),
            });
          }

          const ytChanged = isYoutube && orig && (orig.yt_channel_id || '') !== ytId;
          // Tür HLS -> YouTube'a değiştiyse Channel ID aynı kalmış olsa bile
          // source alanı hâlâ eski m3u8 linki olabilir; mutlaka tazele.
          if (isYoutube && ytId && (ytChanged || typeChanged)) {
            const refreshed = await refreshChannel(ch.id, ytId);
            result = refreshed.channel || result;
          } else if (isYoutube && !origIds.has(ch.id)) {
            // olağandışı durum, yine de mevcut draft'ı koru
            result = ch;
          }

          savedChannels.push(result || ch);
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
          width: 520, maxWidth: '95vw',
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
            YouTube kanalları için sadece <b>Kanal ID</b>'sini girin (UC…) — canlı yayın linki otomatik bulunur.
            HLS kanalları için doğrudan m3u8 adresini girin. Sağdaki <b>YT/HLS</b> düğmesiyle tür değiştirebilirsiniz.
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
                  refreshStatus={refreshStatus[ch.id]}
                  onNameChange={(val) => updateName(ch.id, val)}
                  onFieldChange={(field, val) => updateField(ch.id, field, val)}
                  onToggleType={() => toggleType(ch.id)}
                  onRefreshOne={() => handleRefreshOne(ch)}
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
                style={{ padding: '6px 14px', background: checking ? '#111' : '#1a1a2e', border: '1px solid #333', color: checking ? 'rgba(255,255,255,0.3)' : '#7eb8f7', fontSize: 11, cursor: checking ? 'not-allowed' : 'pointer', borderRadius: 3, fontWeight: 700 }}
                onClick={handleCheckLinks}
                disabled={checking}
              >
                {checking ? '⏳ Kontrol ediliyor…' : '🔍 Şimdi Kontrol Et'}
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: 8 }}>
              YouTube kanalları izlenirken yayın koptuğu/bittiği anda otomatik olarak o kanalın Channel ID'si üzerinden
              yeni canlı yayın aranır — zamanlanmış bir job çalışmaz, tetikleyici her zaman gerçek oynatım hatasıdır.
              Bu buton ise tüm kanalları (HLS dahil) tek seferde manuel kontrol etmek içindir.
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
                    <span style={{ color: '#f87171', fontWeight: 600 }}>Manuel müdahale gerekli: </span>
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
