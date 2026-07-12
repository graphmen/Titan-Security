import { NextResponse } from 'next/server';
import { getEmailStatus, sendEmailTest } from '../../../lib/email';
import { explainEmailError, getMissingEmailEnv, EMAIL_SETUP_STEPS } from '../../../lib/emailSetup';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const status = getEmailStatus();
  const missing = getMissingEmailEnv();

  return json({
    ...status,
    missingEnv: missing,
    steps: EMAIL_SETUP_STEPS,
    hint:
      missing.length > 0
        ? `Add ${missing.join(' and ')} to .env.local and Vercel, then redeploy.`
        : status.configured
          ? 'Email PIN delivery is ready — register guards with an email address.'
          : 'Configure Resend to send login PINs by email.',
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, email, message } = body;

    if (action === 'TEST_SEND') {
      if (!email?.trim()) {
        return json({ error: 'Email address is required for test send.' }, 400);
      }
      const result = await sendEmailTest(email.trim(), message?.trim());
      return json({
        email: result,
        hint: result.sent
          ? `Test email sent to ${result.to}.`
          : explainEmailError(result.error || result.note),
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err.message, hint: explainEmailError(err.message) }, 500);
  }
}
