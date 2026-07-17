import { sanitizeGuardForClient } from './localStore';
import { sanitizeSupervisorPublic } from './supervisorScope';

/** Strip login PINs from API payloads unless the web dashboard explicitly requests them. */
export function sanitizeStateForClient(state, { includeGuardPins = false, includeSupervisorPins = false } = {}) {
  if (!state) return state;
  if (includeGuardPins && includeSupervisorPins) return state;

  const next = { ...state };
  if (state.guards && !includeGuardPins) {
    next.guards = {};
    for (const [tid, list] of Object.entries(state.guards)) {
      next.guards[tid] = (list || []).map((g) => sanitizeGuardForClient(g));
    }
  }
  if (state.supervisors && !includeSupervisorPins) {
    next.supervisors = {};
    for (const [tid, list] of Object.entries(state.supervisors)) {
      next.supervisors[tid] = (list || []).map((s) => sanitizeSupervisorPublic(s));
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

export function shouldIncludePinsForRequest(req, session) {
  return session?.role === 'admin' && isWebClientRequest(req);
}
