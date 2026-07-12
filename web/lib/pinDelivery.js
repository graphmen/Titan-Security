/** Build modal payload from a CREATE_GUARD / RESET_GUARD_PIN API result. */
export function resolvePinDelivery(result, pinLabel = 'Guard PIN') {
  if (!result?.generatedPin) return null;

  const wa = result.whatsapp;
  const waLink = wa?.waLink || result.waLink;

  return {
    pin: result.generatedPin,
    label: pinLabel,
    guardName: result.guard?.fullName || null,
    phone: wa?.to || result.guard?.phone || null,
    waLink,
    sent: Boolean(wa?.sent),
    channel: wa?.channel || null,
    error: wa?.error || null,
  };
}

/** Open wa.me for manual delivery when auto-send is not configured. */
export function openManualWhatsAppIfNeeded(data) {
  if (!data || data.sent || !data.waLink) return;
  window.open(data.waLink, '_blank', 'noopener,noreferrer');
}
