import { sanitizeGuardForClient } from './localStore';

/** Strip login PINs from API payloads unless the web dashboard explicitly requests them. */
export function sanitizeStateForClient(state, { includeGuardPins = false } = {}) {
  if (!state || includeGuardPins) return state;

  const next = { ...state };
  if (state.guards) {
    next.guards = {};
    for (const [tid, list] of Object.entries(state.guards)) {
      next.guards[tid] = (list || []).map((g) => sanitizeGuardForClient(g));
    }
  }
  return next;
}

export function isWebClientRequest(req) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('client') === 'web') return true;
  } catch {
    // ignore
  }
  return req.headers.get('x-titan-client') === 'web';
}
