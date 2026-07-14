import { NextResponse } from 'next/server';
import { getMessagingStatus, sendWhatsAppTest } from '../../../lib/whatsapp';
import { MESSAGING_PROVIDERS, getProviderSteps } from '../../../lib/whatsappSetup';
import { runSupabaseAction } from '../../../lib/supabaseState';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const status = getMessagingStatus();
  return json({
    ...status,
    activeProvider: 'manual',
    missingEnv: [],
    probe: null,
    providers: MESSAGING_PROVIDERS,
    steps: getProviderSteps('manual'),
    hint: 'Login PINs are emailed automatically. WhatsApp opens with the message pre-filled — tap Send.',
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, phone, message, entryId, tenantId = 'titan' } = body;

    if (action === 'TEST_SEND') {
      if (!phone?.trim()) {
        return json({ error: 'Phone number is required for test send.' }, 400);
      }

      const result = await sendWhatsAppTest(phone.trim(), message?.trim(), 'whatsapp');
      const hint = result.manual
        ? 'WhatsApp will open with the test message — tap Send on your phone.'
        : result.sent
          ? 'Test message delivered.'
          : result.error || 'Could not send test message.';

      return json({ whatsapp: result, hint });
    }

    if (action === 'RESEND') {
      if (!entryId) return json({ error: 'entryId is required' }, 400);
      const result = await runSupabaseAction({
        action: 'RESEND_WHATSAPP',
        tenantId,
        entryId,
      });
      if (result?.error) return json(result, result.status || 400);
      return json({
        ...result,
        hint: result.whatsapp?.manual
          ? 'Open WhatsApp and tap Send.'
          : result.whatsapp?.error || 'Message queued.',
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
