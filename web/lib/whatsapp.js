/** Normalize phone for WhatsApp (Zimbabwe-friendly). */
export function normalizePhone(phone) {
  let p = String(phone || '').replace(/[\s-()]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (p.startsWith('0')) p = `+263${p.slice(1)}`;
  if (p.startsWith('263') && !p.startsWith('+')) p = `+${p}`;
  if (!p.startsWith('+')) p = `+${p}`;
  return p;
}

/** Digits only for wa.me / Meta API (no + prefix). */
export function phoneDigitsForWa(phone) {
  return normalizePhone(phone).replace(/\D/g, '');
}

/** Opens WhatsApp with message pre-filled — works without any API keys. */
export function buildWhatsAppWebUrl(phone, text) {
  const digits = phoneDigitsForWa(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Manual WhatsApp only — Twilio/Meta auto-send disabled for Titan deployments. */
export function getWhatsAppProvider() {
  return 'manual';
}

export function isWhatsAppAutoSendConfigured() {
  return getWhatsAppProvider() !== 'manual';
}

function ensureOutbox(state, tenantId) {
  if (!state.whatsappOutbox) state.whatsappOutbox = {};
  if (!state.whatsappOutbox[tenantId]) state.whatsappOutbox[tenantId] = [];
  return state.whatsappOutbox[tenantId];
}

/** Queue a WhatsApp message (always stored; live send when API keys configured). */
export function queueWhatsApp(state, tenantId, { to, guardId, type, body, meta = {} }) {
  const phone = normalizePhone(to);
  const entry = {
    id: `WA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to: phone,
    guardId: guardId || null,
    type,
    body,
    meta,
    waLink: buildWhatsAppWebUrl(phone, body),
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  const outbox = ensureOutbox(state, tenantId);
  outbox.unshift(entry);
  if (outbox.length > 100) outbox.length = 100;
  return entry;
}

export function buildWelcomePinMessage(guard, pin) {
  const name = guard.fullName.replace(/^Officer\s/, '');
  return (
    `*Titan Protection — Welcome*\n\n` +
    `Hi ${name}, your Titan Monitor login PIN is:\n\n` +
    `*${pin}*\n\n` +
    `Open the Titan Monitor app and enter this 6-digit PIN to sign in. ` +
    `You will be asked to choose a new PIN on first login.\n\n` +
    `Keep this PIN private.`
  );
}

export function buildPinResetMessage(guard, pin) {
  const name = guard.fullName.replace(/^Officer\s/, '');
  return (
    `*Titan Protection — PIN Reset*\n\n` +
    `Hi ${name}, your Titan Monitor PIN has been reset.\n\n` +
    `New PIN: *${pin}*\n\n` +
    `If you did not request this, contact your supervisor immediately.`
  );
}

export function buildSupervisorWelcomePinMessage(supervisor, pin) {
  return (
    `*Titan Protection — Supervisor App*\n\n` +
    `Hi ${supervisor.fullName}, your Titan Supervisor login PIN is:\n\n` +
    `*${pin}*\n\n` +
    `Open the Titan Supervisor app and enter this 6-digit PIN to sign in. ` +
    `You will be asked to choose a new PIN on first login.\n\n` +
    `Keep this PIN private.`
  );
}

export function buildSupervisorPinResetMessage(supervisor, pin) {
  return (
    `*Titan Protection — Supervisor PIN Reset*\n\n` +
    `Hi ${supervisor.fullName}, your Titan Supervisor PIN has been reset.\n\n` +
    `New PIN: *${pin}*\n\n` +
    `If you did not request this, contact your administrator immediately.`
  );
}

export function buildShiftMessage(guard, shift, premiseName) {
  const name = guard.fullName.replace(/^Officer\s/, '');
  return (
    `*Titan Protection — Shift Assignment*\n\n` +
    `Hi ${name}, you have been scheduled:\n\n` +
    `Date: ${shift.date}\n` +
    `Time: ${shift.startTime} – ${shift.endTime} (${shift.shiftType})\n` +
    `Site: ${premiseName || 'Assigned site'}\n\n` +
    `Open Titan Monitor and enter your PIN to view your duty details.`
  );
}

export function buildSupervisorMessage(guard, supervisorName, message) {
  const name = guard.fullName.replace(/^Officer\s/, '');
  return (
    `*Titan Protection — Supervisor Message*\n\n` +
    `Hi ${name}, message from *${supervisorName}*:\n\n` +
    `${message}\n\n` +
    `_Reply through your supervisor if you need to respond._`
  );
}

/** Plain-text version for SMS (no WhatsApp markdown). */
export function plainTextBody(body) {
  return String(body || '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

export function isPinMessageType(type) {
  return type === 'welcome_pin' || type === 'pin_reset' || type === 'test';
}

export function isTwilioSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_SMS_FROM
  );
}

export function isTwilioWhatsAppConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

async function deliverViaMeta(entry) {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const to = phoneDigitsForWa(entry.to);

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: entry.body },
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    entry.status = 'failed';
    entry.error = (data.error?.message || JSON.stringify(data)).slice(0, 240);
    entry.provider = 'meta';
    return entry;
  }

  entry.status = 'sent';
  entry.provider = 'meta';
  entry.messageId = data.messages?.[0]?.id || null;
  entry.deliveredAt = new Date().toISOString();
  return entry;
}

async function deliverViaTwilioSms(entry) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const to = normalizePhone(entry.to);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: from,
      To: to,
      Body: plainTextBody(entry.body),
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    entry.status = 'failed';
    entry.error = (data.message || JSON.stringify(data)).slice(0, 240);
    entry.provider = 'twilio_sms';
    return entry;
  }

  entry.status = 'sent';
  entry.provider = 'twilio_sms';
  entry.channel = 'sms';
  entry.messageId = data.sid || null;
  entry.deliveredAt = new Date().toISOString();
  return entry;
}

async function deliverViaTwilioWhatsApp(entry) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const to = entry.to.startsWith('whatsapp:') ? entry.to : `whatsapp:${entry.to}`;
  const fromNum = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNum, To: to, Body: entry.body }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    entry.status = 'failed';
    entry.error = (data.message || JSON.stringify(data)).slice(0, 240);
    entry.provider = 'twilio';
    return entry;
  }

  entry.status = 'sent';
  entry.provider = 'twilio';
  entry.channel = 'whatsapp';
  entry.messageId = data.sid || null;
  entry.deliveredAt = new Date().toISOString();
  return entry;
}

/** Manual wa.me delivery — opens WhatsApp with PIN pre-filled for staff to tap Send. */
export async function deliverWhatsApp(entry) {
  entry.status = 'manual_send';
  entry.note = 'Open WhatsApp and tap Send, or share the PIN by email.';
  return entry;
}

/** Verify Meta token and phone number ID without sending a message. */
export async function probeMetaWhatsApp() {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_CLOUD_TOKEN are required.' };
  }

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error?.message || `Meta API returned ${res.status}`,
      code: data.error?.code,
    };
  }
  return {
    ok: true,
    displayNumber: data.display_phone_number || null,
    verifiedName: data.verified_name || null,
    qualityRating: data.quality_rating || null,
  };
}

/** Send a one-off test message (manual WhatsApp — opens wa.me link). */
export async function sendWhatsAppTest(phone, message, channel = 'whatsapp') {
  const normalized = normalizePhone(phone);
  const body =
    message ||
    '*Titan Protection — Test*\n\nYour manual WhatsApp messaging is working. Tap Send to deliver this test message.';
  const entry = {
    id: `WA-TEST-${Date.now()}`,
    to: normalized,
    type: 'test',
    body,
    status: 'queued',
    createdAt: new Date().toISOString(),
    waLink: buildWhatsAppWebUrl(normalized, body),
  };

  await deliverWhatsApp(entry);
  return buildWhatsAppDeliveryPayload(entry);
}

export async function probeTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: false, error: 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.' };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.message || `Twilio API returned ${res.status}` };
  }
  return {
    ok: true,
    friendlyName: data.friendly_name || null,
    status: data.status || null,
    smsConfigured: isTwilioSmsConfigured(),
    whatsappConfigured: isTwilioWhatsAppConfigured(),
  };
}

export function getMessagingStatus() {
  return {
    configured: false,
    provider: 'manual',
    label: 'Manual WhatsApp (wa.me links)',
    whatsapp: {
      provider: 'manual',
      configured: false,
      label: 'Manual WhatsApp (wa.me links)',
    },
    sms: {
      configured: false,
      provider: null,
      label: 'Not configured',
    },
  };
}

export function getWhatsAppStatus() {
  return getMessagingStatus();
}

export function findOutboxEntry(state, tenantId, entryId) {
  if (!entryId) return null;
  return (state.whatsappOutbox?.[tenantId] || []).find((e) => e.id === entryId) || null;
}

export function buildWhatsAppDeliveryPayload(entry) {
  const status = getWhatsAppStatus();
  if (!entry) {
    return { ...status, status: 'none', sent: false, manual: !status.configured, waLink: null, to: null, error: null, note: null, type: null };
  }
  return {
    ...status,
    status: entry.status,
    sent: entry.status === 'sent',
    manual: entry.status === 'manual_send',
    channel: entry.channel || (entry.provider === 'twilio_sms' ? 'sms' : entry.provider ? 'whatsapp' : null),
    waLink: entry.waLink || null,
    to: entry.to || null,
    error: entry.error || null,
    note: entry.note || null,
    type: entry.type || null,
    messageId: entry.messageId || null,
    deliveryProvider: entry.provider || null,
  };
}

export async function deliverPendingWhatsApp(state, tenantId) {
  const outbox = state.whatsappOutbox?.[tenantId] || [];
  const pending = outbox.filter((m) => m.status === 'queued').slice(0, 5);
  for (const entry of pending) {
    await deliverWhatsApp(entry);
  }
}

/** Deliver queued messages and return delivery summary for one outbox entry. */
export async function deliverAndSummarize(state, tenantId, entryId = null) {
  await deliverPendingWhatsApp(state, tenantId);
  return buildWhatsAppDeliveryPayload(findOutboxEntry(state, tenantId, entryId));
}
