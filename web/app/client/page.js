'use client';

import React, { useEffect, useState } from 'react';
import { Shield, MapPin, Users, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { buildGuardStatusCards } from '../../lib/guardStatusBoard';
import { patrolComplianceRate } from '../../lib/patrolMonitoring';

export default function ClientPortalPage() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [premiseId, setPremiseId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/state?client=web');
        if (res.ok) setState(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tenantId = state?.activeTenantId || 'titan';
  const premises = state?.premises?.[tenantId] || [];
  const selectedPremise = premiseId || premises[0]?.id || '';
  const checkpoints = (state?.checkpoints?.[tenantId] || []).filter((cp) => cp.premiseId === selectedPremise);
  const cards = state ? buildGuardStatusCards(state, tenantId).filter((c) => c.premiseId === selectedPremise) : [];
  const incidents = (state?.occurrenceBook || [])
    .filter((e) => (!e.tenantId || e.tenantId === tenantId) && e.premiseId === selectedPremise)
    .slice(0, 10);
  const compliance = patrolComplianceRate(checkpoints);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading client portal…</div>;
  }

  if (!state?.subscription?.isPremium) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface, #f4faf6)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '480px', padding: '2rem', textAlign: 'center' }}>
          <Shield size={40} style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Client Portal — Premium</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            The client-facing portal is included in the Premium subscription package.
            Activate Premium in Master Admin with your access token.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface, #f4faf6)', padding: '1.5rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Shield size={22} style={{ color: 'var(--color-primary, #1b4332)' }} />
            <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Titan Protection — Client Portal</h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Read-only view of guards on your site, patrol compliance, and recent incidents.
          </p>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Your site</label>
          <select
            className="input-field"
            value={selectedPremise}
            onChange={(e) => setPremiseId(e.target.value)}
            style={{ maxWidth: 360 }}
          >
            {premises.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <Users size={18} style={{ color: '#2563eb' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>Guards on duty</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{cards.length}</h3>
          </div>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <CheckCircle size={18} style={{ color: '#16a34a' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>Patrol compliance</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{compliance}%</h3>
          </div>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>Recent incidents</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{incidents.length}</h3>
          </div>
        </div>

        <section style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Activity size={16} /> Live guard status
          </h2>
          {cards.length === 0 ? (
            <div className="glass-panel" style={{ padding: '1rem', color: 'var(--text-muted)' }}>No guards on duty at this site.</div>
          ) : (
            cards.map((card) => (
              <div key={card.guardId} className="glass-panel" style={{ padding: '0.85rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{card.guardName}</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                    On duty since {new Date(card.clockIn).toLocaleTimeString()}
                  </p>
                </div>
                <span className={`badge badge-${card.status === 'green' ? 'green' : card.status === 'amber' ? 'amber' : 'red'}`}>
                  {card.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </section>

        <section>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={16} /> Recent activity
          </h2>
          {incidents.length === 0 ? (
            <div className="glass-panel" style={{ padding: '1rem', color: 'var(--text-muted)' }}>No recent incidents logged.</div>
          ) : (
            incidents.map((e) => (
              <div key={e.id} className="glass-panel" style={{ padding: '0.85rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(e.timestamp).toLocaleString()}</div>
                <strong>{e.type}</strong> — {e.guardName}
                <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{e.description}</p>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
