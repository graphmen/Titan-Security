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

export function explainTwilioError(error = '') {
  const msg = String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('21211') || lower.includes('invalid') && lower.includes('to')) {
    return 'Invalid phone number. Use international format, e.g. +263771234567.';
  }
  if (lower.includes('21608') || lower.includes('unverified')) {
    return 'Twilio trial accounts can only send to verified numbers. Add the guard number in Twilio Console → Phone Numbers → Verified Caller IDs.';
  }
  if (lower.includes('21659') || lower.includes('not a valid')) {
    return 'TWILIO_SMS_FROM is not a valid Twilio number. Buy or use a Twilio phone number from Console → Phone Numbers.';
  }
  if (lower.includes('63007') || lower.includes('whatsapp')) {
    return 'Twilio WhatsApp sandbox: join by sending the join code to +1 415 523 8886 from the guard phone, then retry.';
  }
  if (lower.includes('authenticate') || lower.includes('401')) {
    return 'Twilio credentials invalid. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.local and Vercel.';
  }
  return msg || 'Unknown Twilio error.';
}

export function explainMessagingError(error = '', provider = '') {
  if (provider === 'twilio_sms' || provider === 'twilio') return explainTwilioError(error);
  return explainWhatsAppError(error);
}

export const MESSAGING_PROVIDERS = [
  {
    id: 'manual',
    title: 'Manual WhatsApp (no API)',
    badge: 'Works now',
    summary: 'Register a guard → WhatsApp opens with the PIN pre-filled → tap Send. No developer account needed.',
    steps: [
      {
        id: 'use',
        title: 'Already active — best for Zimbabwe',
        detail:
          'When you register or reset a guard PIN, Titan shows the PIN on screen and opens WhatsApp with the message ready. Tap Send on your phone, or tell the guard in person. No Meta, Twilio, or SMS verification needed.',
      },
      {
        id: 'zimbabwe',
        title: '+263 SMS codes often fail',
        detail:
          'International verification SMS (Meta, Twilio, etc.) frequently do not reach Zimbabwe mobile networks. Manual WhatsApp or in-person PIN delivery is the reliable path — do not wait on verification codes.',
      },
      {
        id: 'upgrade',
        title: 'Want fully automatic PINs?',
        detail: 'Set up Twilio SMS below — no Meta developer portal required. PINs arrive as text messages automatically.',
      },
    ],
    docsUrl: null,
    docsLabel: null,
  },
  {
    id: 'twilio_sms',
    title: 'Twilio SMS (recommended)',
    badge: 'No Meta needed',
    summary: 'Guard login PINs and resets send as SMS automatically. Easiest path if Meta verification is blocked in Zimbabwe.',
    steps: [
      {
        id: 'signup',
        title: 'Create a Twilio account',
        detail:
          'Sign up at twilio.com using email. If phone verification SMS never arrives on +263, try the voice-call option or skip Twilio — use Manual WhatsApp in Titan instead.',
      },
      {
        id: 'number',
        title: 'Get a Twilio phone number',
        detail: 'Console → Phone Numbers → Buy a number (SMS-capable). Trial accounts can send to verified numbers only.',
      },
      {
        id: 'verify',
        title: 'Verify guard numbers (trial)',
        detail: 'Console → Phone Numbers → Verified Caller IDs — add each guard number (+263…) while on trial.',
      },
      {
        id: 'env',
        title: 'Add keys to Titan',
        detail: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM (+1234567890) in web/.env.local and Vercel → Environment Variables, then redeploy.',
      },
      {
        id: 'test',
        title: 'Send a test SMS',
        detail: 'Use the test panel below with channel “SMS”. Register a guard — the PIN should arrive as a text message.',
      },
    ],
    docsUrl: 'https://www.twilio.com/docs/messaging',
    docsLabel: 'Twilio SMS documentation',
  },
  {
    id: 'twilio_wa',
    title: 'Twilio WhatsApp Sandbox',
    badge: 'Bypass Meta portal',
    summary: 'Use Twilio’s WhatsApp sandbox for testing — guards join with a code instead of Meta Business verification.',
    steps: [
      {
        id: 'signup',
        title: 'Create a Twilio account',
        detail: 'Sign up at twilio.com if you have not already.',
      },
      {
        id: 'sandbox',
        title: 'Enable WhatsApp sandbox',
        detail: 'Console → Messaging → Try it out → Send a WhatsApp message. Note the sandbox number (+1 415 523 8886) and join code.',
      },
      {
        id: 'join',
        title: 'Guards join the sandbox',
        detail: 'Each guard sends “join <your-code>” to the sandbox number from their WhatsApp. They must do this once.',
      },
      {
        id: 'env',
        title: 'Add keys to Titan',
        detail: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 in .env.local and Vercel, then redeploy.',
      },
      {
        id: 'test',
        title: 'Send a test message',
        detail: 'Use the test panel with channel “WhatsApp”. Shift and supervisor messages also send via this channel.',
      },
    ],
    docsUrl: 'https://www.twilio.com/docs/whatsapp/sandbox',
    docsLabel: 'Twilio WhatsApp sandbox guide',
  },
  {
    id: 'meta',
    title: 'Meta WhatsApp Cloud API',
    badge: 'Optional',
    summary: 'Official WhatsApp Business API via Meta. Requires Meta developer account SMS verification (currently blocked for you).',
    steps: [
      {
        id: 'app',
        title: 'Create Meta app with WhatsApp',
        detail: 'developers.facebook.com → Create App → “Connect with customers through WhatsApp”. Requires SMS verification on your Meta account.',
      },
      {
        id: 'keys',
        title: 'Copy API credentials',
        detail: 'WhatsApp → API Setup: copy Phone number ID and access token (or System User token for production).',
      },
      {
        id: 'env',
        title: 'Add keys to Titan',
        detail: 'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_CLOUD_TOKEN in web/.env.local and Vercel, then redeploy.',
      },
      {
        id: 'recipients',
        title: 'Add test phone numbers',
        detail: 'Under API Setup → “To”, add each guard WhatsApp number (+263…) until Meta Business Verification is complete.',
      },
      {
        id: 'test',
        title: 'Send a test message',
        detail: 'Use the test panel below. Register a guard — the login PIN should arrive automatically on WhatsApp.',
      },
    ],
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
    docsLabel: 'Meta WhatsApp Cloud API guide',
  },
];

export const WHATSAPP_SETUP_STEPS = MESSAGING_PROVIDERS.find((p) => p.id === 'meta').steps;

export function getMissingWhatsAppEnv() {
  const missing = [];
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!process.env.WHATSAPP_CLOUD_TOKEN) missing.push('WHATSAPP_CLOUD_TOKEN');
  return missing;
}

export function getMissingTwilioSmsEnv() {
  const missing = [];
  if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_SMS_FROM) missing.push('TWILIO_SMS_FROM');
  return missing;
}

export function getMissingTwilioWaEnv() {
  const missing = [];
  if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_WHATSAPP_FROM) missing.push('TWILIO_WHATSAPP_FROM');
  return missing;
}

export function getMissingEnvForProvider(providerId) {
  if (providerId === 'twilio_sms') return getMissingTwilioSmsEnv();
  if (providerId === 'twilio_wa') return getMissingTwilioWaEnv();
  if (providerId === 'meta') return getMissingWhatsAppEnv();
  return [];
}

export function getProviderSteps(providerId) {
  return MESSAGING_PROVIDERS.find((p) => p.id === providerId)?.steps || MESSAGING_PROVIDERS[0].steps;
}
