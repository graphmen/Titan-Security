import { useState } from 'react';
import { Shield, Delete } from 'lucide-react';
import { playPinKey, playPinError, playLoginSuccess } from '../utils/sounds';

const PIN_LENGTH = 6;

export default function ChangePin({ guard, tenantId, apiBase, currentPin, onComplete }) {
  const [step, setStep] = useState('new');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activeValue = step === 'new' ? newPin : confirmPin;
  const setActiveValue = step === 'new' ? setNewPin : setConfirmPin;

  const appendDigit = (d) => {
    if (activeValue.length >= PIN_LENGTH || saving) return;
    playPinKey();
    const next = activeValue + d;
    setActiveValue(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      setTimeout(() => advanceStep(next), 150);
    }
  };

  const backspace = () => {
    if (saving) return;
    playPinKey();
    setActiveValue(activeValue.slice(0, -1));
    setError('');
  };

  const advanceStep = async (code) => {
    if (step === 'new') {
      setStep('confirm');
      return;
    }
    if (code !== newPin) {
      playPinError();
      setError('PINs do not match — try again');
      setConfirmPin('');
      setStep('new');
      setNewPin('');
      return;
    }
    await savePin(code);
  };

  const savePin = async (pin) => {
    setSaving(true);
    setError('');
    try {
      const base = (apiBase || '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_GUARD_PIN',
          tenantId,
          guardId: guard.id,
          currentPin,
          newPin: pin,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not update PIN');
      playLoginSuccess();
      onComplete();
    } catch (err) {
      playPinError();
      setError(err.message || 'Could not save new PIN');
      setStep('new');
      setNewPin('');
      setConfirmPin('');
    } finally {
      setSaving(false);
    }
  };

  const name = guard.fullName?.replace(/^Officer\s/, '') || 'Guard';

  return (
    <div className="pin-login">
      <div className="pin-login-brand" style={{ marginBottom: '1rem' }}>
        <div className="pin-login-logo"><Shield size={28} /></div>
        <div>
          <h1 style={{ fontSize: '1.1rem' }}>Set Your PIN</h1>
          <p>{name} · first-time setup</p>
        </div>
      </div>

      <h2 className="pin-login-heading">{step === 'new' ? 'Choose a new 6-digit PIN' : 'Confirm your PIN'}</h2>
      <p className="pin-login-sub">Replace the temporary code from WhatsApp with your own private PIN.</p>

      <div className={`pin-dots pin-dots-6 ${error ? 'pin-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i} className={`pin-dot ${activeValue.length > i ? 'filled' : ''}`} />
        ))}
      </div>

      {error && <p className="pin-error">{error}</p>}

      <div className="pin-numpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
          if (key === '') return <span key="spacer" className="pin-key spacer" />;
          if (key === 'del') {
            return (
              <button key="del" type="button" className="pin-key action" onClick={backspace} disabled={saving}>
                <Delete size={20} />
              </button>
            );
          }
          return (
            <button key={key} type="button" className="pin-key" onClick={() => appendDigit(key)} disabled={saving}>
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
