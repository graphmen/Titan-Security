import React, { useState } from 'react';
import {
  Users, Calendar, Clock, Bell, TrendingUp, ArrowLeftRight, MessageCircle, Plus, Send, KeyRound,
} from 'lucide-react';
import { premiseName, guardName, scoreColor, todayStr } from '../utils/formatters';

const GRADES = ['A', 'B', 'C', 'D'];
const TEAM_TABS = [
  { id: 'profiles', label: 'Guards', icon: Users },
  { id: 'shifts', label: 'Roster', icon: Calendar },
  { id: 'attendance', label: 'On Duty', icon: Clock },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'performance', label: 'Score', icon: TrendingUp },
  { id: 'swaps', label: 'Swaps', icon: ArrowLeftRight },
  { id: 'messaging', label: 'Message', icon: MessageCircle },
];

const emptyGuard = () => ({
  fullName: '', employeeNumber: '', idNumber: '', phone: '', email: '',
  licenseNumber: '', licenseExpiry: '', grade: 'B', territoryId: '', assignedPremiseIds: [],
});

export default function TeamPanel({
  guards,
  shifts,
  attendance,
  alerts,
  swaps,
  incidents,
  premises,
  territories,
  supervisor,
  onAction,
  showToast,
}) {
  const [subTab, setSubTab] = useState('profiles');
  const [showGuardForm, setShowGuardForm] = useState(false);
  const [editingGuardId, setEditingGuardId] = useState(null);
  const [guardForm, setGuardForm] = useState(emptyGuard());
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    guardId: '', premiseId: '', date: todayStr(), startTime: '06:00', endTime: '18:00', shiftType: 'Day',
  });
  const [messageGuardId, setMessageGuardId] = useState('');
  const [messageText, setMessageText] = useState('');

  const formPremises = guardForm.territoryId
    ? premises.filter((p) => p.territoryId === guardForm.territoryId)
    : premises;

  const activeAlerts = alerts.filter((a) => a.status === 'Active');
  const pendingSwaps = swaps.filter((s) => s.status === 'Pending');
  const onDuty = attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');

  const resetGuardForm = () => {
    setGuardForm(emptyGuard());
    setEditingGuardId(null);
    setShowGuardForm(false);
  };

  const startEditGuard = (g) => {
    setEditingGuardId(g.id);
    setGuardForm({
      fullName: g.fullName,
      employeeNumber: g.employeeNumber || '',
      idNumber: g.idNumber || '',
      phone: g.phone || '',
      email: g.email || '',
      licenseNumber: g.licenseNumber || '',
      licenseExpiry: g.licenseExpiry || '',
      grade: g.grade || 'B',
      territoryId: g.territoryId || '',
      assignedPremiseIds: [...(g.assignedPremiseIds || [])],
    });
    setShowGuardForm(true);
    setSubTab('profiles');
  };

  const togglePremise = (pid) => {
    const ids = guardForm.assignedPremiseIds.includes(pid)
      ? guardForm.assignedPremiseIds.filter((x) => x !== pid)
      : [...guardForm.assignedPremiseIds, pid];
    setGuardForm({ ...guardForm, assignedPremiseIds: ids });
  };

  const handleSaveGuard = async (e) => {
    e.preventDefault();
    if (!guardForm.fullName || !guardForm.idNumber || !guardForm.phone || !guardForm.email) {
      showToast('Name, ID, phone and email are required', 'error');
      return;
    }
    try {
      if (editingGuardId) {
        await onAction('UPDATE_GUARD', { guardId: editingGuardId, updates: guardForm });
        showToast('Guard updated');
      } else {
        const result = await onAction('CREATE_GUARD', guardForm);
        if (result?.generatedPin) {
          showToast(`Guard saved — PIN: ${result.generatedPin}`);
        } else {
          showToast('Guard registered');
        }
      }
      resetGuardForm();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetPin = async (guardId) => {
    if (!window.confirm('Generate a new PIN for this guard?')) return;
    try {
      const result = await onAction('RESET_GUARD_PIN', { guardId });
      if (result?.generatedPin) showToast(`New PIN: ${result.generatedPin}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.guardId || !shiftForm.premiseId) {
      showToast('Select guard and site', 'error');
      return;
    }
    try {
      await onAction('CREATE_SHIFT', shiftForm);
      showToast('Shift scheduled');
      setShowShiftForm(false);
      setShiftForm({ guardId: '', premiseId: '', date: todayStr(), startTime: '06:00', endTime: '18:00', shiftType: 'Day' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageGuardId || !messageText.trim()) return;
    try {
      await onAction('SEND_GUARD_WHATSAPP', {
        guardId: messageGuardId,
        message: messageText.trim(),
        supervisorName: supervisor?.fullName || 'Supervisor',
      });
      showToast('Message queued — open WhatsApp to send');
      setMessageText('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="mob-tab-panel">
      <nav className="mob-sub-nav" aria-label="Team sections">
        {TEAM_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`mob-sub-nav-item ${subTab === id ? 'active' : ''}`}
            onClick={() => setSubTab(id)}
          >
            <Icon size={14} />
            {label}
            {id === 'alerts' && activeAlerts.length > 0 && <span className="mob-sub-badge">{activeAlerts.length}</span>}
            {id === 'swaps' && pendingSwaps.length > 0 && <span className="mob-sub-badge">{pendingSwaps.length}</span>}
          </button>
        ))}
      </nav>

      {subTab === 'profiles' && (
        <>
          <div className="mob-section-head">
            <h3 className="mob-section-title"><Users size={16} /> Guards ({guards.length})</h3>
            <button type="button" className="mob-btn mob-btn-sm" onClick={() => { resetGuardForm(); setShowGuardForm(true); }}>
              <Plus size={14} /> Register
            </button>
          </div>
          {showGuardForm && (
            <form onSubmit={handleSaveGuard} className="mob-card elevated">
              <label className="mob-field-label">Full Name *</label>
              <input className="mob-input" value={guardForm.fullName} onChange={(e) => setGuardForm({ ...guardForm, fullName: e.target.value })} required />
              <label className="mob-field-label">ID Number *</label>
              <input className="mob-input" value={guardForm.idNumber} onChange={(e) => setGuardForm({ ...guardForm, idNumber: e.target.value })} required />
              <label className="mob-field-label">Phone *</label>
              <input className="mob-input" value={guardForm.phone} onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })} required />
              <label className="mob-field-label">Email *</label>
              <input className="mob-input" type="email" value={guardForm.email} onChange={(e) => setGuardForm({ ...guardForm, email: e.target.value })} required />
              <label className="mob-field-label">Territory</label>
              <select className="mob-select" value={guardForm.territoryId} onChange={(e) => setGuardForm({ ...guardForm, territoryId: e.target.value, assignedPremiseIds: [] })}>
                <option value="">Select</option>
                {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="mob-field-label">Grade</label>
              <select className="mob-select" value={guardForm.grade} onChange={(e) => setGuardForm({ ...guardForm, grade: e.target.value })}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
              <label className="mob-field-label">PSIRA / License</label>
              <input className="mob-input" value={guardForm.licenseNumber} onChange={(e) => setGuardForm({ ...guardForm, licenseNumber: e.target.value })} />
              <label className="mob-field-label">License Expiry</label>
              <input className="mob-input" type="date" value={guardForm.licenseExpiry} onChange={(e) => setGuardForm({ ...guardForm, licenseExpiry: e.target.value })} />
              {formPremises.length > 0 && (
                <div className="mob-chip-group">
                  {formPremises.map((p) => (
                    <label key={p.id} className={`mob-chip ${guardForm.assignedPremiseIds.includes(p.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={guardForm.assignedPremiseIds.includes(p.id)} onChange={() => togglePremise(p.id)} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
              <div className="mob-form-actions">
                <button type="button" className="mob-btn mob-btn-secondary" onClick={resetGuardForm}>Cancel</button>
                <button type="submit" className="mob-btn">{editingGuardId ? 'Update' : 'Save Guard'}</button>
              </div>
            </form>
          )}
          {guards.length === 0 ? (
            <p className="mob-empty">No guards in your areas yet.</p>
          ) : (
            guards.map((g) => (
              <div key={g.id} className="mob-card mob-card-compact">
                <div className="mob-card-row">
                  <div>
                    <strong>{g.fullName}</strong>
                    <div className="mob-list-meta">{g.employeeNumber} · Grade {g.grade}</div>
                    <div className="mob-list-meta">{g.phone}</div>
                    {(g.assignedPremiseIds || []).length > 0 && (
                      <div className="mob-list-meta">Sites: {g.assignedPremiseIds.map((id) => premiseName(premises, id)).join(', ')}</div>
                    )}
                  </div>
                  <div className="mob-inline-actions vertical">
                    <button type="button" className="mob-icon-btn" onClick={() => startEditGuard(g)} title="Edit">Edit</button>
                    <button type="button" className="mob-icon-btn" onClick={() => handleResetPin(g.id)} title="Reset PIN"><KeyRound size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {subTab === 'shifts' && (
        <>
          <div className="mob-section-head">
            <h3 className="mob-section-title"><Calendar size={16} /> Shift Roster</h3>
            <button type="button" className="mob-btn mob-btn-sm" onClick={() => setShowShiftForm(!showShiftForm)}>
              <Plus size={14} /> Schedule
            </button>
          </div>
          {showShiftForm && (
            <form onSubmit={handleSaveShift} className="mob-card elevated">
              <label className="mob-field-label">Guard *</label>
              <select className="mob-select" value={shiftForm.guardId} onChange={(e) => setShiftForm({ ...shiftForm, guardId: e.target.value })} required>
                <option value="">Select guard</option>
                {guards.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
              </select>
              <label className="mob-field-label">Site *</label>
              <select className="mob-select" value={shiftForm.premiseId} onChange={(e) => setShiftForm({ ...shiftForm, premiseId: e.target.value })} required>
                <option value="">Select site</option>
                {premises.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label className="mob-field-label">Date</label>
              <input className="mob-input" type="date" value={shiftForm.date} onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })} />
              <div className="mob-coord-row">
                <div><label className="mob-field-label">Start</label><input className="mob-input" type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} /></div>
                <div><label className="mob-field-label">End</label><input className="mob-input" type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} /></div>
              </div>
              <label className="mob-field-label">Shift Type</label>
              <select className="mob-select" value={shiftForm.shiftType} onChange={(e) => setShiftForm({ ...shiftForm, shiftType: e.target.value })}>
                <option>Day</option><option>Night</option><option>Split</option>
              </select>
              <button type="submit" className="mob-btn">Save Shift</button>
            </form>
          )}
          {shifts.length === 0 ? (
            <p className="mob-empty">No shifts scheduled.</p>
          ) : (
            shifts.slice().sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
              <div key={s.id} className="mob-card mob-card-compact">
                <strong>{guardName(guards, s.guardId)}</strong>
                <div className="mob-list-meta">{s.date} · {s.startTime}–{s.endTime} ({s.shiftType})</div>
                <div className="mob-list-meta">{premiseName(premises, s.premiseId)} · {s.status}</div>
              </div>
            ))
          )}
        </>
      )}

      {subTab === 'attendance' && (
        <>
          <h3 className="mob-section-title"><Clock size={16} /> Live Attendance ({onDuty.length})</h3>
          {onDuty.length === 0 ? (
            <p className="mob-empty">No guards on duty right now.</p>
          ) : (
            onDuty.map((a) => (
              <div key={a.id} className="mob-card mob-card-compact">
                <strong>{guardName(guards, a.guardId)}</strong>
                <div className="mob-list-meta">{premiseName(premises, a.premiseId)} · {a.status}</div>
                <div className="mob-list-meta">Clocked in {a.clockInTime ? new Date(a.clockInTime).toLocaleTimeString() : '—'}</div>
              </div>
            ))
          )}
        </>
      )}

      {subTab === 'alerts' && (
        <>
          <h3 className="mob-section-title"><Bell size={16} /> Supervisor Alerts</h3>
          {activeAlerts.length === 0 && incidents.length === 0 ? (
            <p className="mob-empty">No active alerts.</p>
          ) : (
            <>
              {activeAlerts.map((a) => (
                <div key={a.id} className="mob-card mob-card-compact">
                  <strong>{a.type}</strong>
                  <p className="mob-list-meta">{a.message}</p>
                  <button type="button" className="mob-btn mob-btn-secondary mob-btn-sm" onClick={() => onAction('DISMISS_GUARD_ALERT', { alertId: a.id }).then(() => showToast('Dismissed')).catch((e) => showToast(e.message, 'error'))}>
                    Dismiss
                  </button>
                </div>
              ))}
              {incidents.map((i) => (
                <div key={i.id} className="mob-card mob-card-compact">
                  <strong>{i.type}</strong>
                  <p className="mob-list-meta">{i.guardName} · {new Date(i.timestamp).toLocaleString()}</p>
                  <p style={{ fontSize: '0.78rem' }}>{i.description}</p>
                  <select className="mob-select" value={i.status} onChange={(e) => onAction('UPDATE_INCIDENT_STATUS', { incidentId: i.id, status: e.target.value }).then(() => showToast('Updated')).catch((err) => showToast(err.message, 'error'))}>
                    <option>Unassigned</option><option>Investigating</option><option>Resolved</option>
                  </select>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {subTab === 'performance' && (
        <>
          <h3 className="mob-section-title"><TrendingUp size={16} /> Performance</h3>
          {guards.length === 0 ? (
            <p className="mob-empty">No guard data yet.</p>
          ) : (
            guards.map((g) => {
              const ps = g.performanceScore || { composite: 0, punctuality: 0, patrolCompletion: 0, shiftReliability: 0 };
              return (
                <div key={g.id} className="mob-card mob-card-compact">
                  <div className="mob-card-row">
                    <strong>{g.fullName}</strong>
                    <span style={{ fontWeight: 700, color: scoreColor(ps.composite) }}>{ps.composite}%</span>
                  </div>
                  <div className="mob-perf-grid">
                    <span>Punctuality {ps.punctuality}%</span>
                    <span>Patrol {ps.patrolCompletion}%</span>
                    <span>Reliability {ps.shiftReliability}%</span>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {subTab === 'swaps' && (
        <>
          <h3 className="mob-section-title"><ArrowLeftRight size={16} /> Shift Swaps</h3>
          {pendingSwaps.length === 0 ? (
            <p className="mob-empty">No pending swap requests.</p>
          ) : (
            pendingSwaps.map((s) => (
              <div key={s.id} className="mob-card mob-card-compact">
                <strong>{guardName(guards, s.requestingGuardId || s.requesterGuardId)}</strong>
                <p className="mob-list-meta">{s.reason || 'No reason given'}</p>
                <div className="mob-form-actions">
                  <button type="button" className="mob-btn mob-btn-sm" onClick={() => onAction('RESOLVE_SHIFT_SWAP', { swapId: s.id, decision: 'approve' }).then(() => showToast('Approved')).catch((e) => showToast(e.message, 'error'))}>Approve</button>
                  <button type="button" className="mob-btn mob-btn-secondary mob-btn-sm" onClick={() => onAction('RESOLVE_SHIFT_SWAP', { swapId: s.id, decision: 'reject' }).then(() => showToast('Rejected')).catch((e) => showToast(e.message, 'error'))}>Reject</button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {subTab === 'messaging' && (
        <>
          <h3 className="mob-section-title"><MessageCircle size={16} /> WhatsApp Message</h3>
          <form onSubmit={handleSendMessage} className="mob-card elevated">
            <label className="mob-field-label">Guard *</label>
            <select className="mob-select" value={messageGuardId} onChange={(e) => setMessageGuardId(e.target.value)} required>
              <option value="">Select guard</option>
              {guards.filter((g) => g.status === 'Active').map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
            </select>
            <label className="mob-field-label">Message *</label>
            <textarea className="mob-input mob-textarea" rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} required placeholder="Shift update, instructions…" />
            <button type="submit" className="mob-btn"><Send size={14} /> Send via WhatsApp</button>
          </form>
        </>
      )}
    </div>
  );
}
