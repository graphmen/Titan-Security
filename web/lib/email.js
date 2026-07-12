/** Guard PIN delivery via email (Resend — no phone/SMS verification needed). */

export function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function getEmailStatus() {
  const configured = isEmailConfigured();
  return {
    configured,
    provider: configured ? 'resend' : null,
    from: process.env.EMAIL_FROM || null,
    label: configured ? `Resend (${process.env.EMAIL_FROM})` : 'Not configured',
  };
}

function guardDisplayName(guard) {
  return String(guard?.fullName || 'Guard').replace(/^Officer\s/, '');
}

function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;margin:0">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
<div style="font-size:13px;font-weight:700;color:#1b4332;letter-spacing:0.04em;margin-bottom:16px">TITAN PROTECTION</div>
<h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${title}</h1>
${bodyHtml}
<p style="font-size:12px;color:#64748b;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px">Keep this PIN private. If you did not expect this message, contact your supervisor.</p>
</div></body></html>`;
}

export function buildWelcomePinEmailContent(guard, pin) {
  const name = guardDisplayName(guard);
  const html = emailShell(
    'Your Titan Monitor login PIN',
    `<p style="color:#334155;line-height:1.5">Hi ${name},</p>
<p style="color:#334155;line-height:1.5">Your supervisor registered you on Titan Monitor. Use this 6-digit PIN to sign in on the mobile app:</p>
<p style="font-size:36px;font-weight:800;letter-spacing:8px;color:#1b4332;text-align:center;margin:24px 0">${pin}</p>
<p style="color:#334155;line-height:1.5">Open <strong>Titan Monitor</strong>, enter the PIN, then choose a new PIN when prompted on first login.</p>`
  );
  const text =
    `Titan Protection — Welcome\n\nHi ${name},\n\nYour Titan Monitor login PIN is: ${pin}\n\n` +
    `Open the Titan Monitor app and enter this 6-digit PIN to sign in. You will be asked to choose a new PIN on first login.\n\nKeep this PIN private.`;
  return { subject: 'Titan Protection — Your login PIN', html, text };
}

export function buildPinResetEmailContent(guard, pin) {
  const name = guardDisplayName(guard);
  const html = emailShell(
    'Your PIN has been reset',
    `<p style="color:#334155;line-height:1.5">Hi ${name},</p>
<p style="color:#334155;line-height:1.5">Your Titan Monitor PIN has been reset. Your new login PIN is:</p>
<p style="font-size:36px;font-weight:800;letter-spacing:8px;color:#1b4332;text-align:center;margin:24px 0">${pin}</p>
<p style="color:#334155;line-height:1.5">If you did not request this reset, contact your supervisor immediately.</p>`
  );
  const text =
    `Titan Protection — PIN Reset\n\nHi ${name},\n\nYour new Titan Monitor PIN is: ${pin}\n\n` +
    `If you did not request this, contact your supervisor immediately.`;
  return { subject: 'Titan Protection — PIN reset', html, text };
}

async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data);
    throw new Error(String(msg).slice(0, 240));
  }
  return data;
}

/** Send guard PIN email. Does not throw — returns delivery payload. */
export async function deliverGuardPinEmail(guard, pin, type = 'welcome_pin') {
  const to = String(guard?.email || '').trim().toLowerCase();

  if (!to) {
    return {
      status: 'skipped',
      sent: false,
      reason: 'no_email',
      note: 'Guard has no email address.',
    };
  }

  if (!isValidEmailAddress(to)) {
    return {
      status: 'failed',
      sent: false,
      to,
      error: 'Invalid email address on guard profile.',
    };
  }

  if (!isEmailConfigured()) {
    return {
      status: 'not_configured',
      sent: false,
      to,
      note: 'Add RESEND_API_KEY and EMAIL_FROM to web/.env.local and Vercel, then redeploy.',
    };
  }

  const content =
    type === 'pin_reset'
      ? buildPinResetEmailContent(guard, pin)
      : buildWelcomePinEmailContent(guard, pin);

  try {
    const data = await sendViaResend({ to, ...content });
    return {
      status: 'sent',
      sent: true,
      to,
      provider: 'resend',
      messageId: data.id || null,
      deliveredAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'failed',
      sent: false,
      to,
      provider: 'resend',
      error: err.message,
    };
  }
}

export async function sendEmailTest(to, message) {
  const testTo = String(to || '').trim().toLowerCase();
  if (!isValidEmailAddress(testTo)) {
    return { status: 'failed', sent: false, error: 'Valid email address required.' };
  }
  if (!isEmailConfigured()) {
    return { status: 'not_configured', sent: false, error: 'RESEND_API_KEY and EMAIL_FROM are required.' };
  }

  const html = emailShell(
    'Titan Protection — Email test',
    `<p style="color:#334155;line-height:1.5">${message || 'Your Titan email integration is working. Guard login PINs will be sent to this inbox when guards are registered.'}</p>`
  );

  try {
    const data = await sendViaResend({
      to: testTo,
      subject: 'Titan Protection — Test email',
      html,
      text: message || 'Titan Protection email test — integration is working.',
    });
    return { status: 'sent', sent: true, to: testTo, messageId: data.id || null, provider: 'resend' };
  } catch (err) {
    return { status: 'failed', sent: false, to: testTo, error: err.message, provider: 'resend' };
  }
}
