// Next.js API routes are same-origin — no BASE URL needed
const BASE = '';

const fetchOpts = { credentials: 'include' };

export async function fetchMe() {
  const res = await fetch(`${BASE}/api/auth/me`, fetchOpts);
  if (!res.ok) throw new Error('Oturum yok');
  return res.json();
}

export async function logout() {
  const res = await fetch(`${BASE}/api/auth/logout`, { method: 'POST', ...fetchOpts });
  if (!res.ok) throw new Error('Çıkış başarısız');
  return res.json();
}

export async function fetchUserPreferences(screen = 'main') {
  const res = await fetch(`${BASE}/api/user/preferences?screen=${screen}`, fetchOpts);
  if (!res.ok) throw new Error('Tercihler alınamadı');
  return res.json();
}

export async function saveUserPreferences(screen, channelCount) {
  const res = await fetch(`${BASE}/api/user/preferences?screen=${screen}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ channelCount }),
  });
  if (!res.ok) throw new Error('Tercihler kaydedilemedi');
  return res.json();
}

export async function fetchChannels(screen = 'main') {
  const res = await fetch(`${BASE}/api/channels?screen=${screen}`, fetchOpts);
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function addChannel(channel) {
  const res = await fetch(`${BASE}/api/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(channel),
  });
  if (!res.ok) throw new Error('Failed to add channel');
  return res.json();
}

export async function updateChannel(id, data) {
  const res = await fetch(`${BASE}/api/channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update channel');
  return res.json();
}

export async function deleteChannel(id) {
  const res = await fetch(`${BASE}/api/channels/${id}`, { method: 'DELETE', ...fetchOpts });
  if (!res.ok) throw new Error('Failed to delete channel');
}

export async function reorderChannels(ids, screen = 'main') {
  const res = await fetch(`${BASE}/api/channels/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ids, screen }),
  });
  if (!res.ok) throw new Error('Failed to reorder channels');
  return res.json();
}

export async function runLinkCheck() {
  const res = await fetch(`${BASE}/api/check-links`, { method: 'POST', ...fetchOpts });
  if (!res.ok) throw new Error('Link kontrolü başarısız');
  return res.json();
}

export async function getJobLogs() {
  const res = await fetch(`${BASE}/api/job-logs`, fetchOpts);
  if (!res.ok) throw new Error('Loglar alınamadı');
  return res.json();
}

export async function fetchAllLiveLinks(screen) {
  const res = await fetch(`${BASE}/api/channels/fetch-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ screen }),
  });
  if (!res.ok) throw new Error('Linkler çekilemedi');
  return res.json();
}

export async function refreshChannel(id, yt_channel_id) {
  const res = await fetch(`${BASE}/api/channels/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id, yt_channel_id }),
  });
  if (!res.ok) throw new Error('Güncelleme başarısız');
  return res.json();
}

export async function updateChannelYtId(id, yt_channel_id) {
  const res = await fetch(`${BASE}/api/channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ yt_channel_id }),
  });
  if (!res.ok) throw new Error('Güncelleme başarısız');
  return res.json();
}
