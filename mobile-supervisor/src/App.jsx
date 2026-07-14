import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  LogOut,
  RotateCw,
  Sun,
  Moon,
  AlertTriangle,
} from 'lucide-react';
import PinLogin from './components/PinLogin';
import ChangePin from './components/ChangePin';
import SitesPanel from './views/SitesPanel';
import TeamPanel from './views/TeamPanel';
import { useTheme } from './hooks/useTheme';
import { getAuthSession, setAuthSession, clearAuthSession, personInitials } from './utils/auth';
import { DEFAULT_API_URL, DEFAULT_TENANT_ID, STATE_POLL_MS, APP_VERSION } from './config';
import { postSupervisorAction, fetchSupervisorState } from './utils/api';

export default function App() {
  const apiBase = DEFAULT_API_URL.replace(/\/$/, '');
  const tenantId = DEFAULT_TENANT_ID;
  const authSession = getAuthSession();

  const [activeTab, setActiveTab] = useState('home');
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
  const [refreshing, setRefreshing] = useState(false);

  const { theme, toggleTheme, isDark } = useTheme();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

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

  const runAction = async (action, body = {}) => {
    const result = await postSupervisorAction(apiBase, supervisorId, { action, tenantId, ...body });
    await fetchState();
    return result;
  };

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
    showToast(`Signed in — ${supervisor.fullName.split(' ')[0]}`);
  };

  const handlePinChanged = () => {
    setMustChangePin(false);
    setIsAuthenticated(true);
    setPendingSupervisor(null);
    showToast('PIN updated');
    fetchState();
  };

  const handleLogout = () => {
    clearAuthSession();
    setIsAuthenticated(false);
    setSupervisorId('');
    setLoggedInSupervisor(null);
    setState(null);
  };

  const handleClearSos = async () => {
    try {
      await runAction('CLEAR_SOS');
      showToast('SOS cleared');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const supervisor = loggedInSupervisor || state?.supervisor;
  const territories = state?.territories?.[tenantId] || [];
  const premises = state?.premises?.[tenantId] || [];
  const guards = state?.guards?.[tenantId] || [];
  const shifts = state?.shifts?.[tenantId] || [];
  const attendance = state?.attendance?.[tenantId] || [];
  const alerts = state?.guardAlerts?.[tenantId] || [];
  const swaps = state?.shiftSwapRequests?.[tenantId] || [];
  const activeSos = state?.activeSosAlerts?.[tenantId];
  const incidents = (state?.occurrenceBook || []).filter((i) => i.status !== 'Resolved').slice(0, 20);
  const activeAlertCount = alerts.filter((a) => a.status === 'Active').length + swaps.filter((s) => s.status === 'Pending').length;

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

      <header className="mob-header mob-header-compact">
        <div className="mob-header-brand-text">
          <div className="mob-header-title">Titan Supervisor</div>
          <div className="mob-header-sub">v{APP_VERSION}</div>
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

      <div className="mob-guard-strip mob-guard-strip-compact">
        <div className="mob-guard-row">
          <div className="mob-guard-identity">
            <div className="mob-avatar">{personInitials(supervisor?.fullName)}</div>
            <div>
              <div className="mob-guard-name">{supervisor?.fullName}</div>
              <div className="mob-guard-meta">{territories.length} areas · {premises.length} sites · {guards.length} guards</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mob-content">
        {activeTab === 'home' && (
          <div className="mob-tab-panel">
            {activeSos && (
              <div className="mob-card mob-sos-card">
                <strong><AlertTriangle size={14} /> SOS — {activeSos.guardName}</strong>
                <p>{activeSos.message}</p>
                <button type="button" className="mob-btn mob-btn-danger mob-btn-sm" onClick={handleClearSos}>Clear SOS</button>
              </div>
            )}
            <div className="mob-stat-row">
              <div className="mob-stat-chip highlight"><div className="value">{attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late').length}</div><div className="label">On Duty</div></div>
              <div className="mob-stat-chip"><div className="value">{guards.length}</div><div className="label">Guards</div></div>
              <div className="mob-stat-chip"><div className="value">{activeAlertCount}</div><div className="label">Alerts</div></div>
              <div className="mob-stat-chip"><div className="value">{premises.length}</div><div className="label">Sites</div></div>
            </div>
            <div className="mob-card">
              <div className="mob-card-label">Your Territories</div>
              {territories.map((t) => (
                <div key={t.id} className="mob-list-item">
                  <strong>{t.name}</strong>
                  <div className="mob-list-meta">{t.city} · {(t.suburbs || []).length} suburbs</div>
                </div>
              ))}
            </div>
            <p className="mob-hint">Use <strong>Team</strong> for guards, shifts, attendance and alerts. Use <strong>Sites</strong> to register premises with GPS.</p>
          </div>
        )}

        {activeTab === 'sites' && (
          <SitesPanel
            territories={territories}
            premises={premises}
            places={state?.places || {}}
            onAction={runAction}
            showToast={showToast}
          />
        )}

        {activeTab === 'team' && (
          <TeamPanel
            guards={guards}
            shifts={shifts}
            attendance={attendance}
            alerts={alerts}
            swaps={swaps}
            incidents={incidents}
            premises={premises}
            territories={territories}
            supervisor={supervisor}
            onAction={runAction}
            showToast={showToast}
          />
        )}

        {activeTab === 'profile' && (
          <div className="mob-tab-panel">
            <div className="mob-card mob-profile-simple">
              <div className="mob-avatar mob-avatar-lg">{personInitials(supervisor?.fullName)}</div>
              <div>
                <strong>{supervisor?.fullName}</strong>
                <div className="mob-list-meta">{supervisor?.employeeNumber} · {supervisor?.role}</div>
                <div className="mob-list-meta">{supervisor?.phone}</div>
                <div className="mob-list-meta">{supervisor?.email}</div>
              </div>
            </div>
            <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>

      <nav className="mob-nav">
        <button className={`mob-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <LayoutDashboard size={18} /><span>Home</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'sites' ? 'active' : ''}`} onClick={() => setActiveTab('sites')}>
          <Building2 size={18} /><span>Sites</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
          <span className="mob-nav-icon-wrap">
            <Users size={18} />
            {activeAlertCount > 0 && <span className="mob-nav-badge">{activeAlertCount}</span>}
          </span>
          <span>Team</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <UserCheck size={18} /><span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
