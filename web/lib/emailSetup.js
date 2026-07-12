export function explainEmailError(error = '') {
  const msg = String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('only send testing emails to your own email') || lower.includes('verify a domain')) {
    return 'Resend trial: you can only send to your Resend account email until you verify a domain. For testing, register guards using the same email you signed up with on resend.com.';
  }
  if (lower.includes('invalid') && lower.includes('from')) {
    return 'EMAIL_FROM is invalid. Use onboarding@resend.dev for quick testing, or a verified domain address like noreply@yourdomain.com.';
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'RESEND_API_KEY is invalid. Copy a new key from resend.com → API Keys.';
  }
  return msg || 'Unknown email error.';
}

export const EMAIL_SETUP_STEPS = [
  {
    id: 'signup',
    title: 'Create a Resend account',
    detail: 'Sign up at resend.com with your email — no phone verification required.',
  },
  {
    id: 'key',
    title: 'Create an API key',
    detail: 'Resend → API Keys → Create. Copy the key (starts with re_).',
  },
  {
    id: 'from',
    title: 'Set sender address',
    detail:
      'For quick testing use EMAIL_FROM=onboarding@resend.dev (Resend only delivers to your account email until you verify a domain).',
  },
  {
    id: 'env',
    title: 'Add keys to Titan',
    detail: 'Set RESEND_API_KEY and EMAIL_FROM in web/.env.local and Vercel → Environment Variables, then redeploy.',
  },
  {
    id: 'guard',
    title: 'Register guards with email',
    detail: 'Each guard needs an email on their profile. On Resend trial, use your own email to test mobile login first.',
  },
  {
    id: 'test',
    title: 'Send a test email',
    detail: 'Use the test panel below, then register a guard — the login PIN should arrive in their inbox.',
  },
];

export function getMissingEmailEnv() {
  const missing = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');
  return missing;
}
