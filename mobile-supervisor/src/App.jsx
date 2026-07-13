import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Bell,
  UserCheck,
  MapPin,
  LogOut,
  RotateCw,
  Sun,
  Moon,
  Plus,
  Navigation,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import SplashScreen from './components/SplashScreen';
import PinLogin from './components/PinLogin';
import ChangePin from './components/ChangePin';
import { useTheme } from './hooks/useTheme';
import { getAuthSession, setAuthSession, clearAuthSession, personInitials } from './utils/auth';
import { DEFAULT_API_URL, DEFAULT_TENANT_ID, STATE_POLL_MS, APP_VERSION } from './config';
import { postSupervisorAction, fetchSupervisorState, getLocation } from './utils/api';

export default function App() {
  const apiBase = DEFAULT_API_URL.replace(/\/$/, '');
  const tenantId = DEFAULT_TENANT_ID;
  const authSession = getAuthSession();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!authSession);
  const [mustChangePin, setMustChangePin] = useState(false);
  const [loginPinUsed, setLoginPinUsed] = useState('');
  const [pendingSupervisor, setPendingSupervisor] = useState(null);
  const [loggedInSupervisor, setLoggedInSupervisor] = useState(() => {
    try {
      const raw = sessionStorage.getItem('titan_supervisor_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [supervisorId, setSupervisorId] = useState(authSession?.supervisorId || loggedInSupervisor?.id || '');
  const [toast, setToast] = useState(null);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [premiseForm, setPremiseForm] = useState({
    name: '', address: '', city: 'Harare', suburb: '', territoryId: '', ownerName: '', ownerContact: '', lat: '', lng: '',
  });
  const [placeForm, setPlaceForm] = useState({
    premiseId: '', name: '', type: 'Patrol Point', description: '', lat: '', lng: '', hasNfc: true, schedule: 'Every 2 hours',
  });

  const { theme, toggleTheme, isDark } = useTheme();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const exitTimer = setTimeout(() => setSplashExiting(true), 1800);
    const hideTimer = setTimeout(() => setSplashVisible(false), 2300);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const fetchState = async () => {
    if (!supervisorId) return;
    try {
      const data = await fetchSupervisorState(apiBase, tenantId, supervisorId);
      setState(data);
      const sup = data.supervisor || (data.supervisors?.[tenantId] || [])[0];
      if (sup) {
        setLoggedInSupervisor(sup);
        sessionStorage.setItem('titan_supervisor_profile', JSON.stringify(sup));
      }
    } catch (e) {
      showToast(e.message || 'Could not refresh data', 'error');
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !supervisorId) return;
    fetchState();
    const interval = setInterval(fetchState, STATE_POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, supervisorId]);

  const handleLogin = (supervisor, opts = {}) => {
    setSupervisorId(supervisor.id);
    setAuthSession(supervisor.id);
    setLoggedInSupervisor(supervisor);
    sessionStorage.setItem('titan_supervisor_profile', JSON.stringify(supervisor));
    if (opts.mustChangePin) {
      setPendingSupervisor(supervisor);
      setLoginPinUsed(opts.currentPin || '');
      setMustChangePin(true);
      setIsAuthenticated(false);
      return;
    }
    setIsAuthenticated(true);
    setMustChangePin(false);
    showToast(`Welcome, ${supervisor.fullName.split(' ')[0]}`);
  };

  const handlePinChanged = () => {
    setMustChangePin(false);
    setIsAuthenticated(true);
    setPendingSupervisor(null);
    showToast('PIN updated — you are signed in');
    fetchState();
  };

  const handleLogout = () => {
    clearAuthSession();
    setIsAuthenticated(false);
    setSupervisorId('');
    setLoggedInSupervisor(null);
    setState(null);
  };

  const captureGps = async (target) => {
    try {
      const { lat, lng } = await getLocation();
      if (target === 'premise') {
        setPremiseForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      } else {
        setPlaceForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      }
      showToast('GPS coordinates captured');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSavePremise = async (e) => {
    e.preventDefault();
    if (!premiseForm.name || !premiseForm.address || !premiseForm.territoryId) {
      showToast('Name, address and territory are required', 'error');
      return;
    }
    try {
      await postSupervisorAction(apiBase, supervisorId, {
        action: 'CREATE_PREMISE',
        tenantId,
        name: premiseForm.name,
        address: premiseForm.address,
        city: premiseForm.city,
        suburb: premiseForm.suburb,
        territoryId: premiseForm.territoryId,
        ownerName: premiseForm.ownerName,
        ownerContact: premiseForm.ownerContact,
        lat: parseFloat(premiseForm.lat) || 0,
        lng: parseFloat(premiseForm.lng) || 0,
      });
      showToast(`Premises registered: ${premiseForm.name}`);
      setPremiseForm({ name: '', address: '', city: 'Harare', suburb: '', territoryId: premiseForm.territoryId, ownerName: '', ownerContact: '', lat: '', lng: '' });
      fetchState();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    if (!placeForm.premiseId || !placeForm.name) {
      showToast('Select a premises and enter place name', 'error');
      return;
    }
    try {
      await postSupervisorAction(apiBase, supervisorId, {
        action: 'CREATE_PLACE',
        tenantId,
        premiseId: placeForm.premiseId,
        name: placeForm.name,
        type: placeForm.type,
        description: placeForm.description,
        lat: parseFloat(placeForm.lat) || undefined,
        lng: parseFloat(placeForm.lng) || undefined,
        hasNfc: placeForm.hasNfc,
        schedule: placeForm.schedule,
      });
      showToast(`Place added: ${placeForm.name}`);
      setPlaceForm((f) => ({ ...f, name: '', description: '', lat: '', lng: '' }));
      fetchState();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDismissAlert = async (alertId) => {
    try {
      await postSupervisorAction(apiBase, supervisorId, {
        action: 'DISMISS_GUARD_ALERT',
        tenantId,
        alertId,
      });
      showToast('Alert dismissed');
      fetchState();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleResolveSwap = async (swapId, decision) => {
    try {
      await postSupervisorAction(apiBase, supervisorId, {
        action: 'RESOLVE_SHIFT_SWAP',
        tenantId,
        swapId,
        decision,
      });
      showToast(decision === 'approve' ? 'Swap approved' : 'Swap rejected');
      fetchState();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleClearSos = async () => {
    try {
      await postSupervisorAction(apiBase, supervisorId, { action: 'CLEAR_SOS', tenantId });
      showToast('SOS alarm cleared');
      fetchState();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleUpdateIncident = async (incidentId, status) => {
    try {
      await postSupervisorAction(apiBase, supervisorId, {
        action: 'UPDATE_INCIDENT_STATUS',
        tenantId,
        incidentId,
        status,
      });
      showToast('Incident updated');
      fetchState();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const supervisor = loggedInSupervisor || state?.supervisor;
  const territories = state?.territories?.[tenantId] || [];
  const premises = state?.premises?.[tenantId] || [];
  const guards = state?.guards?.[tenantId] || [];
  const alerts = (state?.guardAlerts?.[tenantId] || []).filter((a) => a.status === 'Active');
  const swaps = (state?.shiftSwapRequests?.[tenantId] || []).filter((s) => s.status === 'Pending');
  const attendance = (state?.attendance?.[tenantId] || []).filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const activeSos = state?.activeSosAlerts?.[tenantId];
  const incidents = (state?.occurrenceBook || []).filter((i) => i.status !== 'Resolved').slice(0, 20);

  if (splashVisible) {
    return <SplashScreen exiting={splashExiting} title="Titan Supervisor" subtitle="Field operations" />;
  }

  if (!isAuthenticated && mustChangePin && (pendingSupervisor || supervisor)) {
    return (
      <ChangePin
        supervisor={pendingSupervisor || supervisor}
        tenantId={tenantId}
        apiBase={apiBase}
        currentPin={loginPinUsed}
        onComplete={handlePinChanged}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <PinLogin
        tenantId={tenantId}
        apiBase={apiBase}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="phone-container">
      {toast && <div className={`mob-toast mob-toast-${toast.type}`}>{toast.message}</div>}

      <header className="mob-header">
        <div className="mob-header-brand">
          <img src="/emblem-dark.jpg" alt="" className="mob-header-emblem" />
          <div>
            <div className="mob-header-title">Titan Supervisor</div>
            <div className="mob-header-sub">v{APP_VERSION} · {supervisor?.role || 'Supervisor'}</div>
          </div>
        </div>
        <div className="mob-header-actions">
          <button type="button" className="mob-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            className={`mob-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={async () => { setRefreshing(true); await fetchState(); setTimeout(() => setRefreshing(false), 400); }}
            aria-label="Refresh"
          >
            <RotateCw size={18} />
          </button>
        </div>
      </header>

      <div className="mob-guard-strip">
        <div className="mob-guard-row">
          <div className="mob-guard-identity">
            <div className="mob-avatar">{personInitials(supervisor?.fullName)}</div>
            <div>
              <div className="mob-guard-name">{supervisor?.fullName}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)' }}>
                {territories.length} territor{territories.length === 1 ? 'y' : 'ies'} · {premises.length} sites
              </div>
            </div>
          </div>
          <button type="button" className="mob-btn mob-btn-secondary mob-logout-btn" onClick={handleLogout}>
            <LogOut size={14} /> Out
          </button>
        </div>
      </div>

      <div className="mob-content">
        {activeTab === 'dashboard' && (
          <div className="mob-tab-panel">
            {activeSos && (
              <div className="mob-card" style={{ borderLeft: '4px solid var(--mob-danger)', marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--mob-danger)' }}><AlertTriangle size={14} /> SOS Active</strong>
                <p style={{ fontSize: '0.82rem', margin: '0.35rem 0' }}>{activeSos.guardName}: {activeSos.message}</p>
                <button type="button" className="mob-btn mob-btn-danger" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={handleClearSos}>Clear SOS</button>
              </div>
            )}
            <div className="mob-stat-row">
              <div className="mob-stat-chip highlight"><div className="value">{attendance.length}</div><div className="label">On Duty</div></div>
              <div className="mob-stat-chip"><div className="value">{guards.length}</div><div className="label">Guards</div></div>
              <div className="mob-stat-chip"><div className="value">{alerts.length}</div><div className="label">Alerts</div></div>
              <div className="mob-stat-chip"><div className="value">{swaps.length}</div><div className="label">Swaps</div></div>
            </div>
            <div className="mob-card">
              <div className="mob-card-label">Your Territories</div>
              {territories.map((t) => (
                <div key={t.id} className="mob-list-item">
                  <strong>{t.name}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>{t.city} · {(t.suburbs || []).length} suburbs</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sites' && (
          <div className="mob-tab-panel">
            <h3 className="mob-section-title"><Building2 size={16} /> Register Premises (GPS)</h3>
            <form onSubmit={handleSavePremise} className="mob-card elevated">
              <label className="mob-field-label">Site Name *</label>
              <input className="mob-input" value={premiseForm.name} onChange={(e) => setPremiseForm({ ...premiseForm, name: e.target.value })} required />
              <label className="mob-field-label">Address *</label>
              <input className="mob-input" value={premiseForm.address} onChange={(e) => setPremiseForm({ ...premiseForm, address: e.target.value })} required />
              <label className="mob-field-label">Territory *</label>
              <select className="mob-select" value={premiseForm.territoryId} onChange={(e) => setPremiseForm({ ...premiseForm, territoryId: e.target.value })} required>
                <option value="">Select territory</option>
                {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="mob-field-label">Suburb</label>
              <input className="mob-input" value={premiseForm.suburb} onChange={(e) => setPremiseForm({ ...premiseForm, suburb: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="mob-field-label">Latitude</label>
                  <input className="mob-input" value={premiseForm.lat} onChange={(e) => setPremiseForm({ ...premiseForm, lat: e.target.value })} />
                </div>
                <div>
                  <label className="mob-field-label">Longitude</label>
                  <input className="mob-input" value={premiseForm.lng} onChange={(e) => setPremiseForm({ ...premiseForm, lng: e.target.value })} />
                </div>
              </div>
              <button type="button" className="mob-btn mob-btn-secondary" style={{ marginBottom: '0.75rem' }} onClick={() => captureGps('premise')}>
                <Navigation size={14} /> Capture GPS Here
              </button>
              <button type="submit" className="mob-btn"><Plus size={14} /> Save Premises</button>
            </form>

            <h3 className="mob-section-title" style={{ marginTop: '1.25rem' }}><MapPin size={16} /> Add Important Place</h3>
            <form onSubmit={handleSavePlace} className="mob-card elevated">
              <label className="mob-field-label">Premises *</label>
              <select className="mob-select" value={placeForm.premiseId} onChange={(e) => setPlaceForm({ ...placeForm, premiseId: e.target.value })} required>
                <option value="">Select premises</option>
                {premises.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label className="mob-field-label">Place Name *</label>
              <input className="mob-input" value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} required />
              <label className="mob-field-label">Type</label>
              <select className="mob-select" value={placeForm.type} onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })}>
                <option>Patrol Point</option>
                <option>Gate</option>
                <option>Reception</option>
                <option>Perimeter</option>
                <option>Other</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="mob-field-label">Lat</label>
                  <input className="mob-input" value={placeForm.lat} onChange={(e) => setPlaceForm({ ...placeForm, lat: e.target.value })} />
                </div>
                <div>
                  <label className="mob-field-label">Lng</label>
                  <input className="mob-input" value={placeForm.lng} onChange={(e) => setPlaceForm({ ...placeForm, lng: e.target.value })} />
                </div>
              </div>
              <button type="button" className="mob-btn mob-btn-secondary" style={{ marginBottom: '0.75rem' }} onClick={() => captureGps('place')}>
                <Navigation size={14} /> Capture GPS Here
              </button>
              <button type="submit" className="mob-btn mob-btn-success"><Plus size={14} /> Add Place + NFC</button>
            </form>

            <div className="mob-card" style={{ marginTop: '1rem' }}>
              <div className="mob-card-label">Your Sites ({premises.length})</div>
              {premises.map((p) => (
                <div key={p.id} className="mob-list-item">
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>
                    {p.address}
                    {p.coordinates?.lat ? ` · GPS ${p.coordinates.lat.toFixed(5)}, ${p.coordinates.lng.toFixed(5)}` : ''}
                  </div>
                  <div style={{ fontSize: '0.68rem', marginTop: '0.25rem' }}>
                    {(state.places?.[p.id] || []).length} place(s)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'guards' && (
          <div className="mob-tab-panel">
            <h3 className="mob-section-title"><Users size={16} /> Guards in Your Areas</h3>
            {guards.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--mob-text-muted)' }}>No guards in your assigned territories yet.</p>
            ) : (
              guards.map((g) => (
                <div key={g.id} className="mob-card" style={{ marginBottom: '0.65rem', padding: '0.85rem' }}>
                  <strong>{g.fullName}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>{g.employeeNumber} · {g.phone}</div>
                  <div style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>{g.suburb}{g.city ? `, ${g.city}` : ''}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="mob-tab-panel">
            <h3 className="mob-section-title"><Bell size={16} /> Alerts & Incidents</h3>
            {alerts.map((a) => (
              <div key={a.id} className="mob-card" style={{ marginBottom: '0.5rem' }}>
                <strong>{a.type}</strong>
                <p style={{ fontSize: '0.78rem', margin: '0.25rem 0' }}>{a.message}</p>
                <button type="button" className="mob-btn mob-btn-secondary" style={{ fontSize: '0.72rem' }} onClick={() => handleDismissAlert(a.id)}>Dismiss</button>
              </div>
            ))}
            {swaps.map((s) => (
              <div key={s.id} className="mob-card" style={{ marginBottom: '0.5rem' }}>
                <strong>Shift Swap Request</strong>
                <p style={{ fontSize: '0.78rem' }}>{s.reason || 'No reason given'}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <button type="button" className="mob-btn" style={{ fontSize: '0.72rem' }} onClick={() => handleResolveSwap(s.id, 'approve')}>Approve</button>
                  <button type="button" className="mob-btn mob-btn-secondary" style={{ fontSize: '0.72rem' }} onClick={() => handleResolveSwap(s.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
            {incidents.map((i) => (
              <div key={i.id} className="mob-card" style={{ marginBottom: '0.5rem' }}>
                <strong>{i.type}</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--mob-text-muted)' }}>{i.guardName} · {new Date(i.timestamp).toLocaleString()}</p>
                <p style={{ fontSize: '0.78rem' }}>{i.description}</p>
                <select className="mob-select" value={i.status} onChange={(e) => handleUpdateIncident(i.id, e.target.value)} style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
                  <option>Unassigned</option>
                  <option>Investigating</option>
                  <option>Resolved</option>
                </select>
              </div>
            ))}
            {!alerts.length && !swaps.length && !incidents.length && (
              <p style={{ color: 'var(--mob-text-muted)', fontSize: '0.85rem' }}>No active alerts in your areas.</p>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="mob-tab-panel">
            <div className="mob-card mob-profile-hero">
              <div className="mob-profile-hero-row">
                <div className="mob-avatar mob-avatar-lg">{personInitials(supervisor?.fullName)}</div>
                <div>
                  <strong>{supervisor?.fullName}</strong>
                  <div className="sub">{supervisor?.employeeNumber} · {supervisor?.role}</div>
                </div>
              </div>
            </div>
            <div className="mob-card">
              <div className="mob-profile-detail"><span>{supervisor?.phone}</span></div>
              <div className="mob-profile-detail"><span>{supervisor?.email}</span></div>
            </div>
            <button type="button" className="mob-btn mob-btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>

      <nav className="mob-nav">
        <button className={`mob-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={18} /><span>Home</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'sites' ? 'active' : ''}`} onClick={() => setActiveTab('sites')}>
          <Building2 size={18} /><span>Sites</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'guards' ? 'active' : ''}`} onClick={() => setActiveTab('guards')}>
          <Users size={18} /><span>Guards</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
          <span className="mob-nav-icon-wrap">
            <Bell size={18} />
            {(alerts.length + swaps.length) > 0 && <span className="mob-nav-badge">{alerts.length + swaps.length}</span>}
          </span>
          <span>Alerts</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <UserCheck size={18} /><span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
