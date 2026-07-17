'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  MapPin, 
  BookOpen, 
  Users, 
  AlertTriangle, 
  Activity, 
  Sliders, 
  FileText, 
  Plus, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  CheckSquare, 
  DollarSign, 
  Download, 
  Layers, 
  UserPlus, 
  Clock, 
  Settings,
  Trash2,
  Video,
  Play,
  Check,
  Radio,
  FileCheck,
  Home,
  UserCog,
  Map,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import PremisesRegistration from './components/PremisesRegistration';
import GuardManagement from './components/GuardManagement';
import SupervisorManagement from './components/SupervisorManagement';
import SystemSettings from './components/SystemSettings';
import { mergeSystemSettings } from '../lib/systemSettings';
import { apiFetch } from '../lib/apiClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('premises'); // 'premises', 'command', or 'master'
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Custom checklist template builder state
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [newFields, setNewFields] = useState([{ label: '', type: 'boolean' }]);
  
  // Visitor form state
  const [vName, setVName] = useState('');
  const [vIdNumber, setVIdNumber] = useState('');
  const [vCompany, setVCompany] = useState('');
  const [vPlate, setVPlate] = useState('');

  // Audio / alert preferences (synced from system settings)
  const sirenEnabledRef = useRef(true);
  const seenAlertIdsRef = useRef(new Set());
  const seenSosKeysRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Map Canvas Ref
  const canvasRef = useRef(null);
  const guardPosition = useRef({ x: 120, y: 180, index: 0, direction: 1 });
  const fetchInFlightRef = useRef(false);
  const pollDelayRef = useRef(10000);
  const pollTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioReadyRef = useRef(false);

  const schedulePoll = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      await fetchState();
      schedulePoll();
    }, pollDelayRef.current);
  };

  // Load state function
  const fetchState = async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await apiFetch('/api/state?client=web', { signal: AbortSignal.timeout(30000) });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to pull system data');
      const data = await res.json();
      setState(data);
      sirenEnabledRef.current = mergeSystemSettings(data.systemSettings).sirenAlertsEnabled;
      setLoading(false);
      setError(null);
      pollDelayRef.current = 10000;
      hasLoadedRef.current = true;

      const tenantId = data.activeTenantId || 'titan';
      const activeAlerts = (data.guardAlerts?.[tenantId] || []).filter((a) => a.status === 'Active');
      const sosKeys = Object.keys(data.activeSosAlerts || {});
      let hasNewAlert = false;
      for (const alert of activeAlerts) {
        if (!seenAlertIdsRef.current.has(alert.id)) {
          seenAlertIdsRef.current.add(alert.id);
          hasNewAlert = true;
        }
      }
      for (const key of sosKeys) {
        if (!seenSosKeysRef.current.has(key)) {
          seenSosKeysRef.current.add(key);
          hasNewAlert = true;
        }
      }
      if (hasNewAlert) playAlertSound();
    } catch (err) {
      if (hasLoadedRef.current) {
        setError('Connection lost — retrying…');
        pollDelayRef.current = Math.min(Math.round(pollDelayRef.current * 1.5), 60000);
      } else {
        setError('Cannot reach Titan server. Check your connection and refresh.');
      }
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  // Setup sound triggers (requires user gesture before AudioContext starts)
  const playAlertSound = () => {
    if (!sirenEnabledRef.current || !audioReadyRef.current) return;
    try {
      const audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === 'suspended') return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Audio blocked until user interacts with the page
    }
  };

  // Poll state every 10s (backs off on errors instead of hammering the server)
  useEffect(() => {
    const enableAudio = () => {
      if (audioReadyRef.current) return;
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        audioReadyRef.current = true;
        audioCtxRef.current.resume?.();
      } catch {
        // ignore
      }
    };
    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });

    fetchState();
    schedulePoll();
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  // Update incident status
  const handleUpdateIncidentStatus = async (incidentId, status) => {
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_INCIDENT_STATUS', incidentId, status })
      });
      fetchState();
    } catch (err) {
      console.error('Failed updating status:', err);
    }
  };

  // Clear Active SOS panic
  const handleClearSos = async (tenantId) => {
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_SOS', tenantId })
      });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Reset patrols
  const handleResetPatrols = async () => {
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_STATE' })
      });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Push all in-memory data to the server (keeps guards, premises, etc.)
  const handleSyncToServer = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_LOCAL_TO_SUPABASE' }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Sync failed');
      }
      const s = data.summary;
      setSyncMessage(
        `Reloaded from database: ${s.guards} guards, ${s.premises} premises, ${s.territories} territories, ${s.supervisors} supervisors, ${s.shifts} shifts.`
      );
      fetchState();
    } catch (err) {
      setSyncError('Could not reload from the database. Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearDemoData = async () => {
    if (!window.confirm(
      'Remove ALL data from the live database?\n\nThis permanently deletes every guard, premise, territory, supervisor, shift, and demo record. Only the empty Titan tenant remains. You can then register your real operational data.'
    )) return;
    setSyncError(null);
    setSyncMessage(null);
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLEAR_TENANT_DEMO_DATA',
          tenantId: state?.activeTenantId || 'titan',
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not clear data from the database.');
      }
      setSyncMessage('All records cleared from the database. You can register fresh guards, premises, and territories.');
      await fetchState();
    } catch (err) {
      setSyncError(err.message || 'Could not clear data from the database.');
    }
  };

  const handleUpdateSystemSettings = async (updates) => {
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_SYSTEM_SETTINGS', updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save system settings.');
      }
      if (data.state) {
        setState(data.state);
        sirenEnabledRef.current = mergeSystemSettings(data.state.systemSettings).sirenAlertsEnabled;
      } else {
        await fetchState();
      }
    } catch (err) {
      console.error('Failed updating system settings:', err);
      setSyncError(err.message || 'Could not save system settings.');
    }
  };

  // Register new visitor
  const handleAddVisitor = async (e) => {
    e.preventDefault();
    if (!vName || !vIdNumber) return;
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'REGISTER_VISITOR',
          tenantId: state.activeTenantId,
          name: vName, 
          idNumber: vIdNumber, 
          company: vCompany, 
          vehiclePlate: vPlate 
        })
      });
      setVName('');
      setVIdNumber('');
      setVCompany('');
      setVPlate('');
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Checkout visitor
  const handleCheckoutVisitor = async (visitorId) => {
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHECKOUT_VISITOR', visitorId })
      });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  // Checklist field add
  const handleAddField = () => {
    setNewFields([...newFields, { label: '', type: 'boolean' }]);
  };

  // Checklist template publisher
  const handlePublishChecklist = async (e) => {
    e.preventDefault();
    if (!newChecklistName || newFields.some(f => !f.label)) {
      alert('Please fill out checklist name and all field labels.');
      return;
    }
    try {
      await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'CREATE_CHECKLIST_TEMPLATE',
          tenantId: state.activeTenantId,
          name: newChecklistName, 
          description: newChecklistDesc, 
          fields: newFields 
        })
      });
      setNewChecklistName('');
      setNewChecklistDesc('');
      setNewFields([{ label: '', type: 'boolean' }]);
      fetchState();
      alert('Custom safety checklist published successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  // Interactive Live Map Animation on Canvas (Employra Clean Slate Theme)
  useEffect(() => {
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const cps = state.checkpoints[state.activeTenantId] || [];

    const drawMap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid floor background (light style)
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Draw client facility fence lines
      ctx.strokeStyle = 'rgba(27, 67, 50, 0.08)';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

      // Draw dotted path linking checkpoints
      if (cps.length > 1) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(27, 67, 50, 0.25)';
        ctx.lineWidth = 2;
        ctx.moveTo(cps[0].coords.x, cps[0].coords.y);
        for (let i = 1; i < cps.length; i++) {
          ctx.lineTo(cps[i].coords.x, cps[i].coords.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw checkpoints
      cps.forEach(cp => {
        const isScanned = cp.status === 'Scanned';
        ctx.beginPath();
        ctx.arc(cp.coords.x, cp.coords.y, 14, 0, 2 * Math.PI);
        ctx.fillStyle = isScanned ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.05)';
        ctx.fill();
        ctx.strokeStyle = isScanned ? '#10b981' : '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner circle dot
        ctx.beginPath();
        ctx.arc(cp.coords.x, cp.coords.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = isScanned ? '#10b981' : '#94a3b8';
        ctx.fill();

        // Labels
        ctx.fillStyle = '#475569';
        ctx.font = '500 10px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText(cp.name, cp.coords.x, cp.coords.y - 20);
      });

      // Animate simulated Guard movement along the path
      if (cps.length > 0) {
        const nextTargetIndex = (guardPosition.current.index + guardPosition.current.direction) % cps.length;
        const target = cps[nextTargetIndex < 0 ? cps.length - 1 : nextTargetIndex];
        const dx = target.coords.x - guardPosition.current.x;
        const dy = target.coords.y - guardPosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 2) {
          guardPosition.current.index = nextTargetIndex;
          if (nextTargetIndex === cps.length - 1) guardPosition.current.direction = -1;
          if (nextTargetIndex === 0) guardPosition.current.direction = 1;
        } else {
          guardPosition.current.x += (dx / distance) * 0.5;
          guardPosition.current.y += (dy / distance) * 0.5;
        }

        // Draw guard dot
        ctx.beginPath();
        ctx.arc(guardPosition.current.x, guardPosition.current.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#1b4332';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText('G1', guardPosition.current.x, guardPosition.current.y + 3);
      }

      animId = requestAnimationFrame(drawMap);
    };

    drawMap();
    return () => cancelAnimationFrame(animId);
  }, [state]);

  // Loading display
  if (loading && !state) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', background: '#f8fafc' }}>
        <RefreshCw style={{ animation: 'spin 1.5s linear infinite', color: '#1b4332', width: '36px', height: '36px' }} />
        <p style={{ color: '#3d5a48', fontWeight: 500 }}>Loading Titan Protection Command Centre...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const curCheckpoints = state.checkpoints[state.activeTenantId] || [];
  const curOB = state.occurrenceBook.filter(item => item.tenantId === state.activeTenantId);
  const curVisitors = state.visitors.filter(item => item.tenantId === state.activeTenantId);
  const curTemplates = state.checklistTemplates[state.activeTenantId] || [];
  const curSubmissions = state.checklistSubmissions.filter(item => item.tenantId === state.activeTenantId);
  const activeSos = state.activeSosAlerts[state.activeTenantId];

  const curPremises = state.premises?.[state.activeTenantId] || [];
  const curPlaces = state.places || {};
  const curGuards = state.guards?.[state.activeTenantId] || [];
  const curShifts = state.shifts?.[state.activeTenantId] || [];
  const curAttendance = state.attendance?.[state.activeTenantId] || [];
  const curGuardAlerts = state.guardAlerts?.[state.activeTenantId] || [];
  const curShiftSwaps = state.shiftSwapRequests?.[state.activeTenantId] || [];
  const curTerritories = state.territories?.[state.activeTenantId] || [];
  const curSupervisors = state.supervisors?.[state.activeTenantId] || [];
  const systemSettings = mergeSystemSettings(state.systemSettings);
  const onDutyCount = curAttendance.filter((a) => a.status === 'On Duty' || a.status === 'Late').length;
  const activeAlertCount = curGuardAlerts.filter((a) => a.status === 'Active').length;
  const guardsOnDuty = curAttendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const criticalGuardAlerts = curGuardAlerts.filter((a) => a.status === 'Active' && (a.severity === 'critical' || a.severity === 'warning'));

  // Calculate compliance statistics
  const scannedCps = curCheckpoints.filter(cp => cp.status === 'Scanned').length;
  const complianceRate = curCheckpoints.length > 0 ? Math.round((scannedCps / curCheckpoints.length) * 100) : 100;
  
  return (
    <div className="app-layout">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= LEFT FULL-HEIGHT SIDEBAR ================= */}
      <aside className={`sidebar-wrapper ${sidebarOpen ? 'is-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-logo">
          <img src="/emblem-wordmark.png" alt="Titan Protection" />
        </div>

        {/* Navigation tabs */}
        <ul className="sidebar-nav-list">
          <li>
            <button 
              className={`sidebar-nav-item ${activeTab === 'supervisors' ? 'active' : ''}`}
              onClick={() => selectTab('supervisors')}
            >
              <Map size={18} /> Supervisor & Territories
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-nav-item ${activeTab === 'guards' ? 'active' : ''}`}
              onClick={() => selectTab('guards')}
            >
              <UserCog size={18} /> Guard Management
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-nav-item ${activeTab === 'premises' ? 'active' : ''}`}
              onClick={() => selectTab('premises')}
            >
              <Home size={18} /> Register Premises
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-nav-item ${activeTab === 'command' ? 'active' : ''}`}
              onClick={() => selectTab('command')}
            >
              <Activity size={18} /> Command Centre
            </button>
          </li>
          <li>
            <button 
              className={`sidebar-nav-item ${activeTab === 'master' ? 'active' : ''}`}
              onClick={() => selectTab('master')}
            >
              <Sliders size={18} /> Master Admin
            </button>
          </li>
          <li>
            <Link href="/downloads" className="sidebar-nav-item sidebar-nav-link">
              <Download size={18} /> Mobile App Downloads
            </Link>
          </li>
        </ul>

        <SystemSettings
          systemSettings={systemSettings}
          dataSource={state.dataSource}
          stats={{
            guards: curGuards.length,
            premises: curPremises.length,
            territories: curTerritories.length,
            onDuty: onDutyCount,
            activeAlerts: activeAlertCount,
          }}
          onUpdateSettings={handleUpdateSystemSettings}
        />
      </aside>

      {/* ================= RIGHT CONTENT VIEWPORT ================= */}
      <div className="main-viewport">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="mobile-topbar-title">
            <img src="/emblem-wordmark.png" alt="" className="mobile-topbar-logo" />
          </div>
          <span className={`mobile-status-dot ${state?.dataSource === 'supabase' ? 'live' : ''}`} title={state?.dataSource === 'supabase' ? 'Connected' : 'Demo'} />
        </div>

        {/* Top Header Bar */}
        <header className="page-header">
          <div className="page-header-main">
            <h1 className="page-title">
              {activeTab === 'supervisors' ? 'Supervisor & Territory Management'
                : activeTab === 'guards' ? 'Guard Management' : activeTab === 'premises' ? 'Register Protected Premises' : activeTab === 'command' ? 'Command Centre Operations' : 'Master Administration'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'supervisors'
                ? 'Manage operational territories (city & suburbs) and assign area supervisors.'
                : activeTab === 'guards'
                ? 'Register guards, schedule shifts, and monitor GPS clock-in attendance from the field.'
                : activeTab === 'premises'
                ? 'Register sites under protection, add important places, and set up NFC patrol points for guards.'
                : activeTab === 'command' 
                ? 'Real-time patrol monitoring, incident updates, and visitor tracking logs.' 
                : 'Configure onboarding templates, review custom checklists, and manage server data.'}
            </p>
            <p className="page-meta">
              <strong>{systemSettings.companyName}</strong>
              {' · '}{curGuards.length} guards · {curPremises.length} premises · {curTerritories.length} territories · {onDutyCount} on duty
            </p>
          </div>

          <div className="page-header-actions">
            <span className={`connection-badge ${state?.dataSource === 'supabase' ? 'live' : ''}`}>
              <Radio size={12} style={{ animation: 'pulse 1.5s infinite' }} /> {state?.dataSource === 'supabase' ? 'Server Connected' : 'Demo Mode Active'}
            </span>
            <button type="button" className="btn-secondary" onClick={handleLogout} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              <LogOut size={14} /> Sign Out
            </button>
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
              }
            `}</style>
          </div>
        </header>

        {/* SOS Panic Alert Banner (Employra Warning Style) */}
        {activeSos && (
          <div className="glass-panel animate-pulse-glow" style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} style={{ color: 'var(--color-danger)' }} />
              <div>
                <h3 style={{ color: '#991b1b', fontSize: '0.95rem', fontWeight: 'bold' }}>CRITICAL DISTRESS SIGNAL</h3>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                  Distress reported by <strong>{activeSos.guardName}</strong> at {new Date(activeSos.timestamp).toLocaleTimeString()} - "{activeSos.message}"
                </p>
              </div>
            </div>
            <button className="btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => handleClearSos(state.activeTenantId)}>
              Dismiss Alarm
            </button>
          </div>
        )}

        {/* Sync / Connection Error Ticker */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* Active workspace rendering */}
        {activeTab === 'supervisors' ? (
          <SupervisorManagement
            tenantId={state.activeTenantId}
            territories={curTerritories}
            supervisors={curSupervisors}
            premises={curPremises}
            guards={curGuards}
            onRefresh={fetchState}
          />
        ) : activeTab === 'guards' ? (
          <GuardManagement
            tenantId={state.activeTenantId}
            guards={curGuards}
            premises={curPremises}
            territories={curTerritories}
            supervisors={curSupervisors}
            shifts={curShifts}
            attendance={curAttendance}
            guardAlerts={curGuardAlerts}
            shiftSwapRequests={curShiftSwaps}
            whatsappOutbox={state.whatsappOutbox?.[state.activeTenantId] || []}
            onRefresh={fetchState}
          />
        ) : activeTab === 'premises' ? (
          <PremisesRegistration
            tenantId={state.activeTenantId}
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
        ) : activeTab === 'command' ? (
          /* ==================== COMMAND CENTRE ==================== */
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
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{curVisitors.filter(v => v.status === 'Active').length}</h3>
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

            {/* On-duty guard list */}
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

            {/* Left Content Column: Map Canvas - was col-8 row */}
            <div className="col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel canvas-map-card" style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem' }}>Live Guard Geofence Tracker</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time GPS nodes and NFC hardware checkpoint scans</p>
                  </div>
                  <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={handleResetPatrols}>
                    <RefreshCw size={12} /> Reset Patrol
                  </button>
                </div>
                
                {/* Canvas blueprint panel */}
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
                  <canvas 
                    ref={canvasRef} 
                    width={560} 
                    height={360} 
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(255,255,255,0.9)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.7rem', border: '1px solid var(--border-light)', display: 'flex', gap: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}><span style={{ display: 'block', width: '8px', height: '8px', background: '#1b4332', borderRadius: '50%' }} /> Guard GPS</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}><span style={{ display: 'block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} /> Scanned</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}><span style={{ display: 'block', width: '8px', height: '8px', background: '#94a3b8', borderRadius: '50%' }} /> Pending</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content Column: Occurrence Book Feed */}
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
                      <p style={{ fontSize: '0.85rem' }}>No activity records found.</p>
                    </div>
                  ) : (
                    curOB.map(item => (
                      <div key={item.id} className="glass-card" style={{ padding: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <span className={`badge ${
                            item.type === 'SOS Panic Alarm' ? 'badge-red' : 
                            item.type === 'Patrol Tap' ? 'badge-blue' : 
                            'badge-green'
                          }`}>
                            {item.type}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: '0.35rem 0', fontWeight: 500 }}>{item.description}</p>
                        
                        {/* Attachments */}
                        {(item.attachments?.photo || item.attachments?.voice) && (
                          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0', padding: '0.35rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            {item.attachments.photo && (
                              <div style={{ width: '42px', height: '42px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                                <img src={item.attachments.photo} alt="Attached evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => window.open(item.attachments.photo)} />
                              </div>
                            )}
                            {item.attachments.voice && (
                              <button 
                                onClick={playAlertSound}
                                className="btn-secondary" 
                                style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem', borderRadius: '4px', height: '42px', gap: '0.2rem' }}
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

            {/* Bottom Row: Guest sign-in & table logs */}
            <div className="col-12" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              {/* Sign in card */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <UserPlus size={18} style={{ color: 'var(--color-primary)' }} />
                  Access Desk Registry
                </h3>
                <form onSubmit={handleAddVisitor} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                    <label>Visitor Full Name</label>
                    <input className="form-input" value={vName} onChange={e => setVName(e.target.value)} placeholder="e.g. Tendai Mokoena" required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>National ID / Passport</label>
                    <input className="form-input" value={vIdNumber} onChange={e => setVIdNumber(e.target.value)} placeholder="ID-880312-C" required />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Representing</label>
                    <input className="form-input" value={vCompany} onChange={e => setVCompany(e.target.value)} placeholder="e.g. DHL Express" />
                  </div>
                  <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: '0.4rem' }}>
                    <label>Vehicle License Plate</label>
                    <input className="form-input" value={vPlate} onChange={e => setVPlate(e.target.value)} placeholder="e.g. AGC-339-ZW" />
                  </div>
                  <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2', padding: '0.5rem' }}>
                    Check-in Guest
                  </button>
                </form>
              </div>

              {/* Guest Log Table */}
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
                        curVisitors.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', color: v.status === 'Checked Out' ? 'var(--text-dimmed)' : 'var(--text-main)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ fontWeight: '600' }}>{v.name}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-dimmed)' }}>{v.idNumber}</div>
                            </td>
                            <td style={{ padding: '0.5rem' }}>{v.company || 'N/A'}</td>
                            <td style={{ padding: '0.5rem' }}><span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>{v.vehiclePlate}</span></td>
                            <td style={{ padding: '0.5rem' }}>{new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <span className={`badge ${v.status === 'Active' ? 'badge-green' : 'badge-blue'}`}>
                                {v.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              {v.status === 'Active' && (
                                <button className="btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px' }} onClick={() => handleCheckoutVisitor(v.id)}>
                                  Check Out
                                </button>
                              )}
                              {v.status === 'Checked Out' && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)' }}>Out: {new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
        ) : (
          /* ==================== MASTER ADMIN ==================== */
          <div className="dashboard-grid animate-fade-in">
            {/* Server database sync */}
            <div className="col-12">
              <div className="glass-panel" style={{ padding: '1.25rem', border: state?.dataSource === 'supabase' ? '1px solid #95d5b2' : '1px solid #fcd34d', background: state?.dataSource === 'supabase' ? '#f0fdf4' : '#fffbeb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                      <Radio size={18} style={{ color: state?.dataSource === 'supabase' ? 'var(--color-success)' : 'var(--color-warning)' }} />
                      {state?.dataSource === 'supabase' ? 'Connected to Server' : 'Demo Mode — data is in memory only'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '640px' }}>
                      All records live in Supabase. The dashboard reads from the database on every refresh — it never pushes cached demo data back.
                      {typeof state?.dbGuardCount === 'number' && (
                        <span style={{ display: 'block', marginTop: '0.35rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                          Database right now: {state.dbGuardCount} guard{state.dbGuardCount === 1 ? '' : 's'} in Supabase
                        </span>
                      )}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                      <span className="badge badge-blue">{curGuards.length} guards</span>
                      <span className="badge badge-green">{curPremises.length} premises</span>
                      <span className="badge badge-blue">{curTerritories.length} territories</span>
                      <span className="badge badge-green">{curSupervisors.length} supervisors</span>
                      <span className="badge badge-blue">{curShifts.length} shifts</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSyncToServer}
                    disabled={syncing}
                    style={{ padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}
                  >
                    {syncing ? <><RefreshCw size={14} className="spin" /> Reloading…</> : <><RefreshCw size={14} /> Reload from database</>}
                  </button>
                  {(curGuards.length > 0 || curPremises.length > 0 || curTerritories.length > 0) && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleClearDemoData}
                      style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={14} /> Clear all data (remove demo records)
                    </button>
                  )}
                  </div>
                </div>
                {syncMessage && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#d8f3dc', color: '#1b4332', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                    {syncMessage} Counts above match what is stored in Supabase.
                  </div>
                )}
                {syncError && (
                  <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem' }}>
                    {syncError}
                  </div>
                )}
              </div>
            </div>

            {/* Checklist templates designer */}
            <div className="col-6">
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <FileCheck size={18} style={{ color: 'var(--color-primary)' }} />
                  Checklist Template Builder
                </h3>
                <form onSubmit={handlePublishChecklist}>
                  <div className="input-group">
                    <label>Checklist Name</label>
                    <input className="form-input" value={newChecklistName} onChange={e => setNewChecklistName(e.target.value)} placeholder="e.g. Critical Server Vault Lockup" required />
                  </div>
                  <div className="input-group">
                    <label>Guidelines / Instructions</label>
                    <input className="form-input" value={newChecklistDesc} onChange={e => setNewChecklistDesc(e.target.value)} placeholder="Verify locks and inspect temperature..." />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 0.4rem 0' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Questions List</label>
                    <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px' }} onClick={handleAddField}>
                      <Plus size={10} /> Add
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {newFields.map((field, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.4rem' }}>
                        <input 
                          className="form-input" 
                          placeholder={`Item label #${idx + 1}`} 
                          value={field.label} 
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].label = e.target.value;
                            setNewFields(updated);
                          }}
                          required
                        />
                        <select 
                          className="form-select" 
                          value={field.type} 
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].type = e.target.value;
                            setNewFields(updated);
                          }}
                          style={{ width: '100px', fontSize: '0.8rem', padding: '0.35rem' }}
                        >
                          <option value="boolean">Yes/No</option>
                          <option value="text">Text Box</option>
                        </select>
                        {newFields.length > 1 && (
                          <button 
                            type="button" 
                            className="btn-danger" 
                            style={{ padding: '0.4rem', borderRadius: '4px' }}
                            onClick={() => setNewFields(newFields.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    Publish Checklist Template
                  </button>
                </form>
              </div>

              {/* Published templates */}
              <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Active Checklists ({curTemplates.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {curTemplates.length === 0 ? (
                    <p style={{ color: 'var(--text-dimmed)', fontSize: '0.8rem' }}>No safety checklists published.</p>
                  ) : (
                    curTemplates.map(t => (
                      <div key={t.id} className="glass-card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{t.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description || 'No description'} • {t.fields.length} questions</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: System config & submissions */}
            <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <Settings size={18} style={{ color: 'var(--color-primary)' }} />
                  Titan System Configuration
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  This deployment is dedicated to Titan Protection only. Operational settings in the sidebar apply across guard clock-in, geofence monitoring, patrol alerts, and Command Centre sirens.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8rem' }}>
                  <div className="glass-card" style={{ padding: '0.65rem' }}>
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem' }}>GPS Geofence</div>
                    <div style={{ fontWeight: 600 }}>{systemSettings.geofenceRadiusMeters}m</div>
                  </div>
                  <div className="glass-card" style={{ padding: '0.65rem' }}>
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem' }}>No-Movement Alert</div>
                    <div style={{ fontWeight: 600 }}>{systemSettings.noMovementAlertMinutes} min</div>
                  </div>
                  <div className="glass-card" style={{ padding: '0.65rem' }}>
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem' }}>License Warning</div>
                    <div style={{ fontWeight: 600 }}>{systemSettings.licenseExpiryWarningDays} days</div>
                  </div>
                  <div className="glass-card" style={{ padding: '0.65rem' }}>
                    <div style={{ color: 'var(--text-dimmed)', fontSize: '0.7rem' }}>Siren Alerts</div>
                    <div style={{ fontWeight: 600 }}>{systemSettings.sirenAlertsEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </div>

              {/* Submissions */}
              <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                  Completed Audits ({curSubmissions.length})
                </h3>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '350px' }}>
                  {curSubmissions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dimmed)', fontSize: '0.8rem' }}>
                      No guard checklists submitted yet.
                    </div>
                  ) : (
                    curSubmissions.map(sub => (
                      <div key={sub.id} className="glass-card" style={{ padding: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>{sub.templateName}</span>
                          <span style={{ color: 'var(--text-dimmed)' }}>{new Date(sub.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.4rem', border: '1px solid #e2e8f0' }}>
                          {Object.entries(sub.values).map(([k, val]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '0.2rem 0' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                              <span style={{ fontWeight: 600 }}>{typeof val === 'boolean' ? (val ? 'Yes ✓' : 'No ✗') : val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', textAlign: 'right' }}>
                          Guard: {sub.guardName}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="app-footer">
          Titan Protection Operations Hub &bull; Built to Protect &bull; Developed by Arch Luviah Technologies &copy; 2026.
        </footer>
      </div>
    </div>
  );
}
