'use client';

import React from 'react';
import { Shield, MapPin, Clock, Activity, AlertTriangle } from 'lucide-react';
import { buildGuardStatusCards } from '../../lib/guardStatusBoard.js';

const STATUS_STYLE = {
  green: { bg: '#ecfdf5', border: '#86efac', badge: 'badge-green', label: 'OK' },
  amber: { bg: '#fffbeb', border: '#fcd34d', badge: 'badge-amber', label: 'Warning' },
  red: { bg: '#fef2f2', border: '#fca5a5', badge: 'badge-red', label: 'Critical' },
};

export default function GuardStatusBoard({ state, tenantId }) {
  const cards = buildGuardStatusCards(state, tenantId);

  if (!cards.length) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No guards currently on duty.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
      {cards.map((card) => {
        const style = STATUS_STYLE[card.status] || STATUS_STYLE.green;
        return (
          <div
            key={card.guardId}
            className="glass-card"
            style={{
              padding: '1rem',
              background: style.bg,
              border: `1px solid ${style.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={14} /> {card.guardName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                  <MapPin size={11} /> {card.premiseName}
                </div>
              </div>
              <span className={`badge ${style.badge}`}>{style.label}</span>
            </div>
            <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={11} /> Clocked in {new Date(card.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Activity size={11} /> GPS {card.gpsMinutesAgo != null ? `${card.gpsMinutesAgo}m ago` : '—'}
              </span>
              <span>Last patrol {card.patrolMinutesAgo != null ? `${card.patrolMinutesAgo}m ago` : '—'}</span>
              {card.activeAlertCount > 0 && (
                <span style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={11} /> {card.activeAlertCount} active alert(s)
                </span>
              )}
              {card.reasons.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#92400e' }}>{card.reasons.join(' · ')}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
