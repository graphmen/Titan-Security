/** Build modal payload from guard/supervisor register or PIN reset API results. */
export function resolvePinDelivery(result, pinLabel = 'Login PIN') {
  if (!result?.generatedPin) return null;

  const person = result.guard || result.supervisor;
  const isSupervisor = Boolean(result.supervisor && !result.guard);
  const wa = result.whatsapp;
  const email = result.email;
  const waLink = wa?.waLink || result.waLink;
  const emailSent = Boolean(email?.sent);
  const waSent = Boolean(wa?.sent);

  return {
    pin: result.generatedPin,
    label: pinLabel,
    personName: person?.fullName || null,
    guardName: person?.fullName || null,
    appName: isSupervisor ? 'Titan Supervisor' : 'Titan Monitor',
    phone: wa?.to || person?.phone || null,
    email: email?.to || person?.email || null,
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
