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
import { addChannel, updateChannel, reorderChannels, refreshChannel, fetchChannels } from './api';

// YouTube URL veya ID'yi ayrıştırır.
// kind: 'video' → source'a yaz (API gerekmez)
// kind: 'channel' → yt_channel_id'ye yaz (mevcut API akışı)
// kind: 'raw' → olduğu gibi bırak
function parseYouTubeInput(raw) {
  const s = raw.trim();
  // video URL: youtube.com/watch?v=ID veya youtu.be/ID
  let m = s.match(/(?:youtube\.com\/watch[^#]*[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { kind: 'video', id: m[1] };
  // channel URL: youtube.com/channel/UC...
  m = s.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (m) return { kind: 'channel', id: m[1] };
  // ham UC... channel ID
  if (s.startsWith('UC') && s.length > 10) return { kind: 'channel', id: s };
  // ham video ID (tam 11 karakter, sadece geçerli base64url karakterler)
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { kind: 'video', id: s };
  return { kind: 'raw', id: s };
}

function SortableRow({ ch, index, isActive, accentColor, refreshStatus, onNameChange, onFieldChange, onToggleType, onRefreshOne }) {
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
        <div style={{ flex: 1.4, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <input
            style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', color: 'rgba(255,255,255,0.9)', fontSize: 10, padding: '6px 8px', borderRadius: 3, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
            placeholder="Kanal ID (UC…) veya video linki"
            value={ch.yt_channel_id || ch._videoIdDirect || ''}
            onChange={e => {
              const parsed = parseYouTubeInput(e.target.value);
              if (parsed.kind === 'video') {
                onFieldChange('_videoIdDirect', parsed.id);
                onFieldChange('yt_channel_id', '');
              } else if (parsed.kind === 'channel') {
                onFieldChange('yt_channel_id', parsed.id);
                onFieldChange('_videoIdDirect', '');
              } else {
                onFieldChange('yt_channel_id', e.target.value);
                onFieldChange('_videoIdDirect', '');
              }
            }}
            onFocus={e => (e.target.style.borderColor = accentColor)}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
          {ch._videoIdDirect && (
            <span style={{ fontSize: 9, color: '#7eb8f7', paddingLeft: 2 }}>
              Video ID: {ch._videoIdDirect}
            </span>
          )}
          {ch.yt_channel_id && !ch._videoIdDirect && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', paddingLeft: 2 }}>
              Kanal ID: {ch.yt_channel_id}
            </span>
          )}
        </div>
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
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose, channelCount, onCountChange, channels, onChannelsUpdate, onFullscreen, accentColor, screen }) {
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState({}); // { channelId: 'saving'|'ok'|'notfound'|'error' }
  const wasOpenRef = useRef(false);

  // Panel açıldığında draft'ı doldur. Kanallar henüz yüklenmemişse ([]) boş kalır;
  // channels API'den gelince ikinci koşul draft'ı otomatik doldurur.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDraft(channels.map(ch => ({ ...ch })));
      setRefreshStatus({});
    } else if (isOpen && draft.length === 0 && channels.length > 0) {
      setDraft(channels.map(ch => ({ ...ch })));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, channels, draft.length]);

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

  const save = async () => {
    if (draft.length === 0) {
      alert('Kanal listesi boş. Kaydetmek için en az bir kanal gerekli.');
      return;
    }
    setSaving(true);
    try {
      const origIds = new Set(channels.map(c => c.id));

      const savedChannels = [];
      for (const ch of draft) {
        const isYoutube = ch.type === 'youtube';
        const ytId = (ch.yt_channel_id || '').trim();
        const directVideoId = (ch._videoIdDirect || '').trim(); // URL'den parse edilmiş video ID
        // YouTube kanalı: channel ID veya direkt video ID'den biri olmalı
        if (isYoutube && !ytId && !directVideoId) continue;
        if (!isYoutube && !(ch.source || '').trim()) continue;

        if (ch._new) {
          if (isYoutube && directVideoId) {
            // Direkt video ID → API çağrısı yapmadan kaydet
            const created = await addChannel({ name: ch.name, source: directVideoId, type: ch.type, screen: screen || 'main' });
            savedChannels.push(created);
          } else if (isYoutube) {
            const created = await addChannel({ name: ch.name, source: '', type: ch.type, screen: screen || 'main' });
            const refreshed = await refreshChannel(created.id, ytId);
            savedChannels.push(refreshed.channel || created);
          } else {
            savedChannels.push(await addChannel({ name: ch.name, source: ch.source, type: ch.type, screen: screen || 'main' }));
          }
        } else {
          const orig = channels.find(c => c.id === ch.id);
          let result = orig;

          const nameChanged = orig && orig.name !== ch.name;
          const typeChanged = orig && orig.type !== ch.type;
          const hlsSourceChanged = !isYoutube && orig && orig.source !== ch.source;
          const directVideoChanged = isYoutube && directVideoId && orig && orig.source !== directVideoId;

          if (nameChanged || typeChanged || hlsSourceChanged || directVideoChanged) {
            result = await updateChannel(ch.id, {
              name: ch.name,
              type: ch.type,
              ...(!isYoutube ? { source: ch.source } : {}),
              ...(directVideoId ? { source: directVideoId, yt_channel_id: '' } : {}),
            });
          }

          const ytChanged = isYoutube && !directVideoId && orig && (orig.yt_channel_id || '') !== ytId;
          if (isYoutube && !directVideoId && ytId && (ytChanged || typeChanged)) {
            const refreshed = await refreshChannel(ch.id, ytId);
            result = refreshed.channel || result;
          } else if (isYoutube && !origIds.has(ch.id)) {
            result = ch;
          }

          savedChannels.push(result || ch);
        }
      }

      // Draft'taki TÜM mevcut kanalları sıraya dahil et (yeni eklenenler hariç).
      // Sadece savedChannels'ı gönderirsek atlanan kanallar eski position'ı korur
      // ve sonraki fetch'te yanlış sıra gelir.
      const reorderIds = draft
        .filter(c => !c._new)
        .map(c => savedChannels.find(s => s.id === c.id)?.id ?? c.id);
      if (reorderIds.length > 0) await reorderChannels(reorderIds);

      // Kayıt sonrası API'den taze liste çek — savedChannels eksik kalırsa UI boş kalmaz
      const fresh = await fetchChannels(screen || 'main');
      onChannelsUpdate(fresh);
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
