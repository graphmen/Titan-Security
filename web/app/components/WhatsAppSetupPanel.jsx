'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  RefreshCw,
  Send,
  Circle,
  Mail,
} from 'lucide-react';
import { handleWhatsAppDeliveryResult } from '../../lib/whatsappClient';

export default function WhatsAppSetupPanel({ compact = false }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const providerMeta = (info?.providers || [])[0];

  const runTestSend = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_SEND', phone: testPhone.trim(), channel: 'whatsapp' }),
      });
      const data = await res.json();
      handleWhatsAppDeliveryResult(data, { pinLabel: 'Test' });
      if (data.hint && !data.whatsapp?.sent) alert(data.hint);
      await loadStatus();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`wa-setup-panel ${compact ? 'is-compact' : ''}`}>
      <div className="wa-setup-banner is-manual">
        <MessageCircle size={18} />
        <div>
          <strong>{providerMeta?.title || 'Manual WhatsApp'}</strong>
          {providerMeta?.badge && <span className="wa-setup-badge">{providerMeta.badge}</span>}
          <p>
            {loading
              ? 'Checking connection…'
              : info?.hint || 'PINs are emailed automatically and WhatsApp opens for you to tap Send.'}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary wa-setup-refresh"
          onClick={loadStatus}
          disabled={loading}
          title="Refresh status"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {!compact && (
        <ol className="wa-setup-steps">
          {(providerMeta?.steps || []).map((step, i) => (
            <li key={step.id}>
              <span className="wa-setup-step-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="wa-setup-actions">
        <form onSubmit={runTestSend} className="wa-setup-test-form">
          <input
            className="form-input"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+263 77 123 4567"
            aria-label="Test phone number"
          />
          <button type="submit" className="btn-primary" disabled={testing || !testPhone.trim()}>
            {testing ? (
              <>
                <RefreshCw size={14} className="spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={14} /> Send test via WhatsApp
              </>
            )}
          </button>
        </form>
      </div>

      {!compact && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Login PINs are delivered by <Mail size={12} style={{ verticalAlign: 'middle' }} /> email and manual WhatsApp only — no Twilio or Meta required.
        </p>
      )}
    </div>
  );
}
