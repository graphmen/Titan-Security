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
} from 'lucide-react';
import { handleWhatsAppDeliveryResult } from '../../lib/whatsappClient';

export default function WhatsAppSetupPanel({ compact = false }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);

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

  const runProbe = async () => {
    setProbing(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PROBE' }),
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
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_SEND', phone: testPhone.trim() }),
      });
      const data = await res.json();
      handleWhatsAppDeliveryResult(data, { pinLabel: 'Test' });
      if (data.hint && !data.whatsapp?.sent) alert(data.hint);
      await loadStatus();
    } finally {
      setTesting(false);
    }
  };

  const configured = info?.configured;
  const probeOk = info?.probe?.ok;
  const missing = info?.missingEnv || [];

  return (
    <div className={`wa-setup-panel ${compact ? 'is-compact' : ''}`}>
      <div className={`wa-setup-banner ${configured && probeOk ? 'is-live' : configured ? 'is-partial' : 'is-manual'}`}>
        <MessageCircle size={18} />
        <div>
          <strong>{info?.label || 'WhatsApp'}</strong>
          <p>
            {loading
              ? 'Checking connection…'
              : configured && probeOk
                ? `Live — ${info.probe.verifiedName || info.probe.displayNumber || 'Meta Cloud API'}`
                : configured
                  ? 'Keys set — connection needs verification (check token or redeploy Vercel).'
                  : 'Manual mode — PINs open in WhatsApp until Meta API keys are added.'}
          </p>
          {info?.hint && !loading && <span className="wa-setup-hint">{info.hint}</span>}
        </div>
        <button type="button" className="btn-secondary wa-setup-refresh" onClick={loadStatus} disabled={loading} title="Refresh status">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {!compact && (
        <>
          {missing.length > 0 && (
            <div className="wa-setup-missing">
              <AlertTriangle size={14} />
              <span>
                Missing: {missing.join(', ')} — add locally in <code>web/.env.local</code> and on <strong>Vercel → Environment Variables</strong>, then redeploy.
              </span>
            </div>
          )}

          <ol className="wa-setup-steps">
            {(info?.steps || []).map((step, i) => (
              <li key={step.id}>
                <span className="wa-setup-step-num">{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="wa-setup-docs-link"
          >
            <ExternalLink size={14} /> Meta WhatsApp Cloud API guide
          </a>
        </>
      )}

      <div className="wa-setup-actions">
        {configured && (
          <button type="button" className="btn-secondary" onClick={runProbe} disabled={probing}>
            {probing ? <><RefreshCw size={14} className="spin" /> Checking…</> : <><CheckCircle2 size={14} /> Verify Meta connection</>}
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
          <button type="submit" className="btn-primary" disabled={testing || !testPhone.trim()}>
            {testing ? <><RefreshCw size={14} className="spin" /> Sending…</> : <><Send size={14} /> Send test</>}
          </button>
        </form>
      </div>

      {!compact && (
        <p className="wa-setup-footnote">
          <Circle size={8} fill="currentColor" /> Test numbers must be added in Meta Developer → WhatsApp → API Setup → <strong>To</strong> until business verification is complete.
        </p>
      )}
    </div>
  );
}
