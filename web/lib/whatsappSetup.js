/** Human-readable fixes for common Meta WhatsApp Cloud API errors. */
export function explainWhatsAppError(error = '') {
  const msg = String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('131030') || lower.includes('not in the allowed list') || lower.includes('recipient')) {
    return 'This phone is not on your Meta test recipient list. In Meta Developer → WhatsApp → API Setup, add the guard number under "To" (international format, e.g. +26377…).';
  }
  if (lower.includes('190') || lower.includes('expired') || lower.includes('invalid oauth') || lower.includes('session has expired')) {
    return 'Your WhatsApp access token expired or is invalid. Generate a new token in Meta Developer → WhatsApp → API Setup, or create a permanent System User token in Business Manager.';
  }
  if (lower.includes('100') && lower.includes('phone number id')) {
    return 'WHATSAPP_PHONE_NUMBER_ID looks wrong. Copy the Phone number ID from Meta Developer → WhatsApp → API Setup (not the display phone number).';
  }
  if (lower.includes('200') || lower.includes('permission')) {
    return 'The token lacks WhatsApp permissions. Use a token from an app with the WhatsApp product enabled, or a System User token with whatsapp_business_messaging.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Meta API timed out. Retry in a moment. If this persists on Vercel, check env vars are set for Production.';
  }
  return msg || 'Unknown WhatsApp error.';
}

export const WHATSAPP_SETUP_STEPS = [
  {
    id: 'app',
    title: 'Create Meta app with WhatsApp',
    detail: 'Go to developers.facebook.com → Create App → choose “Connect with customers through WhatsApp”.',
  },
  {
    id: 'keys',
    title: 'Copy API credentials',
    detail: 'WhatsApp → API Setup: copy Phone number ID and temporary access token (or System User token for production).',
  },
  {
    id: 'env',
    title: 'Add keys to Titan',
    detail: 'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_CLOUD_TOKEN in web/.env.local locally and in Vercel → Settings → Environment Variables for your live site.',
  },
  {
    id: 'recipients',
    title: 'Add test phone numbers',
    detail: 'Under API Setup → “To”, add each guard WhatsApp number (+263…) until Meta Business Verification is complete.',
  },
  {
    id: 'test',
    title: 'Send a test message',
    detail: 'Use the test panel below, then register a guard — the login PIN should arrive automatically on WhatsApp.',
  },
];

export function getMissingWhatsAppEnv() {
  const missing = [];
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!process.env.WHATSAPP_CLOUD_TOKEN) missing.push('WHATSAPP_CLOUD_TOKEN');
  return missing;
}
