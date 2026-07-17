/** Browser fetch wrapper — always sends session cookies. */
export function apiFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: 'include' });
}
