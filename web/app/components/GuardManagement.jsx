'use client';

import React, { useState } from 'react';
import {
  UserPlus,
  Users,
  Calendar,
  Clock,
  Shield,
  MapPin,
  Phone,
  BadgeCheck,
  AlertCircle,
  Plus,
  Bell,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  GraduationCap,
  Camera,
  X,
  Check,
  Pencil,
  Trash2,
  MessageCircle,
  Send,
  RotateCw,
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { buildGuardProfileContext } from '../../lib/guardProfile';
import { handleWhatsAppDeliveryResult } from '../../lib/whatsappClient';

const emptyGuardForm = () => ({
  fullName: '', employeeNumber: '', idNumber: '', phone: '', email: '',
  nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '',
  licenseNumber: '', licenseExpiry: '', grade: 'B', assignedPremiseIds: [],
  territoryId: '', city: '', suburb: '',
});

const GRADES = ['A', 'B', 'C'];
const STATUSES = ['Active', 'Suspended', 'Off Duty', 'Terminated'];
const DOC_TYPES = [
  { id: 'id_copy', label: 'National ID Copy' },
  { id: 'psira', label: 'PSIRA Certificate' },
  { id: 'medical', label: 'Medical Fitness' },
  { id: 'contract', label: 'Employment Contract' },
  { id: 'other', label: 'Other' },
];

export default function GuardManagement({
  tenantId,
  guards = [],
  premises = [],
  territories = [],
  supervisors = [],
  shifts = [],
  attendance = [],
  guardAlerts = [],
  shiftSwapRequests = [],
  whatsappOutbox = [],
  onRefresh,
}) {
  // buildGuardProfileContext needs full state shape — pass minimal synthetic state from props
  const synthState = {
    guards: { [tenantId]: guards },
    premises: { [tenantId]: premises },
    territories: { [tenantId]: territories },
    supervisors: { [tenantId]: supervisors },
    shifts: { [tenantId]: shifts },
  };
  const [tab, setTab] = useState('guards');
  const [saving, setSaving] = useState(false);
  const [showGuardForm, setShowGuardForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [expandedGuardId, setExpandedGuardId] = useState(null);
  const [editingGuardId, setEditingGuardId] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [messageGuardId, setMessageGuardId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messageSupervisor, setMessageSupervisor] = useState('');

  const [guardForm, setGuardForm] = useState(emptyGuardForm());

  const [shiftForm, setShiftForm] = useState({
    guardId: '', premiseId: '', date: new Date().toISOString().slice(0, 10),
    startTime: '06:00', endTime: '18:00', shiftType: 'Day',
  });

  const [docForm, setDocForm] = useState({ type: 'id_copy', label: '', fileName: '' });
  const [trainingForm, setTrainingForm] = useState({ name: '', completedDate: '', expiryDate: '', certificateRef: '' });

  const today = new Date().toISOString().slice(0, 10);
  const onDuty = attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const todayShifts = shifts.filter((s) => s.date === today);
  const activeAlerts = guardAlerts.filter((a) => a.status === 'Active');
  const pendingSwaps = shiftSwapRequests.filter((s) => s.status === 'Pending');
  const expiringLicenses = guards.filter((g) => {
    if (!g.licenseExpiry) return false;
    const days = (new Date(g.licenseExpiry) - new Date()) / 86400000;
    return days >= 0 && days <= 60;
  });

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

  const promptWhatsAppPinDelivery = (result, label = 'Guard PIN') => {
    handleWhatsAppDeliveryResult(result, { pinLabel: label });
  };

  const notifyWhatsAppResult = (result, label = 'Message') => {
    if (!result?.whatsapp && !result?.waLink) return;
    const wa = result.whatsapp;
    if (wa?.sent) {
      alert(`${label} sent via WhatsApp to ${wa.to || 'guard'}.`);
      return;
    }
    if (wa?.status === 'failed') {
      alert(`WhatsApp failed: ${wa.error || 'Unknown error'}`);
      if (wa.waLink || result.waLink) window.open(wa.waLink || result.waLink, '_blank', 'noopener,noreferrer');
      return;
    }
    const link = wa?.waLink || result.waLink;
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const guardName = (id) => guards.find((g) => g.id === id)?.fullName || id;
  const premiseName = (id) => premises.find((p) => p.id === id)?.name || id;
  const territoryName = (id) => territories.find((t) => t.id === id)?.name || '';
  const selectedTerritory = territories.find((t) => t.id === guardForm.territoryId);
  const suburbOptions = selectedTerritory?.suburbs || [];

  const resetGuardForm = () => {
    setGuardForm(emptyGuardForm());
    setEditingGuardId(null);
    setShowGuardForm(false);
  };

  const resetShiftForm = () => {
    setShiftForm({
      guardId: '', premiseId: '', date: today,
      startTime: '06:00', endTime: '18:00', shiftType: 'Day',
    });
    setEditingShiftId(null);
    setShowShiftForm(false);
  };

  const startEditGuard = (g) => {
    setEditingGuardId(g.id);
    setGuardForm({
      fullName: g.fullName,
      employeeNumber: g.employeeNumber || '',
      idNumber: g.idNumber,
      phone: g.phone,
      email: g.email || '',
      nextOfKinName: g.nextOfKin?.name || '',
      nextOfKinPhone: g.nextOfKin?.phone || '',
      nextOfKinRelationship: g.nextOfKin?.relationship || '',
      licenseNumber: g.licenseNumber || '',
      licenseExpiry: g.licenseExpiry || '',
      grade: g.grade || 'B',
      assignedPremiseIds: [...(g.assignedPremiseIds || [])],
      territoryId: g.territoryId || '',
      city: g.city || '',
      suburb: g.suburb || '',
    });
    setShowGuardForm(true);
    setTab('guards');
  };

  const startEditShift = (s) => {
    setEditingShiftId(s.id);
    setShiftForm({
      guardId: s.guardId,
      premiseId: s.premiseId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      shiftType: s.shiftType || 'Day',
    });
    setShowShiftForm(true);
  };

  const handleTerritoryChange = (territoryId) => {
    const t = territories.find((x) => x.id === territoryId);
    setGuardForm({
      ...guardForm,
      territoryId,
      city: t?.city || guardForm.city,
      suburb: t?.suburbs?.some((s) => s.name === guardForm.suburb) ? guardForm.suburb : '',
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    const ok = type === 'guard'
      ? await postAction('DELETE_GUARD', { guardId: id })
      : await postAction('DELETE_SHIFT', { shiftId: id });
    if (ok) setDeleteTarget(null);
  };

  const scoreColor = (score) => {
    if (score >= 85) return '#16a34a';
    if (score >= 70) return '#d97706';
    return '#dc2626';
  };

  const handleSaveGuard = async (e) => {
    e.preventDefault();
    const payload = {
      ...guardForm,
      nextOfKin: {
        name: guardForm.nextOfKinName,
        phone: guardForm.nextOfKinPhone,
        relationship: guardForm.nextOfKinRelationship,
      },
    };
    const result = editingGuardId
      ? await postAction('UPDATE_GUARD', {
          guardId: editingGuardId,
          updates: {
            fullName: guardForm.fullName,
            employeeNumber: guardForm.employeeNumber,
            idNumber: guardForm.idNumber,
            phone: guardForm.phone,
            email: guardForm.email,
            nextOfKin: payload.nextOfKin,
            licenseNumber: guardForm.licenseNumber,
            licenseExpiry: guardForm.licenseExpiry,
            grade: guardForm.grade,
            assignedPremiseIds: guardForm.assignedPremiseIds,
            territoryId: guardForm.territoryId || null,
            city: guardForm.city,
            suburb: guardForm.suburb,
          },
        })
      : await postAction('CREATE_GUARD', guardForm);
    if (result) {
      if (!editingGuardId) promptWhatsAppPinDelivery(result, 'New login PIN');
      resetGuardForm();
    }
  };

  const handleResetPin = async (guardId) => {
    if (!window.confirm('Generate a new 6-digit PIN and prepare WhatsApp delivery to this guard?')) return;
    const result = await postAction('RESET_GUARD_PIN', { guardId });
    if (result) promptWhatsAppPinDelivery(result, 'Reset PIN');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageGuardId || !messageText.trim()) return;
    const sup = supervisors.find((s) => s.id === messageSupervisor);
    const ok = await postAction('SEND_GUARD_WHATSAPP', {
      guardId: messageGuardId,
      message: messageText.trim(),
      supervisorName: sup?.fullName || 'Supervisor',
    });
    if (ok) notifyWhatsAppResult(ok, 'Supervisor message');
    if (ok) {
      setMessageText('');
      setMessageGuardId(null);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    const result = editingShiftId
      ? await postAction('UPDATE_SHIFT', { shiftId: editingShiftId, updates: shiftForm })
      : await postAction('CREATE_SHIFT', shiftForm);
    if (result) {
      notifyWhatsAppResult(result, 'Shift assignment');
      resetShiftForm();
    }
  };

  const updateGuardStatus = (guardId, status) => postAction('UPDATE_GUARD', { guardId, updates: { status } });
  const updateGuardPremises = (guardId, assignedPremiseIds) => postAction('UPDATE_GUARD', { guardId, updates: { assignedPremiseIds } });
  const togglePremiseAssign = (pid) => {
    const ids = guardForm.assignedPremiseIds.includes(pid)
      ? guardForm.assignedPremiseIds.filter((x) => x !== pid)
      : [...guardForm.assignedPremiseIds, pid];
    setGuardForm({ ...guardForm, assignedPremiseIds: ids });
  };

  const handlePhotoUpload = async (guardId, file) => {
    if (!file || file.size > 400000) {
      alert('Photo must be under 400KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await postAction('UPDATE_GUARD_PHOTO', { guardId, photoUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleAddDocument = async (guardId, e) => {
    e.preventDefault();
    const ok = await postAction('ADD_GUARD_DOCUMENT', { guardId, ...docForm });
    if (ok) setDocForm({ type: 'id_copy', label: '', fileName: '' });
  };

  const handleAddTraining = async (guardId, e) => {
    e.preventDefault();
    const ok = await postAction('ADD_GUARD_TRAINING', { guardId, ...trainingForm });
    if (ok) setTrainingForm({ name: '', completedDate: '', expiryDate: '', certificateRef: '' });
  };

  const alertBadge = (severity) => {
    if (severity === 'critical') return 'badge-red';
    if (severity === 'warning') return 'badge-yellow';
    return 'badge-blue';
  };

  const sortedByScore = [...guards].sort(
    (a, b) => (b.performanceScore?.composite || 0) - (a.performanceScore?.composite || 0)
  );

  return (
    <div>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.type === 'guard' ? 'Delete Guard?' : 'Delete Shift?'}
        message={deleteTarget?.message}
        itemLabel={deleteTarget?.label}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirming={saving}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Users size={22} style={{ color: 'var(--color-primary)' }} />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Guards</p>
            <h3 style={{ fontSize: '1.35rem' }}>{guards.length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Shield size={22} style={{ color: 'var(--color-success)' }} />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>On Duty Now</p>
            <h3 style={{ fontSize: '1.35rem' }}>{onDuty.length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Bell size={22} style={{ color: '#dc2626' }} />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Alerts</p>
            <h3 style={{ fontSize: '1.35rem' }}>{activeAlerts.length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ArrowLeftRight size={22} style={{ color: '#2563eb' }} />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Swap Requests</p>
            <h3 style={{ fontSize: '1.35rem' }}>{pendingSwaps.length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle size={22} style={{ color: '#d97706' }} />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Licenses Expiring</p>
            <h3 style={{ fontSize: '1.35rem' }}>{expiringLicenses.length}</h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { id: 'guards', label: 'Guard Profiles', icon: Users },
          { id: 'shifts', label: 'Shift Roster', icon: Calendar },
          { id: 'attendance', label: 'Live Attendance', icon: Clock },
          { id: 'alerts', label: 'Supervisor Alerts', icon: Bell },
          { id: 'performance', label: 'Performance', icon: TrendingUp },
          { id: 'swaps', label: 'Shift Swaps', icon: ArrowLeftRight },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => setTab(id)}
          >
            <Icon size={14} /> {label}
            {id === 'alerts' && activeAlerts.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '0 0.35rem', fontSize: '0.65rem' }}>{activeAlerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'guards' && (
        <div className="dashboard-grid">
          <div className="col-12">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>Guard Profiles</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Photos, documents, training records, premises assignment, and WhatsApp login PIN delivery.</p>
                </div>
                <button type="button" className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => { resetGuardForm(); setShowGuardForm(true); }}>
                  <UserPlus size={14} /> Register Guard
                </button>
              </div>

              {showGuardForm && (
                <form onSubmit={handleSaveGuard} style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Full Name *</label><input className="form-input" value={guardForm.fullName} onChange={(e) => setGuardForm({ ...guardForm, fullName: e.target.value })} required /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Employee No.</label><input className="form-input" value={guardForm.employeeNumber} onChange={(e) => setGuardForm({ ...guardForm, employeeNumber: e.target.value })} placeholder="Auto" /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Grade</label><select className="form-select" value={guardForm.grade} onChange={(e) => setGuardForm({ ...guardForm, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Territory</label><select className="form-select" value={guardForm.territoryId} onChange={(e) => handleTerritoryChange(e.target.value)}><option value="">Select territory</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>City</label><input className="form-input" value={guardForm.city} onChange={(e) => setGuardForm({ ...guardForm, city: e.target.value })} placeholder="e.g. Harare" /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Suburb</label><select className="form-select" value={guardForm.suburb} onChange={(e) => setGuardForm({ ...guardForm, suburb: e.target.value })}><option value="">Select suburb</option>{suburbOptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>ID Number *</label><input className="form-input" value={guardForm.idNumber} onChange={(e) => setGuardForm({ ...guardForm, idNumber: e.target.value })} required /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Phone (WhatsApp) *</label>
                    <input className="form-input" value={guardForm.phone} onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })} placeholder="+263 77 123 4567" required />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>6-digit login PIN is sent to this WhatsApp number on registration.</span>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Email</label><input className="form-input" type="email" value={guardForm.email} onChange={(e) => setGuardForm({ ...guardForm, email: e.target.value })} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>PSIRA / License No.</label><input className="form-input" value={guardForm.licenseNumber} onChange={(e) => setGuardForm({ ...guardForm, licenseNumber: e.target.value })} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>License Expiry</label><input className="form-input" type="date" value={guardForm.licenseExpiry} onChange={(e) => setGuardForm({ ...guardForm, licenseExpiry: e.target.value })} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Next of Kin — Name</label><input className="form-input" value={guardForm.nextOfKinName} onChange={(e) => setGuardForm({ ...guardForm, nextOfKinName: e.target.value })} placeholder="e.g. Grace Dube" /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Next of Kin — Phone</label>
                    <input className="form-input" value={guardForm.nextOfKinPhone} onChange={(e) => setGuardForm({ ...guardForm, nextOfKinPhone: e.target.value })} placeholder="+263 71 111 2233" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label>Next of Kin — Relationship</label><input className="form-input" value={guardForm.nextOfKinRelationship} onChange={(e) => setGuardForm({ ...guardForm, nextOfKinRelationship: e.target.value })} placeholder="e.g. Spouse, Parent, Sibling" /></div>
                  <div className="input-group" style={{ gridColumn: 'span 3', marginBottom: 0 }}>
                    <label>Assign to Premises</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {premises.map((p) => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', background: guardForm.assignedPremiseIds.includes(p.id) ? '#d8f3dc' : '#fff', border: '1px solid var(--border-light)', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={guardForm.assignedPremiseIds.includes(p.id)} onChange={() => togglePremiseAssign(p.id)} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button type="button" className="btn-secondary" onClick={resetGuardForm}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingGuardId ? 'Update Guard' : 'Save Guard'}</button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {guards.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No guards registered yet.</p>
                ) : guards.map((g) => {
                  const profile = buildGuardProfileContext(synthState, tenantId, g.id);
                  return (
                  <div key={g.id} className="glass-card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1rem', alignItems: 'start' }}>
                      <div style={{ position: 'relative' }}>
                        {g.photoUrl ? (
                          <img src={g.photoUrl} alt={g.fullName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d8f3dc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={24} style={{ color: 'var(--color-primary)' }} />
                          </div>
                        )}
                        <label style={{ position: 'absolute', bottom: -4, right: -4, background: '#fff', borderRadius: '50%', padding: 4, cursor: 'pointer', border: '1px solid var(--border-light)' }}>
                          <Camera size={12} />
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(g.id, e.target.files?.[0])} />
                        </label>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{g.fullName}</strong>
                          <span className="badge badge-blue">{g.grade}</span>
                          <code style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{g.employeeNumber}</code>
                          {g.performanceScore && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: scoreColor(g.performanceScore.composite) }}>
                              Score: {g.performanceScore.composite}%
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <span><Phone size={11} style={{ display: 'inline' }} /> {g.phone}</span>
                          {g.licenseNumber && <span><BadgeCheck size={11} style={{ display: 'inline' }} /> {g.licenseNumber} · exp {g.licenseExpiry || 'N/A'}</span>}
                          {(g.city || g.suburb) && <span><MapPin size={11} style={{ display: 'inline' }} /> {[g.suburb, g.city].filter(Boolean).join(', ')}{territoryName(g.territoryId) ? ` · ${territoryName(g.territoryId)}` : ''}</span>}
                          {g.nextOfKin?.name && (
                            <span>
                              <Phone size={11} style={{ display: 'inline' }} /> NOK: {g.nextOfKin.name}
                              {g.nextOfKin.phone ? ` · ${g.nextOfKin.phone}` : ''}
                              {g.nextOfKin.relationship ? ` (${g.nextOfKin.relationship})` : ''}
                            </span>
                          )}
                          <span><MapPin size={11} style={{ display: 'inline' }} /> Sites: {(g.assignedPremiseIds || []).map(premiseName).join(', ') || 'Unassigned'}</span>
                          <span><FileText size={11} style={{ display: 'inline' }} /> {(g.documents || []).length} docs</span>
                          <span><GraduationCap size={11} style={{ display: 'inline' }} /> {(g.trainings || []).length} trainings</span>
                        </div>
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {premises.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem', background: (g.assignedPremiseIds || []).includes(p.id) ? '#d8f3dc' : undefined }}
                              onClick={() => {
                                const ids = (g.assignedPremiseIds || []).includes(p.id)
                                  ? g.assignedPremiseIds.filter((x) => x !== p.id)
                                  : [...(g.assignedPremiseIds || []), p.id];
                                updateGuardPremises(g.id, ids);
                              }}
                            >
                              {p.name}
                            </button>
                          ))}
                          <button type="button" className="btn-secondary" style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }} onClick={() => setExpandedGuardId(expandedGuardId === g.id ? null : g.id)}>
                            {expandedGuardId === g.id ? 'Hide Details' : 'Documents & Training'}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                        <select className="form-select" value={g.status} onChange={(e) => updateGuardStatus(g.id, e.target.value)} style={{ width: '120px', fontSize: '0.75rem', height: 'fit-content' }}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn-secondary" style={{ padding: '0.35rem', fontSize: '0.65rem' }} onClick={() => handleResetPin(g.id)} title="Reset PIN & WhatsApp">
                            <RotateCw size={12} /> Reset PIN
                          </button>
                          <button type="button" className="btn-secondary" style={{ padding: '0.35rem', fontSize: '0.65rem' }} onClick={() => { setMessageGuardId(g.id); setTab('whatsapp'); }} title="Send WhatsApp">
                            <MessageCircle size={12} /> Message
                          </button>
                          <button type="button" className="btn-secondary" style={{ padding: '0.35rem' }} onClick={() => startEditGuard(g)} title="Edit"><Pencil size={14} /></button>
                          <button type="button" className="btn-danger" style={{ padding: '0.35rem' }} onClick={() => setDeleteTarget({ type: 'guard', id: g.id, label: g.fullName, message: 'This guard profile and linked assignments will be permanently removed.' })} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>

                    {expandedGuardId === g.id && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Assigned Premises & Territory</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                            {(profile?.assignedPremises || []).map((p) => (
                              <span key={p.id} className="badge badge-green" style={{ fontSize: '0.72rem' }}>{p.name} · {[p.suburb, p.city].filter(Boolean).join(', ')}</span>
                            ))}
                            {profile?.territory && <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>Territory: {profile.territory.name}</span>}
                          </div>
                          {(profile?.supervisors || []).length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Area Supervisors</p>
                              {profile.supervisors.map((s) => (
                                <div key={s.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.fullName} · {s.phone} · {s.role}</div>
                              ))}
                            </div>
                          )}
                          {g.nextOfKin?.name && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>Next of Kin (Emergency Contact)</p>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {g.nextOfKin.name}
                                {g.nextOfKin.relationship ? ` · ${g.nextOfKin.relationship}` : ''}
                                {g.nextOfKin.phone ? ` · ${g.nextOfKin.phone}` : ' · No phone recorded'}
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><FileText size={14} style={{ display: 'inline' }} /> Documents</h4>
                          {(g.documents || []).map((d) => (
                            <div key={d.id} style={{ fontSize: '0.75rem', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
                              <strong>{d.label}</strong> · {d.fileName} · {new Date(d.uploadedAt).toLocaleDateString()}
                            </div>
                          ))}
                          <form onSubmit={(e) => handleAddDocument(g.id, e)} style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                            <select className="form-select" value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })} style={{ fontSize: '0.75rem' }}>
                              {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <input className="form-input" placeholder="Label" value={docForm.label} onChange={(e) => setDocForm({ ...docForm, label: e.target.value })} style={{ fontSize: '0.75rem' }} />
                            <input className="form-input" placeholder="File name" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} required style={{ fontSize: '0.75rem' }} />
                            <button type="submit" className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.35rem' }} disabled={saving}>Add Document</button>
                          </form>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><GraduationCap size={14} style={{ display: 'inline' }} /> Training Records</h4>
                          {(g.trainings || []).map((t) => (
                            <div key={t.id} style={{ fontSize: '0.75rem', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
                              <strong>{t.name}</strong> · {t.completedDate}
                              {t.expiryDate && <span> · exp {t.expiryDate}</span>}
                            </div>
                          ))}
                          <form onSubmit={(e) => handleAddTraining(g.id, e)} style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                            <input className="form-input" placeholder="Training name" value={trainingForm.name} onChange={(e) => setTrainingForm({ ...trainingForm, name: e.target.value })} required style={{ fontSize: '0.75rem' }} />
                            <input className="form-input" type="date" value={trainingForm.completedDate} onChange={(e) => setTrainingForm({ ...trainingForm, completedDate: e.target.value })} required style={{ fontSize: '0.75rem' }} />
                            <input className="form-input" type="date" placeholder="Expiry" value={trainingForm.expiryDate} onChange={(e) => setTrainingForm({ ...trainingForm, expiryDate: e.target.value })} style={{ fontSize: '0.75rem' }} />
                            <button type="submit" className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.35rem' }} disabled={saving}>Add Training</button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                );})}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'shifts' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Shift Roster</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assign guards to premises and shift times.</p>
            </div>
            <button type="button" className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => { resetShiftForm(); setShowShiftForm(true); }}>
              <Plus size={14} /> Schedule Shift
            </button>
          </div>

          {showShiftForm && (
            <form onSubmit={handleSaveShift} style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Guard</label><select className="form-select" value={shiftForm.guardId} onChange={(e) => setShiftForm({ ...shiftForm, guardId: e.target.value })} required><option value="">Select guard</option>{guards.filter(g => g.status === 'Active').map(g => <option key={g.id} value={g.id}>{g.fullName}</option>)}</select></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Premises</label><select className="form-select" value={shiftForm.premiseId} onChange={(e) => setShiftForm({ ...shiftForm, premiseId: e.target.value })} required><option value="">Select premises</option>{premises.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Date</label><input className="form-input" type="date" value={shiftForm.date} onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })} required /></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Start</label><input className="form-input" type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} required /></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>End</label><input className="form-input" type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} required /></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Shift Type</label><select className="form-select" value={shiftForm.shiftType} onChange={(e) => setShiftForm({ ...shiftForm, shiftType: e.target.value })}><option>Day</option><option>Night</option><option>Custom</option></select></div>
              <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={resetShiftForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingShiftId ? 'Update Shift' : 'Save Shift'}</button>
              </div>
            </form>
          )}

          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>Guard</th>
                <th style={{ padding: '0.5rem' }}>Premises</th>
                <th style={{ padding: '0.5rem' }}>Time</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dimmed)' }}>No shifts scheduled</td></tr>
              ) : shifts.slice(0, 30).map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem' }}>{s.date}</td>
                  <td style={{ padding: '0.5rem' }}>{guardName(s.guardId)}</td>
                  <td style={{ padding: '0.5rem' }}>{premiseName(s.premiseId)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.startTime} – {s.endTime} ({s.shiftType})</td>
                  <td style={{ padding: '0.5rem' }}><span className={`badge ${s.status === 'Active' ? 'badge-green' : s.status === 'Completed' ? 'badge-blue' : ''}`}>{s.status}</span></td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.4rem' }} onClick={() => startEditShift(s)}><Pencil size={12} /></button>
                      <button type="button" className="btn-danger" style={{ padding: '0.25rem 0.4rem' }} onClick={() => setDeleteTarget({ type: 'shift', id: s.id, label: `${guardName(s.guardId)} · ${s.date}`, message: 'This shift will be permanently removed from the roster.' })}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Live Attendance</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            GPS clock-in/out with geofence validation. Movement and geofence alerts appear in Supervisor Alerts.
          </p>
          {onDuty.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No guards currently on duty.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {onDuty.map((a) => (
                <div key={a.id} className="glass-card" style={{ padding: '1rem', borderLeft: `3px solid ${a.needsMovementAck ? '#d97706' : a.geofenceViolation ? '#dc2626' : 'var(--color-success)'}` }}>
                  <strong>{guardName(a.guardId)}</strong>
                  {a.needsMovementAck && <span className="badge badge-yellow" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Awaiting OK</span>}
                  {a.geofenceViolation && <span className="badge badge-red" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Geofence</span>}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    <MapPin size={11} style={{ display: 'inline' }} /> {premiseName(a.premiseId)}<br />
                    <Clock size={11} style={{ display: 'inline' }} /> Clocked in {new Date(a.clockIn).toLocaleTimeString()}
                    {a.lateMinutes > 5 && <span style={{ color: '#d97706' }}> · {a.lateMinutes} min late</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Recent History</h4>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {attendance.filter(a => a.status === 'Clocked Out').slice(0, 10).map((a) => (
              <div key={a.id} style={{ fontSize: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <span>{guardName(a.guardId)} @ {premiseName(a.premiseId)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(a.clockIn).toLocaleDateString()} · {new Date(a.clockIn).toLocaleTimeString()} – {a.clockOut ? new Date(a.clockOut).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Supervisor Alerts</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No-movement (45 min), geofence exit, license expiry, and shift swap notifications.
          </p>
          {guardAlerts.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No alerts recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {guardAlerts.slice(0, 50).map((a) => (
                <div key={a.id} className="glass-card" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: a.status === 'Active' ? 1 : 0.6 }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span className={`badge ${alertBadge(a.severity)}`}>{a.type.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString()}</span>
                      {a.status !== 'Active' && <span className="badge badge-blue">{a.status}</span>}
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>{a.message}</p>
                  </div>
                  {a.status === 'Active' && (
                    <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }} onClick={() => postAction('DISMISS_GUARD_ALERT', { alertId: a.id })}>
                      <X size={12} /> Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Performance Scorecards</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Composite score from punctuality, patrol completion, shift reliability, minus critical alert penalties.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {sortedByScore.map((g) => {
              const s = g.performanceScore || { composite: 0, punctuality: 0, patrolCompletion: 0, shiftReliability: 0, criticalAlerts: 0 };
              return (
                <div key={g.id} className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
                  {g.photoUrl ? (
                    <img src={g.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem' }} />
                  ) : (
                    <Users size={32} style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }} />
                  )}
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>{g.fullName}</strong>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(s.composite), margin: '0.5rem 0' }}>{s.composite}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'grid', gap: '0.2rem' }}>
                    <span>Punctuality: {s.punctuality}%</span>
                    <span>Patrol: {s.patrolCompletion}%</span>
                    <span>Shifts: {s.shiftReliability}%</span>
                    {s.criticalAlerts > 0 && <span style={{ color: '#dc2626' }}>Critical alerts: {s.criticalAlerts}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'swaps' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Shift Swap Requests</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Guards request swaps from the mobile app. Approve to reassign the shift.
          </p>
          {shiftSwapRequests.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No swap requests yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {shiftSwapRequests.map((sw) => {
                const shift = shifts.find((s) => s.id === sw.shiftId);
                return (
                  <div key={sw.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{guardName(sw.requestingGuardId)}</strong>
                      {sw.targetGuardId && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> → {guardName(sw.targetGuardId)}</span>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {shift ? `${shift.date} · ${shift.startTime}–${shift.endTime} @ ${premiseName(shift.premiseId)}` : 'Shift details unavailable'}
                        {sw.reason && <span> · "{sw.reason}"</span>}
                      </div>
                      <span className={`badge ${sw.status === 'Pending' ? 'badge-yellow' : sw.status === 'Approved' ? 'badge-green' : 'badge-red'}`} style={{ marginTop: '0.35rem' }}>{sw.status}</span>
                    </div>
                    {sw.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn-primary" style={{ fontSize: '0.75rem' }} onClick={() => postAction('RESOLVE_SHIFT_SWAP', { swapId: sw.id, decision: 'approve' })}>
                          <Check size={12} /> Approve
                        </button>
                        <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => postAction('RESOLVE_SHIFT_SWAP', { swapId: sw.id, decision: 'reject' })}>
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="dashboard-grid">
          <div className="col-5">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>Supervisor Message</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Send a direct WhatsApp message to a guard from their supervisor.
              </p>
              <form onSubmit={handleSendMessage} style={{ display: 'grid', gap: '0.65rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Guard</label>
                  <select className="form-select" value={messageGuardId || ''} onChange={(e) => setMessageGuardId(e.target.value)} required>
                    <option value="">Select guard</option>
                    {guards.filter((g) => g.status === 'Active').map((g) => (
                      <option key={g.id} value={g.id}>{g.fullName} · {g.phone}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>From Supervisor</label>
                  <select className="form-select" value={messageSupervisor} onChange={(e) => setMessageSupervisor(e.target.value)}>
                    <option value="">Supervisor name (optional)</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Message</label>
                  <textarea className="form-input" rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Report to main gate by 18:00…" required style={{ resize: 'vertical' }} />
                </div>
                <button type="submit" className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
                  <Send size={14} /> Send via WhatsApp
                </button>
              </form>
            </div>
          </div>
          <div className="col-7">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.78rem', lineHeight: 1.5 }}>
                <strong>WhatsApp delivery</strong>
                <p style={{ margin: '0.35rem 0 0' }}>
                  With <strong>Meta WhatsApp Cloud API</strong> keys in <code>web/.env.local</code>, PINs and shift messages send automatically when you register guards or schedule shifts. Without keys, WhatsApp opens with the message ready — tap Send to deliver.
                </p>
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>WhatsApp Outbox</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                PIN welcomes, shift assignments, and supervisor messages. Status updates after each send attempt.
              </p>
              {whatsappOutbox.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem' }}>No messages queued yet.</p>
              ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {whatsappOutbox.slice(0, 40).map((m) => (
                    <div key={m.id} className="glass-card" style={{ padding: '0.75rem 1rem', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <strong>{m.type.replace(/_/g, ' ')}</strong>
                        <span className={`badge ${m.status === 'sent' ? 'badge-green' : m.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>{m.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{m.to} · {new Date(m.createdAt).toLocaleString()}</div>
                      {m.note && <div style={{ fontSize: '0.68rem', color: '#b45309', marginBottom: '0.35rem' }}>{m.note}</div>}
                      <pre style={{ whiteSpace: 'pre-wrap', margin: '0 0 0.5rem', fontFamily: 'inherit', fontSize: '0.72rem', lineHeight: 1.45 }}>{m.body}</pre>
                      {m.waLink && (
                        <a href={m.waLink} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}>
                          <MessageCircle size={13} /> Open in WhatsApp
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
