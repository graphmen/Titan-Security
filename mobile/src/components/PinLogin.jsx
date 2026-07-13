import { useState } from 'react';
import { Delete, Sun, Moon, Loader2, CornerDownLeft } from 'lucide-react';
import { playPinKey, playPinError, playLoginSuccess } from '../utils/sounds';

const PIN_LENGTH = 6;

export default function PinLogin({
  tenantId,
  apiBase,
  tenantName,
  isDark,
  onToggleTheme,
  onLogin,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const appendDigit = (d) => {
    if (pin.length >= PIN_LENGTH || submitting) return;
    playPinKey();
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
    setError('');
  };

  const backspace = () => {
    if (submitting) return;
    playPinKey();
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const submitPin = async (nextPin) => {
    const code = nextPin ?? pin;
    if (code.length !== PIN_LENGTH || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${apiBase}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GUARD_LOGIN', tenantId, pin: code }),
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.guard) {
        playLoginSuccess();
        onLogin(json.guard, { mustChangePin: !!json.mustChangePin, currentPin: code });
        return;
      }

      playPinError();
      setError(json.error || 'Invalid PIN — check your email for your 6-digit code');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    } catch {
      playPinError();
      setError('Cannot reach Titan server — check your internet connection and try again');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = pin.length === PIN_LENGTH && !submitting;

  return (
    <div className={`pin-login ${submitting ? 'pin-login-busy' : ''}`}>
      {submitting && (
        <div className="pin-login-overlay" aria-live="polite" aria-busy="true">
          <div className="pin-login-spinner-wrap">
            <Loader2 size={44} className="pin-login-spinner" />
            <p>Signing you in…</p>
          </div>
        </div>
      )}

      <div className="pin-login-top">
        <div className="pin-login-brand">
          <div className="pin-login-logo">
            <img src="/app-icon.svg" alt="" className="pin-login-emblem" />
          </div>
          <div>
            <h1>Titan Monitor</h1>
            <p>{tenantName || 'Titan Protection'}</p>
          </div>
        </div>
        <button type="button" className="mob-theme-btn" onClick={onToggleTheme} aria-label="Toggle theme" disabled={submitting}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="pin-login-intro">
        <h2 className="pin-login-heading">Enter Your PIN</h2>
        <p className="pin-login-sub">
          Your 6-digit login code was emailed when you were registered. Check inbox and spam folder.
        </p>

        <div className={`pin-dots pin-dots-6 ${shake ? 'pin-shake' : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="pin-error">{error}</p>}
      </div>

      <div className="pin-login-keyboard">
        <div className="pin-numpad pin-numpad-large">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((key) => {
            if (key === 'del') {
              return (
                <button key="del" type="button" className="pin-key action" onClick={backspace} aria-label="Delete" disabled={submitting}>
                  <Delete size={26} />
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
                  <CornerDownLeft size={26} />
                  <span className="pin-key-enter-label">OK</span>
                </button>
              );
            }
            return (
              <button key={key} type="button" className="pin-key" onClick={() => appendDigit(key)} disabled={submitting}>
                {key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="pin-submit-btn"
          disabled={!canSubmit}
          onClick={() => submitPin()}
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="pin-btn-spinner" />
              Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <p className="pin-demo-hint">Forgot PIN? Ask your supervisor to reset it — a new code will be emailed to you.</p>
      </div>
    </div>
  );
}
