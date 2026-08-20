'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Clock,
  Database,
  Home,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  Play,
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
import DatabaseExplorer from '../components/DatabaseExplorer';
import MapErrorBoundary from '../components/MapErrorBoundary';
import { mergeSystemSettings } from '../../lib/systemSettings';
import { apiFetch } from '../../lib/apiClient';
import { tenantRows } from '../../lib/safeData';

const PremisesMapPanel = dynamic(() => import('../components/PremisesMapPanel'), {
  ssr: false,
  loading: () => (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading map…
    </div>
  ),
});

const SUPERVISOR_EDITABLE_TABLES = [
  'premises',
  'places',
  'guards',
  'shifts',
  'guard_alerts',
  'occurrence_book',
];

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

  const tenantId = state.activeTenantId || 'titan';
  const curCheckpoints = tenantRows(state.checkpoints, tenantId);
  const curOB = (state.occurrenceBook || []).filter((item) => item.tenantId === tenantId);
  const curVisitors = (state.visitors || []).filter((item) => item.tenantId === tenantId);
  const curPremises = tenantRows(state.premises, tenantId);
  const curPlaces = state.places || {};
  const curGuards = tenantRows(state.guards, tenantId);
  const curShifts = tenantRows(state.shifts, tenantId);
  const curAttendance = tenantRows(state.attendance, tenantId);
  const curGuardAlerts = tenantRows(state.guardAlerts, tenantId);
  const curShiftSwaps = tenantRows(state.shiftSwapRequests, tenantId);
  const curTerritories = tenantRows(state.territories, tenantId);
  const curSupervisors = tenantRows(state.supervisors, tenantId);
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

  const pageTitle =
    activeTab === 'command'
      ? 'Command Centre'
      : activeTab === 'guards'
      ? 'Guard Management'
      : activeTab === 'premises'
      ? 'Register Premises'
      : activeTab === 'map'
      ? 'GIS Operations Map'
      : 'Data Explorer';

  const pageSubtitle =
    activeTab === 'command'
      ? 'Real-time monitoring for guards and sites in your assigned territories.'
      : activeTab === 'guards'
      ? 'Manage guards within your territory scope only.'
      : activeTab === 'premises'
      ? 'Register and maintain premises in your assigned territories.'
      : activeTab === 'map'
      ? 'Live map of premises, patrol points, geofences, and on-duty guard GPS in your territories.'
      : 'Browse and export records for guards, premises, shifts, and operations in your scope.';

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
            <button className={`sidebar-nav-item ${activeTab === 'premises' ? 'active' : ''}`} onClick={() => selectTab('premises')}>
              <Home size={18} /> Register Premises
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'guards' ? 'active' : ''}`} onClick={() => selectTab('guards')}>
              <UserCog size={18} /> Guard Management
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => selectTab('map')}>
              <MapPinned size={18} /> GIS Operations Map
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'command' ? 'active' : ''}`} onClick={() => selectTab('command')}>
              <Activity size={18} /> Command Centre
            </button>
          </li>
          <li>
            <button className={`sidebar-nav-item ${activeTab === 'data' ? 'active' : ''}`} onClick={() => selectTab('data')}>
              <Database size={18} /> Data Explorer
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
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">{pageSubtitle}</p>
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
        ) : activeTab === 'map' ? (
          <div className="animate-fade-in">
            <MapErrorBoundary minHeight={640}>
              <PremisesMapPanel
                showSidebar
                premises={curPremises}
                places={curPlaces}
                guards={curGuards}
                attendance={curAttendance}
                checkpoints={curCheckpoints}
                guardAlerts={curGuardAlerts}
                occurrenceBook={curOB}
                activeSos={activeSos}
                territories={curTerritories}
                shifts={curShifts}
                geofenceRadiusMeters={systemSettings.geofenceRadiusMeters}
                height={640}
              />
            </MapErrorBoundary>
          </div>
        ) : activeTab === 'data' ? (
          <DatabaseExplorer
            state={state}
            tenantId={tenantId}
            dataSource={state.dataSource}
            onRefresh={fetchState}
            refreshing={loading}
            editableTableIds={SUPERVISOR_EDITABLE_TABLES}
          />
        ) : (
          <div className="dashboard-grid">
            <div className="col-12 stat-cards-row">
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#d8f3dc', padding: '0.65rem', borderRadius: '8px' }}>
                  <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Compliance Rate</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{complianceRate}%</h3>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#d1fae5', padding: '0.65rem', borderRadius: '8px' }}>
                  <MapPin size={20} style={{ color: 'var(--color-success)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Taps Scanned</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{scannedCps} / {curCheckpoints.length}</h3>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#fef3c7', padding: '0.65rem', borderRadius: '8px' }}>
                  <Users size={20} style={{ color: 'var(--color-warning)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Guests</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{curVisitors.filter((v) => v.status === 'Active').length}</h3>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#dbeafe', padding: '0.65rem', borderRadius: '8px' }}>
                  <Users size={20} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Guards On Duty</p>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{guardsOnDuty.length}</h3>
                </div>
              </div>
            </div>

            {criticalGuardAlerts.length > 0 && (
              <div className="col-12" style={{ marginBottom: '0.5rem' }}>
                <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={14} /> Guard Alerts ({criticalGuardAlerts.length})
                  </div>
                  {criticalGuardAlerts.slice(0, 5).map((a) => (
                    <div key={a.id} style={{ fontSize: '0.75rem', color: '#7f1d1d', marginBottom: '0.25rem' }}>{a.message}</div>
                  ))}
                </div>
              </div>
            )}

            {guardsOnDuty.length > 0 && (
              <div className="col-12" style={{ marginBottom: '0.5rem' }}>
                <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Live on duty:</span>
                  {guardsOnDuty.map((a) => {
                    const g = curGuards.find((x) => x.id === a.guardId);
                    const p = curPremises.find((x) => x.id === a.premiseId);
                    return (
                      <span key={a.id} className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                        {g?.fullName || 'Guard'} @ {p?.name || 'Site'} · since {new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel canvas-map-card" style={{ flex: 1, padding: '1rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>Live Guard Geofence Tracker</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Premises, patrol points, geofences, and on-duty guard GPS in your territories</p>
                </div>
                <MapErrorBoundary minHeight={480}>
                  <PremisesMapPanel
                    compact
                    premises={curPremises}
                    places={curPlaces}
                    guards={curGuards}
                    attendance={curAttendance}
                    checkpoints={curCheckpoints}
                    guardAlerts={curGuardAlerts}
                    occurrenceBook={curOB}
                    activeSos={activeSos}
                    territories={curTerritories}
                    shifts={curShifts}
                    geofenceRadiusMeters={systemSettings.geofenceRadiusMeters}
                    height={480}
                  />
                </MapErrorBoundary>
              </div>
            </div>

            <div className="col-4" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
                  Occurrence Book (OB)
                </h3>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                  {curOB.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dimmed)' }}>
                      <BookOpen size={40} style={{ strokeWidth: 1.5, marginBottom: '0.75rem' }} />
                      <p style={{ fontSize: '0.85rem' }}>No activity in your territories yet.</p>
                    </div>
                  ) : (
                    curOB.map((item) => (
                      <div key={item.id} className="glass-card" style={{ padding: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <span className={`badge ${
                            item.type === 'SOS Panic Alarm' ? 'badge-red'
                            : item.type === 'Patrol Tap' ? 'badge-blue'
                            : 'badge-green'
                          }`}>
                            {item.type}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: '0.35rem 0', fontWeight: 500 }}>{item.description}</p>
                        {(item.attachments?.photo || item.attachments?.voice) && (
                          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0', padding: '0.35rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            {item.attachments.photo && (
                              <div style={{ width: '42px', height: '42px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                                <img src={item.attachments.photo} alt="Attached evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(item.attachments.photo)} />
                              </div>
                            )}
                            {item.attachments.voice && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem', borderRadius: '4px', height: '42px', gap: '0.2rem' }}
                                onClick={() => { const a = new Audio(item.attachments.voice); a.play(); }}
                              >
                                <Play size={10} /> Memo
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.guardName}</span>
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateIncidentStatus(item.id, e.target.value)}
                            style={{ padding: '0.15rem', fontSize: '0.7rem', background: '#ffffff', color: 'var(--text-main)', borderRadius: '4px', border: '1px solid var(--border-light)' }}
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

            <div className="col-12" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <UserPlus size={18} style={{ color: 'var(--color-primary)' }} />
                  Access Desk Registry
                </h3>
                <form onSubmit={handleAddVisitor} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <input className="form-input" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Visitor name" required />
                  <input className="form-input" value={vIdNumber} onChange={(e) => setVIdNumber(e.target.value)} placeholder="ID / Passport" required />
                  <input className="form-input" value={vCompany} onChange={(e) => setVCompany(e.target.value)} placeholder="Company" />
                  <input className="form-input" value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="Vehicle plate" />
                  <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>Check-in Visitor</button>
                </form>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <Users size={18} style={{ color: 'var(--color-success)' }} />
                  Live Visitor & Vehicle Log
                </h3>
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.4rem' }}>Visitor Details</th>
                        <th style={{ padding: '0.4rem' }}>Company</th>
                        <th style={{ padding: '0.4rem' }}>Plate</th>
                        <th style={{ padding: '0.4rem' }}>Check In</th>
                        <th style={{ padding: '0.4rem' }}>Status</th>
                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curVisitors.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dimmed)' }}>No guests signed in today.</td>
                        </tr>
                      ) : (
                        curVisitors.map((v) => (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', color: v.status === 'Checked Out' ? 'var(--text-dimmed)' : 'var(--text-main)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ fontWeight: '600' }}>{v.name}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-dimmed)' }}>{v.idNumber}</div>
                            </td>
                            <td style={{ padding: '0.5rem' }}>{v.company || 'N/A'}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>{v.vehiclePlate || '—'}</span>
                            </td>
                            <td style={{ padding: '0.5rem' }}>{new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <span className={`badge ${v.status === 'Active' ? 'badge-green' : 'badge-blue'}`}>{v.status}</span>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              {v.status === 'Active' ? (
                                <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px' }} onClick={() => handleCheckoutVisitor(v.id)}>
                                  Check Out
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)' }}>
                                  Out: {v.checkOutTime ? new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
