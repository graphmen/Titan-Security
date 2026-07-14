export const MESSAGING_PROVIDERS = [
  {
    id: 'manual',
    title: 'Manual WhatsApp',
    badge: 'Works now',
    summary: 'Register a guard or supervisor → WhatsApp opens with the PIN pre-filled → tap Send. Login PINs are also emailed automatically.',
    steps: [
      {
        id: 'use',
        title: 'How PIN delivery works',
        detail:
          'When you register or reset a PIN, Titan shows the PIN on screen, emails it to the person, and opens WhatsApp with the message ready. Tap Send on your phone, or rely on the email for mobile app login.',
      },
      {
        id: 'email',
        title: 'Email delivery',
        detail:
          'Configure Resend (RESEND_API_KEY and EMAIL_FROM) in Vercel for automatic PIN emails. Guards use Titan Monitor; supervisors use Titan Supervisor.',
      },
      {
        id: 'zimbabwe',
        title: 'Best for Zimbabwe',
        detail:
          'Manual WhatsApp and email are the reliable options. No Twilio, Meta, or SMS verification is required.',
      },
    ],
    docsUrl: null,
    docsLabel: null,
  },
];

export const WHATSAPP_SETUP_STEPS = MESSAGING_PROVIDERS[0].steps;

export function getMissingEnvForProvider() {
  return [];
}

export function getProviderSteps(providerId = 'manual') {
  return MESSAGING_PROVIDERS.find((p) => p.id === providerId)?.steps || MESSAGING_PROVIDERS[0].steps;
}
