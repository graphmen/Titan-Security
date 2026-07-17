'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Delete, CornerDownLeft, Loader2, ArrowLeft, UserCog } from 'lucide-react';

const PIN_LENGTH = 6;

export default function SupervisorLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const appendDigit = (d) => {
    if (pin.length >= PIN_LENGTH || submitting) return;
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
    setError('');
  };

  const backspace = () => {
    if (submitting) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const submitPin = async (nextPin) => {
    const code = nextPin ?? pin;
    if (code.length !== PIN_LENGTH || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/supervisor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: code, tenantId: 'titan' }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push('/supervisor');
        router.refresh();
        return;
      }

      setError(json.error || 'Invalid PIN — use the same code as the Titan Supervisor mobile app');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    } catch {
      setError('Cannot reach Titan server — check your connection');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = pin.length === PIN_LENGTH && !submitting;

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-pin">
        <Link href="/login" className="auth-back">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="auth-brand compact">
          <div className="auth-role-icon supervisor inline">
            <UserCog size={24} />
          </div>
          <h1>Supervisor Sign In</h1>
          <p>Enter the same 6-digit PIN you use on the Titan Supervisor mobile app.</p>
        </div>

        <div className={`pin-dots pin-dots-6 ${shake ? 'pin-shake' : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="pin-numpad pin-numpad-large">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((key) => {
            if (key === 'del') {
              return (
                <button
                  key="del"
                  type="button"
                  className="pin-key action"
                  onClick={backspace}
                  aria-label="Delete"
                  disabled={submitting}
                >
                  <Delete size={22} />
                </button>
              );
            }
            if (key === 'ok') {
              return (
                <button
                  key="ok"
                  type="button"
                  className={`pin-key action pin-key-enter ${canSubmit ? 'ready' : ''}`}
                  onClick={() => submitPin()}
                  aria-label="Sign in"
                  disabled={!canSubmit}
                >
                  <CornerDownLeft size={22} />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className="pin-key"
                onClick={() => appendDigit(key)}
                disabled={submitting}
              >
                {key}
              </button>
            );
          })}
        </div>

        <button type="button" className="btn-primary auth-submit" disabled={!canSubmit} onClick={() => submitPin()}>
          {submitting ? (
            <>
              <Loader2 size={18} className="spin" /> Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <p className="auth-hint">
          Forgot your PIN? Ask your Master Admin to reset it from the admin dashboard.
        </p>
      </div>
    </div>
  );
}
