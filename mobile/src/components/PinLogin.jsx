import { useState } from 'react';
import { Shield, Delete, Sun, Moon } from 'lucide-react';
import { findGuardByPinLocal, guardInitials } from '../utils/auth';
import { playPinKey, playPinError, playLoginSuccess } from '../utils/sounds';

const PIN_LENGTH = 6;

export default function PinLogin({ guards, tenantId, apiBase, tenantName, isDark, onToggleTheme, onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const appendDigit = (d) => {
    if (pin.length >= PIN_LENGTH || submitting) return;
    playPinKey();
    setPin((p) => {
      const next = p + d;
      if (next.length === PIN_LENGTH) {
        setTimeout(() => submitPin(next), 120);
      }
      return next;
    });
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
      const base = (apiBase || '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GUARD_LOGIN', tenantId, pin: code }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.guard) {
        playLoginSuccess();
        onLogin(json.guard, { mustChangePin: !!json.mustChangePin, currentPin: code });
        return;
      }

      // Offline fallback when server unreachable
      const local = findGuardByPinLocal(guards, code);
      if (local) {
        playLoginSuccess();
        onLogin(local, { mustChangePin: !!local.pinMustChange, currentPin: code });
        return;
      }

      playPinError();
      setError(json.error || 'Invalid PIN — check your email for your 6-digit code');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    } catch {
      const local = findGuardByPinLocal(guards, code);
      if (local) {
        playLoginSuccess();
        onLogin(local, { mustChangePin: !!local.pinMustChange, currentPin: code });
        return;
      }
      playPinError();
      setError('Cannot reach server — connect in settings or try again');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pin-login">
      <div className="pin-login-top">
        <div className="pin-login-brand">
          <div className="pin-login-logo"><Shield size={28} /></div>
          <div>
            <h1>Titan Monitor</h1>
            <p>{tenantName || 'Titan Protection'}</p>
          </div>
        </div>
        <button type="button" className="mob-theme-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <h2 className="pin-login-heading">Enter your PIN</h2>
      <p className="pin-login-sub">Your 6-digit code was sent to your email when you were registered. Check your inbox and spam folder.</p>

      <div className={`pin-dots pin-dots-6 ${shake ? 'pin-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
        ))}
      </div>

      {error && <p className="pin-error">{error}</p>}

      <div className="pin-numpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
          if (key === '') return <span key="spacer" className="pin-key spacer" />;
          if (key === 'del') {
            return (
              <button key="del" type="button" className="pin-key action" onClick={backspace} aria-label="Delete" disabled={submitting}>
                <Delete size={20} />
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
        disabled={pin.length !== PIN_LENGTH || submitting}
        onClick={() => submitPin()}
      >
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>

      <p className="pin-demo-hint">Forgot PIN? Ask your supervisor to reset it — a new code will be sent to your email.</p>
    </div>
  );
}

export { guardInitials };
