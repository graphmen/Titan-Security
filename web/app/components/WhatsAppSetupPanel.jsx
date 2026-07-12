'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  ExternalLink,
  Circle,
  Smartphone,
} from 'lucide-react';
import { handleWhatsAppDeliveryResult } from '../../lib/whatsappClient';

const PROVIDER_TABS = [
  { id: 'manual', label: 'Manual', icon: MessageCircle },
  { id: 'twilio_sms', label: 'Twilio SMS', icon: Smartphone },
  { id: 'twilio_wa', label: 'Twilio WhatsApp', icon: MessageCircle },
  { id: 'meta', label: 'Meta (optional)', icon: MessageCircle },
];

export default function WhatsAppSetupPanel({ compact = false }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('manual');
  const [testPhone, setTestPhone] = useState('');
  const [testChannel, setTestChannel] = useState('auto');
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      setInfo(data);
      if (data.activeProvider && data.activeProvider !== 'manual') {
        setSelectedProvider(data.activeProvider);
      }
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const providerMeta = (info?.providers || []).find((p) => p.id === selectedProvider);
  const missing = info ? getMissingForProvider(selectedProvider, info) : [];

  const isLive =
    selectedProvider === 'manual'
      ? info?.activeProvider === 'manual' && !info?.sms?.configured
      : selectedProvider === 'twilio_sms'
        ? info?.sms?.configured && info?.probe?.ok
        : selectedProvider === 'twilio_wa'
          ? info?.whatsapp?.provider === 'twilio' && info?.probe?.ok
          : selectedProvider === 'meta'
            ? info?.whatsapp?.provider === 'meta' && info?.probe?.ok
            : false;

  const isPartial =
    selectedProvider === 'twilio_sms'
      ? info?.sms?.configured && !info?.probe?.ok
      : selectedProvider === 'twilio_wa'
        ? info?.whatsapp?.provider === 'twilio' && !info?.probe?.ok
        : selectedProvider === 'meta'
          ? info?.whatsapp?.provider === 'meta' && !info?.probe?.ok
          : false;

  const runProbe = async () => {
    setProbing(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PROBE', providerId: selectedProvider }),
      });
      const data = await res.json();
      setInfo((prev) => ({ ...prev, ...data }));
      if (!data.probe?.ok) {
        alert(data.hint || data.probe?.error || 'Connection check failed');
      }
    } finally {
      setProbing(false);
    }
  };

  const runTestSend = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      const channel =
        selectedProvider === 'twilio_sms'
          ? 'sms'
          : selectedProvider === 'twilio_wa' || selectedProvider === 'meta'
            ? 'whatsapp'
            : testChannel;
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_SEND', phone: testPhone.trim(), channel }),
      });
      const data = await res.json();
      handleWhatsAppDeliveryResult(data, { pinLabel: 'Test' });
      if (data.hint && !data.whatsapp?.sent) alert(data.hint);
      await loadStatus();
    } finally {
      setTesting(false);
    }
  };

  const bannerText = () => {
    if (loading) return 'Checking connection…';
    if (selectedProvider === 'manual') {
      if (info?.sms?.configured) {
        return 'Manual WhatsApp for shifts — guard PINs auto-send via Twilio SMS.';
      }
      return 'Manual mode — PINs open in WhatsApp until you add Twilio SMS or WhatsApp API keys.';
    }
    if (isLive) {
      if (selectedProvider === 'twilio_sms') return `Live — Twilio SMS (${info?.probe?.friendlyName || 'connected'})`;
      if (selectedProvider === 'twilio_wa') return 'Live — Twilio WhatsApp sandbox';
      return `Live — ${info?.probe?.verifiedName || info?.probe?.displayNumber || 'Meta Cloud API'}`;
    }
    if (isPartial) return 'Keys set — connection needs verification (check credentials or redeploy Vercel).';
    return providerMeta?.summary || 'Configure this provider using the steps below.';
  };

  return (
    <div className={`wa-setup-panel ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <div className="wa-setup-tabs">
          {PROVIDER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`wa-setup-tab ${selectedProvider === id ? 'is-active' : ''}`}
              onClick={() => setSelectedProvider(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`wa-setup-banner ${isLive ? 'is-live' : isPartial ? 'is-partial' : selectedProvider === 'manual' ? 'is-manual' : 'is-partial'}`}
      >
        <MessageCircle size={18} />
        <div>
          <strong>{providerMeta?.title || info?.label || 'Messaging'}</strong>
          {providerMeta?.badge && <span className="wa-setup-badge">{providerMeta.badge}</span>}
          <p>{bannerText()}</p>
          {info?.hint && !loading && selectedProvider === info?.activeProvider && (
            <span className="wa-setup-hint">{info.hint}</span>
          )}
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
        <>
          {missing.length > 0 && selectedProvider !== 'manual' && (
            <div className="wa-setup-missing">
              <AlertTriangle size={14} />
              <span>
                Missing: {missing.join(', ')} — add locally in <code>web/.env.local</code> and on{' '}
                <strong>Vercel → Environment Variables</strong>, then redeploy.
              </span>
            </div>
          )}

          <ol className="wa-setup-steps">
            {(providerMeta?.steps || info?.steps || []).map((step, i) => (
              <li key={step.id}>
                <span className="wa-setup-step-num">{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {providerMeta?.docsUrl && (
            <a
              href={providerMeta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wa-setup-docs-link"
            >
              <ExternalLink size={14} /> {providerMeta.docsLabel}
            </a>
          )}
        </>
      )}

      <div className="wa-setup-actions">
        {selectedProvider !== 'manual' && (
          <button type="button" className="btn-secondary" onClick={runProbe} disabled={probing}>
            {probing ? (
              <>
                <RefreshCw size={14} className="spin" /> Checking…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> Verify connection
              </>
            )}
          </button>
        )}
        <form onSubmit={runTestSend} className="wa-setup-test-form">
          <input
            className="form-input"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+263 77 123 4567"
            aria-label="Test phone number"
          />
          {selectedProvider === 'manual' && info?.sms?.configured && (
            <select
              className="form-input wa-setup-channel-select"
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value)}
              aria-label="Test channel"
            >
              <option value="auto">Auto</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          )}
          <button type="submit" className="btn-primary" disabled={testing || !testPhone.trim()}>
            {testing ? (
              <>
                <RefreshCw size={14} className="spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={14} /> Send test
              </>
            )}
          </button>
        </form>
      </div>

      {!compact && selectedProvider === 'manual' && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Verification SMS from Meta/Twilio often never reaches +263 numbers. Manual WhatsApp or in-person PIN delivery is the reliable option.
        </p>
      )}
      {!compact && selectedProvider === 'twilio_sms' && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Twilio trial accounts must verify each guard number in Twilio Console → Verified Caller IDs. If verification SMS never arrives on +263, use Manual mode instead.
        </p>
      )}
      {!compact && selectedProvider === 'twilio_wa' && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Each guard must send the sandbox join code to +1 415 523 8886 once before receiving messages.
        </p>
      )}
      {!compact && selectedProvider === 'meta' && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Requires Meta developer SMS verification. If blocked in Zimbabwe, use Manual WhatsApp instead.
        </p>
      )}
    </div>
  );
}

function getMissingForProvider(providerId, info) {
  if (providerId === 'manual') return [];
  if (providerId === 'twilio_sms' && !info?.sms?.configured) {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_FROM'];
  }
  if (providerId === 'twilio_wa' && info?.whatsapp?.provider !== 'twilio') {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'];
  }
  if (providerId === 'meta' && info?.whatsapp?.provider !== 'meta') {
    return ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_CLOUD_TOKEN'];
  }
  return [];
}
