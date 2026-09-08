'use client';

import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import { Package, Plus, Pencil, Trash2, UserCheck, RotateCcw } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ListSearchBar from './ListSearchBar';
import { matchesSearch } from '../../lib/listFilters';
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_STATUSES,
  equipmentForTenant,
} from '../../lib/equipment';

const emptyForm = () => ({
  type: 'Radio',
  assetTag: '',
  serialNumber: '',
  description: '',
  premiseId: '',
  condition: 'Good',
  status: 'Available',
  notes: '',
});

export default function EquipmentRegister({
  tenantId,
  state,
  premises = [],
  guards = [],
  onRefresh,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [issueGuardId, setIssueGuardId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const items = useMemo(() => {
    const rows = equipmentForTenant(state, tenantId);
    const q = search.trim();
    return rows.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (!q) return true;
      return matchesSearch(e, q, (item) => [item.assetTag, item.serialNumber, item.description, item.type, item.notes]);
    });
  }, [state, tenantId, search, statusFilter]);

  const postAction = async (action, data) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenantId, ...data }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      onRefresh?.();
      return true;
    } catch (e) {
      alert(e.message || 'Could not save.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), premiseId: premises[0]?.id || '' });
    setIssueGuardId('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      type: item.type || 'Other',
      assetTag: item.assetTag || '',
      serialNumber: item.serialNumber || '',
      description: item.description || '',
      premiseId: item.premiseId || '',
      condition: item.condition || 'Good',
      status: item.status || 'Available',
      notes: item.notes || '',
    });
    setIssueGuardId(item.assignedGuardId || '');
    setShowForm(true);
  };

  const saveItem = async () => {
    if (!form.assetTag.trim()) {
      alert('Asset tag / label is required');
      return;
    }
    const payload = { ...form, assetTag: form.assetTag.trim() };
    const ok = editingId
      ? await postAction('UPDATE_EQUIPMENT', { equipmentId: editingId, ...payload })
      : await postAction('CREATE_EQUIPMENT', payload);
    if (ok) {
      setShowForm(false);
      setEditingId(null);
    }
  };

  const issueToGuard = async (equipmentId) => {
    if (!issueGuardId) {
      alert('Select a guard to issue equipment to');
      return;
    }
    const g = guards.find((x) => x.id === issueGuardId);
    const ok = await postAction('ISSUE_EQUIPMENT', {
      equipmentId,
      guardId: issueGuardId,
      guardName: g?.fullName || '',
    });
    if (ok) setIssueGuardId('');
  };

  const returnItem = async (equipmentId) => {
    await postAction('RETURN_EQUIPMENT', { equipmentId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await postAction('DELETE_EQUIPMENT', { equipmentId: deleteTarget.id });
    if (ok) setDeleteTarget(null);
  };

  const guardName = (id) => guards.find((g) => g.id === id)?.fullName || '—';
  const premiseName = (id) => premises.find((p) => p.id === id)?.name || '—';

  return (
    <div className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} style={{ color: 'var(--color-primary)' }} />
              Equipment Register
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Track radios, uniforms, keys, and other assets issued to guards per site.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate} style={{ fontSize: '0.85rem' }}>
            <Plus size={14} /> Add item
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginTop: '1rem', alignItems: 'end' }}>
          <ListSearchBar value={search} onChange={setSearch} placeholder="Search asset tag, serial, type…" />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">All statuses</option>
            {EQUIPMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>{editingId ? 'Edit equipment' : 'New equipment'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="input-group">
              <label>Type</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Asset tag *</label>
              <input className="form-input" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="e.g. RADIO-042" />
            </div>
            <div className="input-group">
              <label>Serial number</label>
              <input className="form-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Site</label>
              <select className="form-select" value={form.premiseId} onChange={(e) => setForm({ ...form, premiseId: e.target.value })}>
                <option value="">Unassigned</option>
                {premises.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Condition</label>
              <select className="form-select" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" disabled={saving} onClick={saveItem}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No equipment registered yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Asset</th>
                <th style={{ padding: '0.5rem' }}>Type</th>
                <th style={{ padding: '0.5rem' }}>Site</th>
                <th style={{ padding: '0.5rem' }}>Assigned</th>
                <th style={{ padding: '0.5rem' }}>Condition</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <strong>{e.assetTag}</strong>
                    {e.serialNumber ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.serialNumber}</div> : null}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{e.type}</td>
                  <td style={{ padding: '0.5rem' }}>{premiseName(e.premiseId)}</td>
                  <td style={{ padding: '0.5rem' }}>{e.assignedGuardName || guardName(e.assignedGuardId)}</td>
                  <td style={{ padding: '0.5rem' }}>{e.condition}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span className={`badge ${e.status === 'Issued' ? 'badge-blue' : e.status === 'Available' ? 'badge-green' : 'badge-yellow'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.45rem' }} title="Edit" onClick={() => openEdit(e)}>
                        <Pencil size={12} />
                      </button>
                      {e.status === 'Issued' ? (
                        <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem' }} onClick={() => returnItem(e.id)}>
                          <RotateCcw size={12} /> Return
                        </button>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          <select className="form-select" style={{ fontSize: '0.7rem', padding: '0.2rem', maxWidth: 110 }} value={issueGuardId} onChange={(ev) => setIssueGuardId(ev.target.value)}>
                            <option value="">Issue to…</option>
                            {guards.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                          </select>
                          <button type="button" className="btn-primary" style={{ padding: '0.25rem 0.45rem' }} title="Issue" onClick={() => issueToGuard(e.id)}>
                            <UserCheck size={12} />
                          </button>
                        </span>
                      )}
                      <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.45rem', color: 'var(--color-danger)' }} title="Delete" onClick={() => setDeleteTarget(e)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete equipment?"
        message={deleteTarget ? `Remove ${deleteTarget.assetTag} from the register?` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
