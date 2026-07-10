'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDeleteModal({ open, title, message, itemLabel, onConfirm, onCancel, confirming }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 31, 23, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        className="glass-panel"
        style={{ maxWidth: '420px', width: '100%', padding: '1.5rem', background: '#fff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ background: '#fee2e2', padding: '0.5rem', borderRadius: '8px' }}>
              <AlertTriangle size={20} style={{ color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{title || 'Confirm Delete'}</h3>
          </div>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {message || 'This action cannot be undone.'}
        </p>
        {itemLabel && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {itemLabel}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
