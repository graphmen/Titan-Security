/** Client-side handler after an API action that may have queued WhatsApp/SMS. */
export function handleWhatsAppDeliveryResult(result, { pinLabel = 'PIN' } = {}) {
  if (!result) return;
  const wa = result.whatsapp;
  const link = wa?.waLink || result.waLink;
  const channelLabel = wa?.channel === 'sms' ? 'SMS' : 'WhatsApp';

  if (wa?.sent) {
    const pinPart = result.generatedPin ? ` Login ${pinLabel}: ${result.generatedPin}.` : '';
    alert(`${channelLabel} sent to ${wa.to || 'guard'}.${pinPart}`);
    return;
  }

  if (wa?.status === 'failed') {
    const errMsg = wa.error ? `\n\nError: ${wa.error}` : '';
    alert(`${channelLabel} could not be delivered automatically.${errMsg}${result.generatedPin ? `\n\n${pinLabel}: ${result.generatedPin}` : ''}`);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    return;
  }

  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
    if (result.generatedPin && !wa?.configured) {
      setTimeout(() => {
        alert(
          `WhatsApp opened with the ${pinLabel.toLowerCase()} message.\n\nTap Send in WhatsApp to deliver it to the guard.\n\n${pinLabel}: ${result.generatedPin}\n\nFor fully automatic PIN delivery, set up Twilio SMS in Guard Management → WhatsApp (no Meta account needed).`
        );
      }, 400);
    }
    return;
  }

  if (result.generatedPin) {
    alert(`${pinLabel}: ${result.generatedPin}\n\nSet up Twilio SMS in .env.local for automatic PIN delivery, or use Manual WhatsApp mode.`);
  }
}
