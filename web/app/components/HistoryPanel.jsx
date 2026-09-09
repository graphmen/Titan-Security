'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Users, Search, Clock, Filter } from 'lucide-react';
import { getOccurrenceHistory, getVisitorHistory, formatObDateTime } from '../../lib/historyArchive';
import { resolveVisitorPremiseName } from '../../lib/visitors';

export default function HistoryPanel({
  state,
  tenantId,
  guards = [],
  premises = [],
}) {
  const [section, setSection] = useState('ob');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [days, setDays] = useState('30');

  const cutoffMs = useMemo(() => {
    const d = Number(days);
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Date.now() - d * 24 * 60 * 60 * 1000;
  }, [days]);

  const obHistory = useMemo(() => {
    const rows = getOccurrenceHistory(state, tenantId).filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      return !cutoffMs || (Number.isFinite(ts) && ts >= cutoffMs);
    });
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (!q) return true;
      return (
        String(item.description || '').toLowerCase().includes(q)
        || String(item.guardName || '').toLowerCase().includes(q)
        || String(item.type || '').toLowerCase().includes(q)
      );
    });
  }, [state, tenantId, query, typeFilter, cutoffMs]);

  const visitorHistory = useMemo(() => {
    const rows = getVisitorHistory(state, tenantId).filter((v) => {
      const ts = new Date(v.checkInTime).getTime();
      return !cutoffMs || (Number.isFinite(ts) && ts >= cutoffMs);
    });
    const q = query.trim().toLowerCase();
    return rows.filter((v) => {
      if (!q) return true;
      return (
        String(v.name || '').toLowerCase().includes(q)
        || String(v.company || '').toLowerCase().includes(q)
        || String(v.idNumber || '').toLowerCase().includes(q)
        || String(v.vehiclePlate || '').toLowerCase().includes(q)
      );
    });
  }, [state, tenantId, query, cutoffMs]);

  const obTypes = useMemo(() => {
    const set = new Set(getOccurrenceHistory(state, tenantId).map((i) => i.type).filter(Boolean));
    return [...set].sort();
  }, [state, tenantId]);

  return (
    <div className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={20} style={{ color: 'var(--color-primary)' }} />
          Operations History
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Archived occurrence book entries and visitor register logs older than 24 hours. Open incidents remain on the live Command Centre feed until resolved.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn-secondary ${section === 'ob' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', opacity: section === 'ob' ? 1 : 0.85 }}
            onClick={() => setSection('ob')}
          >
            <BookOpen size={14} /> OB History ({obHistory.length})
          </button>
          <button
            type="button"
            className={`btn-secondary ${section === 'visitors' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', opacity: section === 'visitors' ? 1 : 0.85 }}
            onClick={() => setSection('visitors')}
          >
            <Users size={14} /> Visitor Archive ({visitorHistory.length})
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label><Search size={12} /> Search</label>
            <input
              className="form-input"
              placeholder={section === 'ob' ? 'Guard, type, description…' : 'Name, company, ID…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label><Filter size={12} /> Period</label>
            <select className="form-select" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="0">All archived</option>
            </select>
          </div>
          {section === 'ob' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Type</label>
              <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {obTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {section === 'ob' ? (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          {obHistory.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No archived OB entries for this period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {obHistory.map((item) => (
                <div key={item.id} className="glass-card" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${
                      item.type === 'SOS Panic Alarm' ? 'badge-red'
                        : item.type === 'Patrol Tap' ? 'badge-blue'
                        : 'badge-green'
                    }`}>
                      {item.type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={10} /> {formatObDateTime(item.timestamp)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', margin: '0.4rem 0', fontWeight: 500 }}>{item.description}</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.guardName || '—'}
                    {item.status ? ` · ${item.status}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {visitorHistory.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No archived visitor records for this period.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Check-in</th>
                  <th style={{ padding: '0.5rem' }}>Premises</th>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>ID / Company</th>
                  <th style={{ padding: '0.5rem' }}>Vehicle</th>
                  <th style={{ padding: '0.5rem' }}>Checked out</th>
                </tr>
              </thead>
              <tbody>
                {visitorHistory.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatObDateTime(v.checkInTime)}</td>
                    <td style={{ padding: '0.5rem' }}>{resolveVisitorPremiseName(state, tenantId, v)}</td>
                    <td style={{ padding: '0.5rem' }}>{v.name}</td>
                    <td style={{ padding: '0.5rem' }}>{v.idNumber}{v.company ? ` · ${v.company}` : ''}</td>
                    <td style={{ padding: '0.5rem' }}>{v.vehiclePlate || '—'}</td>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatObDateTime(v.checkOutTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
