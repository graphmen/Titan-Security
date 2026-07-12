/** Build modal payload from a CREATE_GUARD / RESET_GUARD_PIN API result. */
export function resolvePinDelivery(result, pinLabel = 'Guard PIN') {
  if (!result?.generatedPin) return null;

  const wa = result.whatsapp;
  const email = result.email;
  const waLink = wa?.waLink || result.waLink;
  const emailSent = Boolean(email?.sent);
  const waSent = Boolean(wa?.sent);

  return {
    pin: result.generatedPin,
    label: pinLabel,
    guardName: result.guard?.fullName || null,
    phone: wa?.to || result.guard?.phone || null,
    email: email?.to || result.guard?.email || null,
    waLink,
    sent: emailSent || waSent,
    emailSent,
    waSent,
    channel: emailSent ? 'email' : wa?.channel || null,
    error: emailSent ? null : email?.error || wa?.error || null,
    emailError: email?.error || null,
    waError: wa?.error || null,
    emailNote: email?.note || null,
  };
}

/** Open wa.me for manual delivery when auto-send is not configured. */
export function openManualWhatsAppIfNeeded(data) {
  if (!data || data.waSent || data.emailSent || !data.waLink) return;
  window.open(data.waLink, '_blank', 'noopener,noreferrer');
}
