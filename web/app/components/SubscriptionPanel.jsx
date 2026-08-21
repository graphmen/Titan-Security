'use client';

import React, { useState } from 'react';
import { Crown, Check, Lock, Sparkles, KeyRound } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

export default function SubscriptionPanel({ subscription, tenantId, onRefresh, localEvalMode }) {
  const [token, setToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!subscription) return null;

  const handleActivate = async (e) => {
    e.preventDefault();
    setActivating(true);
    setError('');
    setMessage('');
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACTIVATE_PREMIUM_TOKEN',
          tenantId,
          token: token.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not activate Premium.');
      if (!data.state?.subscription?.isPremium) {
        throw new Error('Activation did not apply — refresh the page and try again.');
      }
      setToken('');
      setMessage(
        localEvalMode
          ? 'Premium activated for this local preview session (not saved to production).'
          : 'Premium subscription activated successfully.'
      );
      onRefresh?.(data.state);
    } catch (err) {
      setError(err.message || 'Activation failed.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Crown size={18} style={{ color: subscription.isPremium ? '#b45309' : 'var(--color-primary)' }} />
            Subscription &amp; Packages
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', maxWidth: '560px' }}>
            Phase 2 monitoring and reporting features are included in <strong>Premium</strong>.
            Use a premium access token until billing is connected.
          </p>
        </div>
        <span className={`badge ${subscription.isPremium ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.8rem' }}>
          {subscription.isPremium ? 'Premium active' : 'Core plan'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
        {(subscription.packages || []).map((pkg) => (
          <div
            key={pkg.id}
            className="glass-card"
            style={{
              padding: '1rem',
              border: subscription.tier === pkg.id ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
              background: subscription.tier === pkg.id ? '#f0fdf4' : '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              {pkg.isPremium ? <Sparkles size={14} style={{ color: '#b45309' }} /> : <Check size={14} />}
              <strong style={{ fontSize: '0.95rem' }}>{pkg.label}</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.65rem', lineHeight: 1.45 }}>
              {pkg.description}
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              {pkg.featureList.slice(0, 6).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {!subscription.isPremium && (
        <div className="glass-card" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#92400e' }}>
            <KeyRound size={15} /> Activate Premium with access token
          </div>
          {!subscription.tokenActivationAvailable ? (
            <p style={{ fontSize: '0.8rem', color: '#78350f', margin: 0 }}>
              Server has no <code>PREMIUM_ACCESS_TOKEN</code> configured yet. Add one to <code>.env.local</code> (local) or Vercel env vars (production).
            </p>
          ) : (
            <form onSubmit={handleActivate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                type="password"
                placeholder="Enter premium access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{ flex: '1 1 220px', maxWidth: '360px' }}
                autoComplete="off"
              />
              <button type="submit" className="btn-primary" disabled={activating || !token.trim()} style={{ whiteSpace: 'nowrap' }}>
                {activating ? 'Activating…' : 'Unlock Premium'}
              </button>
            </form>
          )}
        </div>
      )}

      {subscription.isPremium && subscription.premiumActivatedAt && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>
          Premium activated {new Date(subscription.premiumActivatedAt).toLocaleString()}
          {subscription.subscriptionSource === 'token' ? ' via access token' : ''}.
        </p>
      )}

      {message && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', margin: '0.75rem 0 0', fontWeight: 500 }}>{message}</p>
      )}
      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)', margin: '0.75rem 0 0', fontWeight: 500 }}>{error}</p>
      )}

      {!subscription.isPremium && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Lock size={12} /> Command Centre status board, client portal, CSV exports, and advanced monitoring settings stay locked until Premium is active.
        </div>
      )}
    </div>
  );
}
