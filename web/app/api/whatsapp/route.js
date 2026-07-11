import { NextResponse } from 'next/server';
import {
  getMessagingStatus,
  sendWhatsAppTest,
  probeMetaWhatsApp,
  probeTwilio,
} from '../../../lib/whatsapp';
import {
  explainMessagingError,
  getMissingEnvForProvider,
  MESSAGING_PROVIDERS,
  getProviderSteps,
} from '../../../lib/whatsappSetup';
import { runSupabaseAction } from '../../../lib/supabaseState';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function buildHint(status, probe, providerId) {
  const missing = getMissingEnvForProvider(providerId);

  if (providerId === 'manual') {
    if (status.sms.configured) {
      return 'Manual WhatsApp for shifts — PINs auto-send via Twilio SMS.';
    }
    return 'Manual mode — PINs open in WhatsApp for you to tap Send. Set up Twilio SMS for automatic PIN delivery (no Meta account needed).';
  }

  if (missing.length > 0) {
    return `Add ${missing.join(', ')} to .env.local and Vercel, then redeploy.`;
  }

  if (probe?.ok) {
    if (providerId === 'twilio_sms') return `Twilio connected — ${probe.friendlyName || 'account active'}. SMS ready.`;
    if (providerId === 'twilio_wa') return `Twilio connected — WhatsApp sandbox ready.`;
    if (providerId === 'meta') {
      return `Connected as ${probe.verifiedName || probe.displayNumber || 'WhatsApp Business'}.`;
    }
  }

  if (status.configured && probe && !probe.ok) {
    return explainMessagingError(probe.error, providerId === 'meta' ? 'meta' : 'twilio');
  }

  return null;
}

export async function GET() {
  const status = getMessagingStatus();
  let probe = null;
  let activeProvider = status.whatsapp.configured
    ? status.whatsapp.provider
    : status.sms.configured
      ? 'twilio_sms'
      : 'manual';

  if (status.whatsapp.provider === 'meta') {
    probe = await probeMetaWhatsApp();
  } else if (status.sms.configured || status.whatsapp.provider === 'twilio') {
    probe = await probeTwilio();
  }

  const missing = getMissingEnvForProvider(activeProvider);

  return json({
    ...status,
    activeProvider,
    missingEnv: missing,
    probe,
    providers: MESSAGING_PROVIDERS,
    steps: getProviderSteps(activeProvider),
    hint: buildHint(status, probe, activeProvider),
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, phone, message, entryId, tenantId = 'titan', channel = 'auto', providerId } = body;

    if (action === 'PROBE') {
      const status = getMessagingStatus();
      const pid = providerId || (status.whatsapp.provider === 'meta' ? 'meta' : 'twilio_sms');
      let probe = null;

      if (pid === 'meta') {
        probe = await probeMetaWhatsApp();
      } else if (pid === 'twilio_sms' || pid === 'twilio_wa') {
        probe = await probeTwilio();
      }

      return json({
        ...status,
        probe,
        hint: probe?.ok
          ? 'Connection is healthy.'
          : explainMessagingError(probe?.error, pid === 'meta' ? 'meta' : 'twilio'),
      });
    }

    if (action === 'TEST_SEND') {
      if (!phone?.trim()) {
        return json({ error: 'Phone number is required for test send.' }, 400);
      }

      const testChannel =
        channel === 'sms' ? 'sms' : channel === 'whatsapp' ? 'whatsapp' : 'auto';
      const result = await sendWhatsAppTest(phone.trim(), message?.trim(), testChannel);

      let hint = '';
      if (result.sent) {
        hint =
          result.channel === 'sms'
            ? 'Test SMS delivered via Twilio.'
            : 'Test message delivered via WhatsApp.';
      } else if (result.manual) {
        hint =
          'No auto-send configured — use Manual mode or add Twilio SMS keys (recommended, no Meta account).';
      } else {
        hint = explainMessagingError(result.error, result.deliveryProvider);
      }

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
        hint: result.whatsapp?.sent
          ? `Message resent via ${result.whatsapp.channel === 'sms' ? 'SMS' : 'WhatsApp'}.`
          : explainMessagingError(result.whatsapp?.error, result.whatsapp?.deliveryProvider),
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err.message, hint: explainMessagingError(err.message) }, 500);
  }
}
