'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Clock,
  Home,
  LogOut,
  Menu,
  Radio,
  RefreshCw,
  Shield,
  UserCog,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import GuardManagement from '../components/GuardManagement';
import PremisesRegistration from '../components/PremisesRegistration';
import { mergeSystemSettings } from '../../lib/systemSettings';
import { apiFetch } from '../../lib/apiClient';

export default function SupervisorDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('command');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supervisorName, setSupervisorName] = useState('');
  const [vName, setVName] = useState('');
  const [vIdNumber, setVIdNumber] = useState('');
  const [vCompany, setVCompany] = useState('');
  const [vPlate, setVPlate] = useState('');
  const fetchInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);

  const fetchState = async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await apiFetch('/api/state?client=supervisor', { signal: AbortSignal.timeout(30000) });
      if (res.status === 401) {
        router.push('/supervisor/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load your territory data');
      const data = await res.json();
      setState(data);
      setSupervisorName(data.supervisor?.fullName || 'Supervisor');
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  const schedulePoll = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      await fetchState();
      schedulePoll();
    }, 10000);
  };

  useEffect(() => {
    fetchState();
    schedulePoll();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const postAction = async (body) => {
    const res = await apiFetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      router.push('/supervisor/login');
      return null;
    }
    return res;
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/supervisor/login');
      router.refresh();
    }
  };

  const handleUpdateIncidentStatus = async (incidentId, status) => {
    await postAction({ action: 'UPDATE_INCIDENT_STATUS', incidentId, status });
    fetchState();
  };

  const handleClearSos = async (tenantId) => {
    await postAction({ action: 'CLEAR_SOS', tenantId });
    fetchState();
  };

  const handleAddVisitor = async (e) => {
    e.preventDefault();
    if (!vName || !vIdNumber || !state) return;
    await postAction({
      action: 'REGISTER_VISITOR',
      tenantId: state.activeTenantId,
      name: vName,
      idNumber: vIdNumber,
      company: vCompany,
      vehiclePlate: vPlate,
    });
    setVName('');
    setVIdNumber('');
    setVCompany('');
    setVPlate('');
    fetchState();
  };

  const handleCheckoutVisitor = async (visitorId) => {
    await postAction({ action: 'CHECKOUT_VISITOR', visitorId });
    fetchState();
  };

  if (loading && !state) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
        <RefreshCw className="spin" size={36} style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Loading your supervisor workspace…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--color-danger)' }}>{error || 'Could not load dashboard'}</p>
      </div>
    );
  }

  const tenantId = state.activeTenantId;
  const curCheckpoints = state.checkpoints?.[tenantId] || [];
  const curOB = (state.occurrenceBook || []).filter((item) => item.tenantId === tenantId);
  const curVisitors = (state.visitors || []).filter((item) => item.tenantId === tenantId);
  const curPremises = state.premises?.[tenantId] || [];
  const curPlaces = state.places || {};
  const curGuards = state.guards?.[tenantId] || [];
  const curShifts = state.shifts?.[tenantId] || [];
  const curAttendance = state.attendance?.[tenantId] || [];
  const curGuardAlerts = state.guardAlerts?.[tenantId] || [];
  const curShiftSwaps = state.shiftSwapRequests?.[tenantId] || [];
  const curTerritories = state.territories?.[tenantId] || [];
  const curSupervisors = state.supervisors?.[tenantId] || [];
  const activeSos = state.activeSosAlerts?.[tenantId];
  const systemSettings = mergeSystemSettings(state.systemSettings);
  const guardsOnDuty = curAttendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const criticalGuardAlerts = curGuardAlerts.filter(
    (a) => a.status === 'Active' && (a.severity === 'critical' || a.severity === 'warning')
  );
  const scannedCps = curCheckpoints.filter((cp) => cp.status === 'Scanned').length;
  const complianceRate = curCheckpoints.length > 0 ? Math.round((scannedCps / curCheckpoints.length) * 100) : 100;

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar-wrapper ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/emblem-wordmark.png" alt="Titan Protection" />
        </div>
        <p className="supervisor-sidebar-user">{supervisorName}</p>
        <ul className="sidebar-nav-list">
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'command' ? 'active' : ''}`} onClick={() => selectTab('command')}>
              <Activity size={18} /> Command Centre
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'guards' ? 'active' : ''}`} onClick={() => selectTab('guards')}>
              <UserCog size={18} /> Guard Management
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'premises' ? 'active' : ''}`} onClick={() => selectTab('premises')}>
              <Home size={18} /> Register Premises
            </button>
          </li>
        </ul>
        <button type="button" className="btn-secondary supervisor-logout-btn" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      <div className="main-viewport">
        <div className="mobile-topbar">
          <button type="button" className="mobile-menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen((o) => !o)}>
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="mobile-topbar-title">
            <img src="/emblem-wordmark.png" alt="" className="mobile-topbar-logo" />
          </div>
          <span className={`mobile-status-dot ${state?.dataSource === 'supabase' ? 'live' : ''}`} />
        </div>

        <header className="page-header">
          <div className="page-header-main">
            <h1 className="page-title">
              {activeTab === 'command' ? 'Command Centre' : activeTab === 'guards' ? 'Guard Management' : 'Register Premises'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'command'
                ? 'Real-time monitoring for guards and sites in your assigned territories.'
                : activeTab === 'guards'
                ? 'Manage guards within your territory scope only.'
                : 'Register and maintain premises in your assigned territories.'}
            </p>
            <p className="page-meta">
              <strong>{systemSettings.companyName}</strong>
              {' · '}{curTerritories.length} territor{curTerritories.length === 1 ? 'y' : 'ies'}
              {' · '}{curGuards.length} guards · {curPremises.length} premises
            </p>
          </div>
          <div className="page-header-actions">
            <span className={`connection-badge ${state?.dataSource === 'supabase' ? 'live' : ''}`}>
              <Radio size={12} /> {state?.dataSource === 'supabase' ? 'Live' : 'Demo'}
            </span>
          </div>
        </header>

        {activeSos && (
          <div className="glass-panel" style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} style={{ color: 'var(--color-danger)' }} />
              <div>
                <h3 style={{ color: '#991b1b', fontSize: '0.95rem', fontWeight: 'bold' }}>CRITICAL DISTRESS SIGNAL</h3>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                  {activeSos.guardName} — {activeSos.message}
                </p>
              </div>
            </div>
            <button className="btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => handleClearSos(tenantId)}>
              Dismiss Alarm
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {activeTab === 'guards' ? (
          <GuardManagement
            tenantId={tenantId}
            guards={curGuards}
            premises={curPremises}
            territories={curTerritories}
            supervisors={curSupervisors}
            shifts={curShifts}
            attendance={curAttendance}
            guardAlerts={curGuardAlerts}
            shiftSwapRequests={curShiftSwaps}
            whatsappOutbox={state.whatsappOutbox?.[tenantId] || []}
            onRefresh={fetchState}
          />
        ) : activeTab === 'premises' ? (
          <PremisesRegistration
            tenantId={tenantId}
            premises={curPremises}
            places={curPlaces}
            territories={curTerritories}
            supervisors={curSupervisors}
            guards={curGuards}
            shifts={curShifts}
            attendance={curAttendance}
            checkpoints={curCheckpoints}
            onRefresh={fetchState}
          />
        ) : (
          <div className="dashboard-grid">
            <div className="col-12 stat-cards-row">
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#d8f3dc', padding: '0.65rem', borderRadius: '8px' }}>
                  <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Compliance</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{complianceRate}%</h3>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#dbeafe', padding: '0.65rem', borderRadius: '8px' }}>
                  <Users size={20} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>On Duty</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{guardsOnDuty.length}</h3>
                </div>
              </div>
            </div>

            {criticalGuardAlerts.length > 0 && (
              <div className="col-12">
                <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
                  {criticalGuardAlerts.slice(0, 5).map((a) => (
                    <div key={a.id} style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>{a.message}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="col-8">
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} /> Occurrence Book
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {curOB.length === 0 ? (
                    <p style={{ color: 'var(--text-dimmed)', fontSize: '0.85rem' }}>No activity in your territories yet.</p>
                  ) : (
                    curOB.map((item) => (
                      <div key={item.id} className="glass-card" style={{ padding: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span className="badge badge-blue">{item.type}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)' }}>
                            <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.825rem', marginBottom: '0.35rem' }}>{item.description}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                          <span>{item.guardName}</span>
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateIncidentStatus(item.id, e.target.value)}
                            style={{ padding: '0.15rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                          >
                            <option value="Unassigned">Unassigned</option>
                            <option value="Investigating">Investigating</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="col-4">
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} /> Visitor Check-in
                </h3>
                <form onSubmit={handleAddVisitor} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <input className="form-input" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Visitor name" required />
                  <input className="form-input" value={vIdNumber} onChange={(e) => setVIdNumber(e.target.value)} placeholder="ID / Passport" required />
                  <input className="form-input" value={vCompany} onChange={(e) => setVCompany(e.target.value)} placeholder="Company" />
                  <input className="form-input" value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="Vehicle plate" />
                  <button type="submit" className="btn-primary">Check-in</button>
                </form>
                <div style={{ marginTop: '1rem' }}>
                  {curVisitors.filter((v) => v.status === 'Active').slice(0, 5).map((v) => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      <span>{v.name}</span>
                      <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleCheckoutVisitor(v.id)}>
                        Out
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
