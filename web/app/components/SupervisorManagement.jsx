'use client';

import React, { useState } from 'react';
import {
  Map,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  MapPin,
  X,
  MessageCircle,
  Send,
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ListSearchBar, { TerritoryFilterSelect } from './ListSearchBar';
import WhatsAppSetupPanel from './WhatsAppSetupPanel';
import PinDeliveryModal from './PinDeliveryModal';
import { matchesSearch } from '../../lib/listFilters';
import { handleWhatsAppDeliveryResult } from '../../lib/whatsappClient';
import { resolvePinDelivery, openManualWhatsAppIfNeeded } from '../../lib/pinDelivery';

const SUPERVISOR_ROLES = ['Area Supervisor', 'Operations Supervisor', 'Regional Manager', 'Night Supervisor'];
const STATUSES = ['Active', 'Suspended', 'Off Duty'];

const emptyTerritoryForm = () => ({
  name: '',
  city: 'Harare',
  description: '',
  suburbInput: '',
  suburbs: [],
});

const emptySupervisorForm = () => ({
  fullName: '',
  employeeNumber: '',
  phone: '',
  email: '',
  role: 'Area Supervisor',
  assignedTerritoryIds: [],
  status: 'Active',
});

export default function SupervisorManagement({ tenantId, territories = [], supervisors = [], premises = [], guards = [], onRefresh }) {
  const [tab, setTab] = useState('territories');
  const [saving, setSaving] = useState(false);
  const [editingTerritoryId, setEditingTerritoryId] = useState(null);
  const [editingSupervisorId, setEditingSupervisorId] = useState(null);
  const [showTerritoryForm, setShowTerritoryForm] = useState(false);
  const [showSupervisorForm, setShowSupervisorForm] = useState(false);
  const [territoryForm, setTerritoryForm] = useState(emptyTerritoryForm());
  const [supervisorForm, setSupervisorForm] = useState(emptySupervisorForm());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [waSupervisorId, setWaSupervisorId] = useState('');
  const [waGuardId, setWaGuardId] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [territorySearch, setTerritorySearch] = useState('');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [supervisorTerritoryFilter, setSupervisorTerritoryFilter] = useState('');
  const [pinDelivery, setPinDelivery] = useState(null);

  const promptPinDelivery = (result, label = 'Supervisor PIN') => {
    const data = resolvePinDelivery(result, label);
    if (!data) return;
    openManualWhatsAppIfNeeded(data);
    setPinDelivery(data);
  };

  const postAction = async (action, data) => {
    setSaving(true);
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenantId, ...data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onRefresh?.();
      return json;
    } catch (e) {
      alert(e.message || 'Could not save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const guardsForSupervisor = (supervisorId) => {
    const sup = supervisors.find((s) => s.id === supervisorId);
    if (!sup?.assignedTerritoryIds?.length) return guards.filter((g) => g.status === 'Active');
    const territorySet = new Set(sup.assignedTerritoryIds);
    const premiseIds = premises.filter((p) => territorySet.has(p.territoryId)).map((p) => p.id);
    return guards.filter(
      (g) =>
        g.status === 'Active' &&
        (territorySet.has(g.territoryId) || (g.assignedPremiseIds || []).some((id) => premiseIds.includes(id)))
    );
  };

  const handleSupervisorWhatsApp = async (e) => {
    e.preventDefault();
    if (!waGuardId || !waMessage.trim()) return;
    const sup = supervisors.find((s) => s.id === waSupervisorId);
    const result = await postAction('SEND_GUARD_WHATSAPP', {
      guardId: waGuardId,
      message: waMessage.trim(),
      supervisorName: sup?.fullName || 'Supervisor',
    });
    if (result) {
      const wa = result.whatsapp;
      if (wa?.sent) alert(`Message sent via WhatsApp to ${wa.to || 'guard'}.`);
      else handleWhatsAppDeliveryResult(result, { pinLabel: 'Message' });
      setWaMessage('');
    }
  };

  const territoryName = (id) => territories.find((t) => t.id === id)?.name || id;
  const suburbCount = territories.reduce((n, t) => n + (t.suburbs?.length || 0), 0);
  const premisesForTerritory = (territoryId) => premises.filter((p) => p.territoryId === territoryId);
  const guardsForTerritory = (territoryId) => {
    const pids = premisesForTerritory(territoryId).map((p) => p.id);
    return guards.filter(
      (g) => g.territoryId === territoryId || (g.assignedPremiseIds || []).some((id) => pids.includes(id))
    );
  };

  const filteredTerritories = territories.filter((t) =>
    matchesSearch(t, territorySearch, (item) => [
      item.name,
      item.city,
      item.description,
      ...(item.suburbs || []).map((s) => s.name),
    ])
  );

  const filteredSupervisors = supervisors.filter((s) => {
    if (supervisorTerritoryFilter && !(s.assignedTerritoryIds || []).includes(supervisorTerritoryFilter)) {
      return false;
    }
    return matchesSearch(s, supervisorSearch, (item) => [
      item.fullName,
      item.employeeNumber,
      item.phone,
      item.email,
      item.role,
      ...(item.assignedTerritoryIds || []).map(territoryName),
    ]);
  });

  const addSuburbToForm = () => {
    const name = territoryForm.suburbInput.trim();
    if (!name || territoryForm.suburbs.some((s) => s.name === name)) return;
    setTerritoryForm({
      ...territoryForm,
      suburbs: [...territoryForm.suburbs, { id: `new-${Date.now()}`, name }],
      suburbInput: '',
    });
  };

  const removeSuburbFromForm = (name) => {
    setTerritoryForm({ ...territoryForm, suburbs: territoryForm.suburbs.filter((s) => s.name !== name) });
  };

  const resetTerritoryForm = () => {
    setTerritoryForm(emptyTerritoryForm());
    setEditingTerritoryId(null);
    setShowTerritoryForm(false);
  };

  const resetSupervisorForm = () => {
    setSupervisorForm(emptySupervisorForm());
    setEditingSupervisorId(null);
    setShowSupervisorForm(false);
  };

  const startEditTerritory = (t) => {
    setEditingTerritoryId(t.id);
    setTerritoryForm({
      name: t.name,
      city: t.city,
      description: t.description || '',
      suburbInput: '',
      suburbs: [...(t.suburbs || [])],
    });
    setShowTerritoryForm(true);
    setTab('territories');
  };

  const startEditSupervisor = (s) => {
    setEditingSupervisorId(s.id);
    setSupervisorForm({
      fullName: s.fullName,
      employeeNumber: s.employeeNumber || '',
      phone: s.phone,
      email: s.email || '',
      role: s.role || 'Area Supervisor',
      assignedTerritoryIds: [...(s.assignedTerritoryIds || [])],
      status: s.status || 'Active',
    });
    setShowSupervisorForm(true);
    setTab('supervisors');
  };

  const handleSaveTerritory = async (e) => {
    e.preventDefault();
    if (!territoryForm.name || !territoryForm.city) return;
    const payload = {
      name: territoryForm.name,
      city: territoryForm.city,
      description: territoryForm.description,
      suburbs: territoryForm.suburbs,
    };
    const ok = editingTerritoryId
      ? await postAction('UPDATE_TERRITORY', { territoryId: editingTerritoryId, updates: payload })
      : await postAction('CREATE_TERRITORY', payload);
    if (ok) resetTerritoryForm();
  };

  const handleSaveSupervisor = async (e) => {
    e.preventDefault();
    if (!supervisorForm.fullName || !supervisorForm.phone || !supervisorForm.email?.trim()) return;
    const result = editingSupervisorId
      ? await postAction('UPDATE_SUPERVISOR', { supervisorId: editingSupervisorId, updates: supervisorForm })
      : await postAction('CREATE_SUPERVISOR', supervisorForm);
    if (result) {
      if (!editingSupervisorId && result.generatedPin) {
        promptPinDelivery(result, 'New supervisor PIN');
      }
      resetSupervisorForm();
    }
  };

  const handleResetSupervisorPin = async (supervisorId) => {
    if (!window.confirm('Generate a new 6-digit PIN and deliver via email and WhatsApp?')) return;
    const result = await postAction('RESET_SUPERVISOR_PIN', { supervisorId });
    if (result?.generatedPin) promptPinDelivery(result, 'Reset supervisor PIN');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    const actionMap = { territory: 'DELETE_TERRITORY', supervisor: 'DELETE_SUPERVISOR' };
    const payloadMap = { territory: { territoryId: id }, supervisor: { supervisorId: id } };
    const ok = await postAction(actionMap[type], payloadMap[type]);
    if (ok) setDeleteTarget(null);
  };

  const toggleSupervisorTerritory = (tid) => {
    const ids = supervisorForm.assignedTerritoryIds.includes(tid)
      ? supervisorForm.assignedTerritoryIds.filter((x) => x !== tid)
      : [...supervisorForm.assignedTerritoryIds, tid];
    setSupervisorForm({ ...supervisorForm, assignedTerritoryIds: ids });
  };

  const iconBtn = (variant = 'neutral') => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: variant === 'danger' ? '#fef2f2' : '#fff',
    color: variant === 'danger' ? '#dc2626' : 'var(--text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
  });

  return (
    <div>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'territory' ? 'Territory' : 'Supervisor'}?`}
        message={deleteTarget?.message}
        itemLabel={deleteTarget?.label}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirming={saving}
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { icon: Map, label: 'Territories', value: territories.length, color: 'var(--color-primary)', bg: '#d8f3dc' },
          { icon: UserCheck, label: 'Supervisors', value: supervisors.length, color: '#2563eb', bg: '#dbeafe' },
          { icon: Building2, label: 'Suburbs Covered', value: suburbCount, color: 'var(--color-success)', bg: '#d1fae5' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="glass-panel" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ background: bg, padding: '0.55rem', borderRadius: '10px', lineHeight: 0 }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{label}</p>
              <h3 style={{ fontSize: '1.4rem', margin: '0.1rem 0 0', fontWeight: 700 }}>{value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[
          { id: 'territories', label: 'Territories', icon: Map },
          { id: 'supervisors', label: 'Supervisors', icon: UserCheck },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setTab(id)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── TERRITORIES TAB ── */}
      {tab === 'territories' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {/* Section header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: showTerritoryForm ? '1.25rem' : '1.5rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.35rem', fontWeight: 700 }}>Operational Territories</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, maxWidth: '520px', lineHeight: 1.5 }}>
                Group suburbs under a city — e.g. Kuwadzana and Warren Park under Harare West — then assign guards and premises.
              </p>
            </div>
            {!showTerritoryForm && (
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => { resetTerritoryForm(); setShowTerritoryForm(true); }}
              >
                <Plus size={15} /> Add Territory
              </button>
            )}
          </div>

          {/* Inline form panel */}
          {showTerritoryForm && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {editingTerritoryId ? 'Edit Territory' : 'New Territory'}
                </h4>
                <button type="button" onClick={resetTerritoryForm} style={{ ...iconBtn(), border: 'none', background: 'transparent' }} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveTerritory} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Territory Name *</label>
                  <input className="form-input" value={territoryForm.name} onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })} placeholder="Harare West District" required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>City *</label>
                  <input className="form-input" value={territoryForm.city} onChange={(e) => setTerritoryForm({ ...territoryForm, city: e.target.value })} placeholder="Harare" required />
                </div>
                <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <input className="form-input" value={territoryForm.description} onChange={(e) => setTerritoryForm({ ...territoryForm, description: e.target.value })} placeholder="Brief area description (optional)" />
                </div>
                <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label>Suburbs</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="form-input"
                      value={territoryForm.suburbInput}
                      onChange={(e) => setTerritoryForm({ ...territoryForm, suburbInput: e.target.value })}
                      placeholder="Type suburb name — e.g. Kuwadzana"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSuburbToForm(); } }}
                    />
                    <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap', padding: '0 1rem' }} onClick={addSuburbToForm}>Add</button>
                  </div>
                  {territoryForm.suburbs.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem' }}>
                      {territoryForm.suburbs.map((s) => (
                        <span key={s.id} className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}>
                          {s.name}
                          <button type="button" onClick={() => removeSuburbFromForm(s.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '1rem' }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button type="button" className="btn-secondary" onClick={resetTerritoryForm}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : editingTerritoryId ? 'Update Territory' : 'Save Territory'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {(territories.length > 0 || territorySearch) && (
            <div className="list-filter-row">
              <ListSearchBar
                value={territorySearch}
                onChange={setTerritorySearch}
                placeholder="Search territories, city, suburbs…"
              />
            </div>
          )}

          {/* Territory cards grid */}
          {territories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-dimmed)' }}>
              <div style={{ background: '#edf7f0', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Map size={28} style={{ color: 'var(--color-primary)', opacity: 0.6 }} />
              </div>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>No territories defined yet.</p>
              <button type="button" className="btn-primary" onClick={() => { resetTerritoryForm(); setShowTerritoryForm(true); }}>
                <Plus size={14} /> Create First Territory
              </button>
            </div>
          ) : filteredTerritories.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No territories match your search.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {filteredTerritories.map((t) => {
                const tPremises = premisesForTerritory(t.id);
                const tGuards = guardsForTerritory(t.id);
                const tSupervisors = supervisors.filter((s) => (s.assignedTerritoryIds || []).includes(t.id));
                return (
                <article
                  key={t.id}
                  className="glass-card"
                  style={{
                    padding: '1.1rem 1.15rem',
                    border: editingTerritoryId === t.id ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                    background: editingTerritoryId === t.id ? '#f0fdf4' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', minWidth: 0 }}>
                      <div style={{ background: '#d8f3dc', padding: '0.45rem', borderRadius: '8px', lineHeight: 0, flexShrink: 0 }}>
                        <Map size={16} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3 }}>{t.name}</h4>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={11} /> {t.city}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button type="button" style={iconBtn()} onClick={() => startEditTerritory(t)} title="Edit"><Pencil size={14} /></button>
                      <button
                        type="button"
                        style={iconBtn('danger')}
                        onClick={() => setDeleteTarget({
                          type: 'territory',
                          id: t.id,
                          label: `${t.name} (${t.city})`,
                          message: 'Guards and premises must be reassigned before deleting a territory.',
                        })}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {t.description && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dimmed)', lineHeight: 1.45 }}>{t.description}</p>
                  )}

                  <div>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dimmed)' }}>
                      Suburbs ({(t.suburbs || []).length})
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {(t.suburbs || []).map((s) => (
                        <span key={s.id} className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{s.name}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem' }}>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dimmed)' }}>
                      Premises ({tPremises.length})
                    </p>
                    {tPremises.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>No sites linked yet — assign territory when registering premises.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {tPremises.map((p) => (
                          <div key={p.id} style={{ fontSize: '0.75rem', background: '#f8fafc', borderRadius: '6px', padding: '0.4rem 0.55rem' }}>
                            <strong>{p.name}</strong>
                            <span style={{ color: 'var(--text-muted)' }}> · {[p.suburb, p.city].filter(Boolean).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>{tGuards.filter((g) => g.status === 'Active').length} active guard{tGuards.filter((g) => g.status === 'Active').length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{tSupervisors.length} supervisor{tSupervisors.length !== 1 ? 's' : ''}</span>
                  </div>
                </article>
              );})}
            </div>
          )}
        </div>
      )}

      {/* ── SUPERVISORS TAB ── */}
      {tab === 'supervisors' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: showSupervisorForm ? '1.25rem' : '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.35rem', fontWeight: 700 }}>Supervisor Profiles</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Assign area supervisors to the territories they manage.</p>
            </div>
            {!showSupervisorForm && (
              <button type="button" className="btn-primary" style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', whiteSpace: 'nowrap' }} onClick={() => { resetSupervisorForm(); setShowSupervisorForm(true); }}>
                <Plus size={15} /> Add Supervisor
              </button>
            )}
          </div>

          {showSupervisorForm && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1d4ed8' }}>
                  {editingSupervisorId ? 'Edit Supervisor' : 'New Supervisor'}
                </h4>
                <button type="button" onClick={resetSupervisorForm} style={{ ...iconBtn(), border: 'none', background: 'transparent' }} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveSupervisor} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}><label>Full Name *</label><input className="form-input" value={supervisorForm.fullName} onChange={(e) => setSupervisorForm({ ...supervisorForm, fullName: e.target.value })} required /></div>
                <div className="input-group" style={{ marginBottom: 0 }}><label>Employee No.</label><input className="form-input" value={supervisorForm.employeeNumber} onChange={(e) => setSupervisorForm({ ...supervisorForm, employeeNumber: e.target.value })} placeholder="Auto" /></div>
                <div className="input-group" style={{ marginBottom: 0 }}><label>Role</label><select className="form-select" value={supervisorForm.role} onChange={(e) => setSupervisorForm({ ...supervisorForm, role: e.target.value })}>{SUPERVISOR_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="input-group" style={{ marginBottom: 0 }}><label>Phone *</label><input className="form-input" value={supervisorForm.phone} onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })} required /></div>
                <div className="input-group" style={{ marginBottom: 0 }}><label>Email *</label><input className="form-input" type="email" value={supervisorForm.email} onChange={(e) => setSupervisorForm({ ...supervisorForm, email: e.target.value })} required placeholder="For Titan Supervisor app PIN" /></div>
                {editingSupervisorId && (
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Status</label><select className="form-select" value={supervisorForm.status} onChange={(e) => setSupervisorForm({ ...supervisorForm, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
                )}
                <div className="input-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                  <label>Assigned Territories</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {territories.map((t) => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', background: supervisorForm.assignedTerritoryIds.includes(t.id) ? '#d8f3dc' : '#fff', border: '1px solid var(--border-light)', padding: '0.4rem 0.7rem', borderRadius: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={supervisorForm.assignedTerritoryIds.includes(t.id)} onChange={() => toggleSupervisorTerritory(t.id)} />
                        {t.name}
                      </label>
                    ))}
                    {territories.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>Create territories first</span>}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={resetSupervisorForm}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingSupervisorId ? 'Update Supervisor' : 'Save Supervisor'}</button>
                </div>
              </form>
            </div>
          )}

          {(supervisors.length > 0 || supervisorSearch || supervisorTerritoryFilter) && (
            <div className="list-filter-row">
              <ListSearchBar
                value={supervisorSearch}
                onChange={setSupervisorSearch}
                placeholder="Search supervisors by name, phone, role…"
              />
              <TerritoryFilterSelect
                value={supervisorTerritoryFilter}
                onChange={setSupervisorTerritoryFilter}
                territories={territories}
                label="Filter by territory"
              />
            </div>
          )}

          {supervisors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-dimmed)' }}>
              <div style={{ background: '#dbeafe', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <UserCheck size={28} style={{ color: '#2563eb', opacity: 0.7 }} />
              </div>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>No supervisors registered yet.</p>
              <button type="button" className="btn-primary" onClick={() => { resetSupervisorForm(); setShowSupervisorForm(true); }}>
                <Plus size={14} /> Add First Supervisor
              </button>
            </div>
          ) : filteredSupervisors.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No supervisors match your search or territory filter.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredSupervisors.map((s) => (
                <article key={s.id} className="glass-card" style={{ padding: '1.1rem 1.15rem', border: editingSupervisorId === s.id ? '2px solid #2563eb' : '1px solid var(--border-light)', background: editingSupervisorId === s.id ? '#eff6ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                      <div style={{ background: '#dbeafe', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <UserCheck size={18} style={{ color: '#2563eb' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{s.fullName}</h4>
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.employeeNumber}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span className={`badge ${s.status === 'Active' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>{s.status}</span>
                      <button type="button" className="btn-secondary" style={{ fontSize: '0.65rem', padding: '0.25rem 0.45rem' }} onClick={() => handleResetSupervisorPin(s.id)} title="Reset mobile PIN">
                        Reset PIN
                      </button>
                      <button type="button" style={iconBtn()} onClick={() => startEditSupervisor(s)}><Pencil size={14} /></button>
                      <button
                        type="button"
                        style={iconBtn('danger')}
                        onClick={() => setDeleteTarget({ type: 'supervisor', id: s.id, label: s.fullName, message: 'This supervisor profile will be permanently removed.' })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                    <span className="badge badge-blue">{s.role}</span>
                    <span><Phone size={11} style={{ display: 'inline' }} /> {s.phone}</span>
                    {s.email && <span><Mail size={11} style={{ display: 'inline' }} /> {s.email}</span>}
                  </div>
                  <div style={{ marginTop: '0.65rem' }}>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dimmed)' }}>Territories</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {(s.assignedTerritoryIds || []).length > 0
                        ? s.assignedTerritoryIds.map((tid) => (
                          <span key={tid} className="badge badge-green" style={{ fontSize: '0.72rem' }}>{territoryName(tid)}</span>
                        ))
                        : <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>None assigned</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="dashboard-grid">
          <div className="col-12">
            <WhatsAppSetupPanel />
          </div>
          <div className="col-6">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageCircle size={18} style={{ color: 'var(--color-primary)' }} />
                Supervisor WhatsApp
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                Send instructions, shift updates, or alerts directly to guards on their WhatsApp number. Schedule formal shifts from Guard Management → Shifts (also sends WhatsApp).
              </p>
              <form onSubmit={handleSupervisorWhatsApp} style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>From Supervisor</label>
                  <select className="form-select" value={waSupervisorId} onChange={(e) => { setWaSupervisorId(e.target.value); setWaGuardId(''); }} required>
                    <option value="">Select supervisor</option>
                    {supervisors.filter((s) => s.status === 'Active').map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName} · {s.role}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>To Guard</label>
                  <select className="form-select" value={waGuardId} onChange={(e) => setWaGuardId(e.target.value)} required>
                    <option value="">Select guard</option>
                    {(waSupervisorId ? guardsForSupervisor(waSupervisorId) : guards.filter((g) => g.status === 'Active')).map((g) => (
                      <option key={g.id} value={g.id}>{g.fullName} · {g.phone}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Message</label>
                  <textarea className="form-input" rows={5} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} placeholder="Report to Kuwadzana site by 06:00. Uniform inspection at gate." required style={{ resize: 'vertical' }} />
                </div>
                <button type="submit" className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
                  <Send size={14} /> Send via WhatsApp
                </button>
              </form>
            </div>
          </div>
          <div className="col-6">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>What sends automatically</h3>
              <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '1.1rem', margin: 0 }}>
                <li><strong>Guard registration</strong> — PIN emailed + WhatsApp opens for you to tap Send</li>
                <li><strong>Supervisor registration</strong> — same PIN delivery for Titan Supervisor app</li>
                <li><strong>PIN reset</strong> — new PIN when admin resets credentials</li>
                <li><strong>Shift scheduling</strong> — date, time, and site when a shift is created or updated</li>
                <li><strong>Supervisor messages</strong> — custom instructions from this tab or Guard Management</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      <PinDeliveryModal open={Boolean(pinDelivery)} data={pinDelivery} onClose={() => setPinDelivery(null)} />
    </div>
  );
}
