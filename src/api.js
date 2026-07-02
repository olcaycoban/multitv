// Next.js API routes are same-origin — no BASE URL needed
const BASE = '';

export async function fetchChannels(screen = 'main') {
  const res = await fetch(`${BASE}/api/channels?screen=${screen}`);
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function addChannel(channel) {
  const res = await fetch(`${BASE}/api/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(channel),
  });
  if (!res.ok) throw new Error('Failed to add channel');
  return res.json();
}

export async function updateChannel(id, data) {
  const res = await fetch(`${BASE}/api/channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update channel');
  return res.json();
}

export async function deleteChannel(id) {
  const res = await fetch(`${BASE}/api/channels/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete channel');
}

export async function reorderChannels(ids) {
  const res = await fetch(`${BASE}/api/channels/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to reorder channels');
  return res.json();
}

export async function runLinkCheck() {
  const res = await fetch(`${BASE}/api/check-links`, { method: 'POST' });
  if (!res.ok) throw new Error('Link kontrolü başarısız');
  return res.json();
}

export async function getJobLogs() {
  const res = await fetch(`${BASE}/api/job-logs`);
  if (!res.ok) throw new Error('Loglar alınamadı');
  return res.json();
}

export async function updateChannelYtId(id, yt_channel_id) {
  const res = await fetch(`${BASE}/api/channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yt_channel_id }),
  });
  if (!res.ok) throw new Error('Güncelleme başarısız');
  return res.json();
}
