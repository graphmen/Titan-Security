import { NextResponse } from 'next/server';
import {
  getWhatsAppStatus,
  sendWhatsAppTest,
  probeMetaWhatsApp,
} from '../../../lib/whatsapp';
import { explainWhatsAppError, getMissingWhatsAppEnv, WHATSAPP_SETUP_STEPS } from '../../../lib/whatsappSetup';
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
  const status = getWhatsAppStatus();
  const missing = getMissingWhatsAppEnv();
  let probe = null;

  if (status.provider === 'meta') {
    probe = await probeMetaWhatsApp();
  }

  return json({
    ...status,
    missingEnv: missing,
    probe,
    steps: WHATSAPP_SETUP_STEPS,
    hint:
      missing.length > 0
        ? `Add ${missing.join(' and ')} to .env.local and Vercel, then redeploy.`
        : probe?.ok
          ? `Connected as ${probe.verifiedName || probe.displayNumber || 'WhatsApp Business'}.`
          : status.configured
            ? 'Keys found but Meta connection check failed — see probe error.'
            : 'Manual mode — messages open in WhatsApp for you to tap Send.',
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, phone, message, entryId, tenantId = 'titan' } = body;

    if (action === 'PROBE') {
      const probe = await probeMetaWhatsApp();
      return json({
        ...getWhatsAppStatus(),
        probe,
        hint: probe.ok
          ? 'Meta WhatsApp connection is healthy.'
          : explainWhatsAppError(probe.error),
      });
    }

    if (action === 'TEST_SEND') {
      if (!phone?.trim()) {
        return json({ error: 'Phone number is required for test send.' }, 400);
      }
      const result = await sendWhatsAppTest(phone.trim(), message?.trim());
      return json({
        whatsapp: result,
        hint: result.sent
          ? 'Test message delivered via WhatsApp Cloud API.'
          : result.manual
            ? 'Keys not configured — opened manual mode. Add Meta keys for auto-send.'
            : explainWhatsAppError(result.error),
      });
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
        hint: result.whatsapp?.sent ? 'Message resent successfully.' : explainWhatsAppError(result.whatsapp?.error),
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err.message, hint: explainWhatsAppError(err.message) }, 500);
  }
}
