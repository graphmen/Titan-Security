/** Client-side handler after an API action that may have queued WhatsApp. */
export function handleWhatsAppDeliveryResult(result, { pinLabel = 'PIN' } = {}) {
  if (!result) return;
  const wa = result.whatsapp;
  const link = wa?.waLink || result.waLink;

  if (wa?.sent) {
    const pinPart = result.generatedPin ? ` Login ${pinLabel}: ${result.generatedPin}.` : '';
    alert(`WhatsApp sent to ${wa.to || 'guard'}.${pinPart}`);
    return;
  }

  if (wa?.status === 'failed') {
    const errMsg = wa.error ? `\n\nError: ${wa.error}` : '';
    alert(`WhatsApp could not be delivered automatically.${errMsg}${result.generatedPin ? `\n\n${pinLabel}: ${result.generatedPin}` : ''}`);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    return;
  }

  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
    if (result.generatedPin && !wa?.configured) {
      setTimeout(() => {
        alert(`WhatsApp opened with the ${pinLabel.toLowerCase()} message.\n\nTap Send in WhatsApp to deliver it to the guard.\n\n${pinLabel}: ${result.generatedPin}\n\nFor fully automatic delivery, add Meta WhatsApp Cloud API keys to web/.env.local`);
      }, 400);
    }
    return;
  }

  if (result.generatedPin) {
    alert(`${pinLabel}: ${result.generatedPin}\n\nConfigure WhatsApp API keys in .env.local for automatic delivery.`);
  }
}
