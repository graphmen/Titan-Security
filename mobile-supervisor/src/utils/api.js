export async function postSupervisorAction(apiBase, supervisorId, body) {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, supervisorId }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchSupervisorState(apiBase, tenantId, supervisorId) {
  const url = `${apiBase.replace(/\/$/, '')}/api/state?client=supervisor&supervisorId=${encodeURIComponent(supervisorId)}&tenantId=${encodeURIComponent(tenantId)}`;
  const res = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not load data');
  }
  return res.json();
}

export { getLocation } from './location';
