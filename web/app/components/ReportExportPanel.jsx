'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Filter } from 'lucide-react';

export default function ReportExportPanel({ tenantId, guards = [], premises = [], isPremium = false }) {
  const [guardId, setGuardId] = useState('');
  const [premiseId, setPremiseId] = useState('');
  const [period, setPeriod] = useState('week');
  const [reportType, setReportType] = useState('guard-shifts');

  const buildUrl = () => {
    const params = new URLSearchParams({ tenantId, type: reportType });
    if (reportType === 'guard-shifts') params.set('period', period);
    if (guardId) params.set('guardId', guardId);
    if (premiseId) params.set('premiseId', premiseId);
    return `/api/reports?${params.toString()}`;
  };

  if (!isPremium) {
    return (
      <div className="glass-panel" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a' }}>
        <p style={{ fontSize: '0.85rem', color: '#78350f', margin: 0 }}>
          CSV report exports require Premium. Activate in Master Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <FileSpreadsheet size={18} style={{ color: 'var(--color-primary)' }} />
        Export Reports
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Report</label>
          <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="guard-shifts">Guard shifts</option>
            <option value="attendance">On duty now</option>
            <option value="incidents">Incidents</option>
            <option value="summary">Summary</option>
          </select>
        </div>
        {reportType === 'guard-shifts' && (
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>Period</label>
            <select className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </div>
        )}
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label><Filter size={11} /> Guard</label>
          <select className="form-select" value={guardId} onChange={(e) => setGuardId(e.target.value)}>
            <option value="">All guards</option>
            {guards.map((g) => (
              <option key={g.id} value={g.id}>{g.fullName}</option>
            ))}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Premises</label>
          <select className="form-select" value={premiseId} onChange={(e) => setPremiseId(e.target.value)}>
            <option value="">All sites</option>
            {premises.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <a
        href={buildUrl()}
        className="btn-primary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontSize: '0.85rem' }}
      >
        <Download size={14} /> Download CSV
      </a>
    </div>
  );
}
