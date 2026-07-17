import { NextResponse } from 'next/server';

const ADMIN_COOKIE = 'titan_admin_session';
const SUPERVISOR_COOKIE = 'titan_supervisor_session';

function getSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'titan-dev-auth-secret-change-in-production'
  );
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyCookie(token, expectedRole) {
  if (!token || !token.includes('.')) return false;
  const [b64, sigB64] = token.split('.');
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(b64)
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(b64)));
    if (!payload.exp || Date.now() > payload.exp) return false;
    return payload.role === expectedRole;
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') {
    const cookies = parseCookies(req);
    const ok = await verifyCookie(cookies[ADMIN_COOKIE], 'admin');
    if (!ok) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (pathname.startsWith('/supervisor') && !pathname.startsWith('/supervisor/login')) {
    const cookies = parseCookies(req);
    const ok = await verifyCookie(cookies[SUPERVISOR_COOKIE], 'supervisor');
    if (!ok) {
      return NextResponse.redirect(new URL('/supervisor/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/supervisor/:path*'],
};
