import { NextResponse } from 'next/server';
import { getLocalState } from '../../../../../lib/localStore';
import { getSupabaseAppState, isSupabaseReady } from '../../../../../lib/supabaseState';
import {
  SUPERVISOR_COOKIE,
  createSupervisorSessionToken,
  sessionCookieOptions,
  verifySupervisorPin,
} from '../../../../../lib/webAuth';
import { sanitizeSupervisorPublic } from '../../../../../lib/supervisorScope';

export const dynamic = 'force-dynamic';

async function loadState() {
  if (process.env.FORCE_SUPABASE === '1' && (await isSupabaseReady())) {
    return getSupabaseAppState();
  }
  return getLocalState();
}

export async function POST(req) {
  try {
    const { pin, tenantId = 'titan' } = await req.json();
    if (!pin || String(pin).trim().length !== 6) {
      return NextResponse.json({ error: 'Enter your 6-digit supervisor PIN' }, { status: 400 });
    }

    const state = await loadState();
    const supervisor = verifySupervisorPin(state, tenantId, pin);
    if (!supervisor) {
      return NextResponse.json(
        { error: 'Invalid PIN — use the same code as the Titan Supervisor mobile app' },
        { status: 401 }
      );
    }

    const token = await createSupervisorSessionToken(supervisor.id, tenantId);
    const res = NextResponse.json({
      success: true,
      role: 'supervisor',
      supervisor: sanitizeSupervisorPublic(supervisor),
      mustChangePin: !!supervisor.pinMustChange,
    });
    res.cookies.set(SUPERVISOR_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error('Supervisor login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
