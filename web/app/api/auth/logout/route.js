import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, SUPERVISOR_COOKIE, getSessionFromRequest } from '../../../../lib/webAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, ...session });
}

export async function POST(req) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(SUPERVISOR_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
