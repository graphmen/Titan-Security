import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  createAdminSessionToken,
  isAdminConfigured,
  sessionCookieOptions,
  validateAdminCredentials,
} from '../../../../../lib/webAuth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            'Master Admin is not configured. Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD in environment variables.',
        },
        { status: 503 }
      );
    }

    const { email, password } = await req.json();
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!validateAdminCredentials(email, password)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createAdminSessionToken(email);
    const res = NextResponse.json({ success: true, role: 'admin' });
    res.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error('Admin login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
