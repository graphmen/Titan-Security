'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, CheckCircle2, AlertTriangle, RefreshCw, Send, ExternalLink } from 'lucide-react';

export default function EmailSetupPanel({ compact = false }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email', { signal: AbortSignal.timeout(15000) });
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

  const runTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_SEND', email: testEmail.trim() }),
      });
      const data = await res.json();
      if (data.email?.sent) {
        alert(`Test email sent to ${data.email.to}. Check your inbox (and spam folder).`);
      } else {
        alert(data.hint || data.email?.error || 'Test email failed');
      }
      await loadStatus();
    } finally {
      setTesting(false);
    }
  };

  const configured = info?.configured;
  const missing = info?.missingEnv || [];

  return (
    <div className={`wa-setup-panel email-setup-panel ${compact ? 'is-compact' : ''}`}>
      <div className={`wa-setup-banner ${configured ? 'is-live' : 'is-partial'}`}>
        <Mail size={18} />
        <div>
          <strong>{info?.label || 'Email PIN delivery'}</strong>
          <span className="wa-setup-badge">Recommended</span>
          <p>
            {loading
              ? 'Checking connection…'
              : configured
                ? 'Login PINs are emailed when guards are registered — ideal for mobile app testing.'
                : 'Add Resend API keys to send guard PINs by email (no SMS verification needed).'}
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
                Missing: {missing.join(', ')} — add in <code>web/.env.local</code> and <strong>Vercel → Environment Variables</strong>, then redeploy.
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
            href="https://resend.com/docs/send-with-nextjs"
            target="_blank"
            rel="noopener noreferrer"
            className="wa-setup-docs-link"
          >
            <ExternalLink size={14} /> Resend documentation
          </a>
        </>
      )}

      <div className="wa-setup-actions">
        <form onSubmit={runTestSend} className="wa-setup-test-form">
          <input
            className="form-input"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Test email address"
          />
          <button type="submit" className="btn-primary" disabled={testing || !testEmail.trim()}>
            {testing ? (
              <>
                <RefreshCw size={14} className="spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={14} /> Send test email
              </>
            )}
          </button>
        </form>
      </div>

      {!compact && (
        <p className="wa-setup-footnote">
          <CheckCircle2 size={12} /> On Resend free tier with <code>onboarding@resend.dev</code>, emails only go to your Resend account address until you verify a domain. Use that email when registering a test guard.
        </p>
      )}
    </div>
  );
}
