import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  FileText, 
  Users, 
  Wifi, 
  WifiOff, 
  RotateCw, 
  Camera, 
  Mic, 
  MicOff, 
  Plus, 
  Check, 
  UserCheck, 
  HelpCircle,
  Play,
  Volume2,
  FileCheck,
  Zap,
  CheckCircle2,
  QrCode,
  Compass,
  ArrowLeftRight,
  Calendar,
  Clock,
  Phone,
  Mail,
  Sun,
  Moon,
  Sparkles,
  LogOut,
  BadgeCheck,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { buildGuardProfileContext, resolveGuardPremiseId } from './guardProfile';
import SplashScreen from './components/SplashScreen';
import PinLogin from './components/PinLogin';
import ChangePin from './components/ChangePin';
import ProfilePhoto from './components/ProfilePhoto';
import { useTheme } from './hooks/useTheme';
import { getAuthSession, setAuthSession, clearAuthSession, guardInitials } from './utils/auth';
import SiteGuide from './components/SiteGuide';
import AppUpdatePanel from './components/AppUpdatePanel';
import AppUpdateScreen from './components/AppUpdateScreen';
import LocationPermissionPrompt from './components/LocationPermissionPrompt';
import { postStateAction } from './utils/api';
import {
  computePatrolShiftProgress,
  formatCountdown,
  getCheckpointPatrolUi,
} from './utils/patrolProgress';
import { captureIncidentPhoto, pickProfilePhoto } from './utils/camera';
import { getLocation, getLocationForClockIn, initLocationPermissionFlow } from './utils/location';
import { startVoiceMemo } from './utils/voice';
import { scanQrFromCamera, stopQrScanner } from './utils/qrScan';
import { parseVisitorQr } from './utils/visitorQr';
import {
  playNfcScan,
  playNfcSuccess,
  playSuccessBeep,
  playMovementAlertBeep,
  playShiftReminderBeep,
  playMissedClockOutBeep,
} from './utils/sounds';
import { DEFAULT_API_URL, DEFAULT_TENANT_ID, STATE_POLL_MS, APP_VERSION_CODE } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState('patrol'); // patrol, incidents, checklists, access
  const apiBase = DEFAULT_API_URL.replace(/\/$/, '');
  const apiUrl = (path) => `${apiBase}${path}`;
  const [isOnline, setIsOnline] = useState(true);
  const [toast, setToast] = useState(null);
  
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };
  
  // App state from API
  const [state, setState] = useState(null);
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('titan_tenant_id') || DEFAULT_TENANT_ID);
  const [premiseId, setPremiseId] = useState(() => localStorage.getItem('titan_premise_id') || '');
  const authSession = getAuthSession();
  const [isAuthenticated, setIsAuthenticated] = useState(!!authSession);
  const [mustChangePin, setMustChangePin] = useState(false);
  const [loginPinUsed, setLoginPinUsed] = useState('');
  const [pendingGuard, setPendingGuard] = useState(null);
  const [loggedInGuard, setLoggedInGuard] = useState(() => {
    try {
      const raw = sessionStorage.getItem('titan_guard_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [guardId, setGuardId] = useState(
    () => authSession?.guardId || localStorage.getItem('titan_guard_id') || ''
  );
  
  // SOS Alert State
  const [sosActive, setSosActive] = useState(false);

  // Forms state
  // Incident Form
  const [incType, setIncType] = useState('Intrusion Alert');
  const [incDesc, setIncDesc] = useState('');
  const [incPhoto, setIncPhoto] = useState(null);
  const [incVoice, setIncVoice] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // Visitor Form
  const [vName, setVName] = useState('');
  const [vIdNumber, setVIdNumber] = useState('');
  const [vCompany, setVCompany] = useState('');
  const [vPlate, setVPlate] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Selected Checklist
  const [activeChecklistId, setActiveChecklistId] = useState('');
  const [checklistAnswers, setChecklistAnswers] = useState({});

  // Offline Queues
  const [offlineQueue, setOfflineQueue] = useState({
    patrols: [],
    incidents: [],
    visitors: [],
    checklists: [],
    sos: [],
  });
  /** Optimistic last-scan times (incl. offline taps) for interval UI. */
  const [localScanTimes, setLocalScanTimes] = useState({});
  const [patrolTick, setPatrolTick] = useState(0);

  const [swapForm, setSwapForm] = useState({ shiftId: '', targetGuardId: '', reason: '' });
  const movementAlertPlayed = useRef(false);
  const missedClockOutPlayed = useRef(null);
  const shiftReminderPlayed = useRef(new Set());
  const hasLoadedStateRef = useRef(false);
  const voiceRecorderRef = useRef(null);
  const { theme, toggleTheme, isDark } = useTheme();
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [locPermVisible, setLocPermVisible] = useState(false);
  const [locPermAutoRequested, setLocPermAutoRequested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [tabKey, setTabKey] = useState(0);
  const [showUpdateScreen, setShowUpdateScreen] = useState(false);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const incidentSubmittingRef = useRef(false);

  // Local Canvas Map Ref
  const mapCanvasRef = useRef(null);
  const mapCenter = { x: 170, y: 110 };
  const scanRadius = useRef(0);

  // Load state from local storage or server
  useEffect(() => {
    const savedQueue = localStorage.getItem('titan_offline_queue');
    if (savedQueue) {
      setOfflineQueue(JSON.parse(savedQueue));
    }
  }, []);

  useEffect(() => {
    const exitTimer = setTimeout(() => setSplashExiting(true), 2000);
    const hideTimer = setTimeout(() => setSplashVisible(false), 2550);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const { needsPrompt, autoRequested } = await initLocationPermissionFlow(APP_VERSION_CODE);
      if (!cancelled && needsPrompt) {
        setLocPermAutoRequested(!!autoRequested);
        setLocPermVisible(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const saveQueueToStorage = (newQueue) => {
    setOfflineQueue(newQueue);
    localStorage.setItem('titan_offline_queue', JSON.stringify(newQueue));
  };

  // Pull state from server API
  const fetchState = async () => {
    try {
      const res = await fetch(apiUrl('/api/state'), {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setLocalScanTimes((prev) => {
          const next = { ...prev };
          for (const cp of data.checkpoints?.[tenantId] || []) {
            if (!cp.lastScanned) continue;
            const serverTs = new Date(cp.lastScanned).getTime();
            if (!next[cp.id] || serverTs >= new Date(next[cp.id]).getTime()) {
              delete next[cp.id];
            }
          }
          return next;
        });
        setIsOnline(true);
        const activeSos = data.activeSosAlerts?.[tenantId];
        const myName = loggedInGuard?.fullName || allGuardsFromState(data)?.find((g) => g.id === guardId)?.fullName;
        const isMySos = activeSos && myName && activeSos.guardName === myName;
        setSosActive(!!isMySos);
        hasLoadedStateRef.current = true;
      }
    } catch (e) {
      console.warn('API connection failed:', e.message);
      if (isOnline) setIsOnline(false);
    }
  };

  function allGuardsFromState(data) {
    return data?.guards?.[tenantId] || [];
  }

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, STATE_POLL_MS);
    return () => clearInterval(interval);
  }, [tenantId, guardId]);

  // Keep logged-in guard profile in sync with server state (PIN never included in API)
  useEffect(() => {
    if (!isAuthenticated || !guardId || !state) return;
    const fresh = (state.guards?.[tenantId] || []).find((g) => g.id === guardId);
    if (fresh) {
      setLoggedInGuard(fresh);
      try {
        sessionStorage.setItem('titan_guard_profile', JSON.stringify(fresh));
      } catch {
        /* ignore */
      }
    }
  }, [state, guardId, tenantId, isAuthenticated]);

  // Keep active site aligned with guard assignments (never default to first tenant site)
  useEffect(() => {
    if (!isAuthenticated || !guardId || !state) return;
    const guard = (state.guards?.[tenantId] || []).find((g) => g.id === guardId) || loggedInGuard;
    if (!guard) return;

    const profile = buildGuardProfileContext(state, tenantId, guardId);
    const resolved = resolveGuardPremiseId({
      guard,
      premises: state.premises?.[tenantId] || [],
      premiseId,
      guardProfile: profile,
      attendance: state.attendance?.[tenantId] || [],
      guardId,
    });

    if (resolved === premiseId) return;
    setPremiseId(resolved);
    if (resolved) {
      localStorage.setItem('titan_premise_id', resolved);
    } else {
      localStorage.removeItem('titan_premise_id');
    }
  }, [state, tenantId, guardId, loggedInGuard, isAuthenticated, premiseId]);

  const selectPremise = (id) => {
    if (!id) return;
    const guard = loggedInGuard || (state?.guards?.[tenantId] || []).find((g) => g.id === guardId);
    const assigned = guard?.assignedPremiseIds || [];
    if (assigned.length && !assigned.includes(id)) {
      showToast('That site is not assigned to you', 'error');
      return;
    }
    setPremiseId(id);
    localStorage.setItem('titan_premise_id', id);
  };

  const handleClockIn = async () => {
    if (!guardId) {
      showToast('Sign in again to clock in', 'error');
      return;
    }
    const guard = loggedInGuard || (state?.guards?.[tenantId] || []).find((g) => g.id === guardId);
    const profile = state && guardId ? buildGuardProfileContext(state, tenantId, guardId) : null;
    const targetPremise = resolveGuardPremiseId({
      guard,
      premises: state?.premises?.[tenantId] || [],
      premiseId,
      guardProfile: profile,
      attendance: state?.attendance?.[tenantId] || [],
      guardId,
    });
    if (!targetPremise) {
      showToast('No premises assigned — contact your supervisor', 'error');
      return;
    }
    if (targetPremise !== premiseId) {
      setPremiseId(targetPremise);
      localStorage.setItem('titan_premise_id', targetPremise);
    }
    try {
      const { lat, lng, accuracy } = await getLocationForClockIn();
      await postStateAction(apiBase, {
        action: 'GUARD_CLOCK_IN',
        guardId,
        premiseId: targetPremise,
        tenantId,
        lat,
        lng,
        accuracyMeters: accuracy,
      });
      showToast('On duty — now scan each patrol point below');
      fetchState();
    } catch (e) {
      showToast(e.message || 'Clock-in failed', 'error');
    }
  };

  const handleClockOut = async () => {
    if (!guardId) return;
    const handoverNotes = window.prompt('Shift handover notes for relief guard (optional):') ?? '';
    try {
      const { lat, lng, accuracy } = await getLocationForClockIn();
      await postStateAction(apiBase, {
        action: 'GUARD_CLOCK_OUT',
        guardId,
        tenantId,
        lat,
        lng,
        accuracyMeters: accuracy,
        handoverNotes,
      });
      showToast('Shift ended — clocked out at premises');
      movementAlertPlayed.current = false;
      missedClockOutPlayed.current = null;
      fetchState();
    } catch (e) {
      showToast(e.message || 'Clock-out failed — you must be at the premises geofence', 'error');
    }
  };

  const handleWelfareAck = async () => {
    if (!guardId) return;
    try {
      await postStateAction(apiBase, { action: 'WELFARE_ACK', guardId, tenantId });
      showToast('Welfare check confirmed — OK');
      fetchState();
    } catch (e) {
      showToast(e.message || 'Could not confirm welfare check', 'error');
    }
  };

  const handleMovementAck = async () => {
    if (!guardId) return;
    try {
      let lat;
      let lng;
      try {
        ({ lat, lng } = await getLocation());
      } catch {
        /* Confirm OK even when GPS is unavailable indoors */
      }
      await postStateAction(apiBase, {
        action: 'GUARD_MOVEMENT_ACK',
        guardId,
        tenantId,
        lat,
        lng,
      });
      movementAlertPlayed.current = false;
      setState((prev) => {
        if (!prev?.attendance?.[tenantId]) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          attendance: {
            ...prev.attendance,
            [tenantId]: prev.attendance[tenantId].map((a) =>
              a.guardId === guardId && (a.status === 'On Duty' || a.status === 'Late')
                ? { ...a, needsMovementAck: false, lastMovementAt: now, lastHeartbeat: now }
                : a
            ),
          },
        };
      });
      showToast('Patrol status confirmed — supervisor notified');
      fetchState();
    } catch (e) {
      showToast(e.message || 'Could not confirm status', 'error');
    }
  };

  const handleRequestShiftSwap = async (e) => {
    e.preventDefault();
    if (!swapForm.shiftId) {
      showToast('Select a shift to swap', 'error');
      return;
    }
    try {
      await postStateAction(apiBase, {
        action: 'REQUEST_SHIFT_SWAP',
        tenantId,
        shiftId: swapForm.shiftId,
        requestingGuardId: guardId,
        targetGuardId: swapForm.targetGuardId || null,
        reason: swapForm.reason,
      });
      showToast('Shift swap request sent to supervisor');
      setSwapForm({ shiftId: '', targetGuardId: '', reason: '' });
      fetchState();
    } catch (e) {
      showToast(e.message || 'Swap request failed', 'error');
    }
  };

  const handleToggleOnline = async (onlineVal) => {
    setIsOnline(onlineVal);
    if (onlineVal) {
      await syncOfflineQueue();
    }
  };

  // Sync Offline cache to Server
  const syncOfflineQueue = async () => {
    const queue = { ...offlineQueue };
    let syncCount = 0;

    const postQueueItem = async (body) => {
      const res = await fetch(apiUrl('/api/state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Sync failed');
    };

    try {
      const remainingPatrols = [];
      for (const item of queue.patrols) {
        try {
          await postQueueItem({
            action: 'TAP_NFC',
            checkpointId: item.checkpointId,
            guardId: item.guardId,
            guardName: item.guardName,
            tenantId: item.tenantId,
          });
          syncCount++;
        } catch {
          remainingPatrols.push(item);
        }
      }
      queue.patrols = remainingPatrols;

      const remainingIncidents = [];
      for (const item of queue.incidents) {
        try {
          await postQueueItem({ action: 'LOG_INCIDENT', ...item });
          syncCount++;
        } catch {
          remainingIncidents.push(item);
        }
      }
      queue.incidents = remainingIncidents;

      const remainingVisitors = [];
      for (const item of queue.visitors) {
        try {
          await postQueueItem({ action: 'REGISTER_VISITOR', ...item });
          syncCount++;
        } catch {
          remainingVisitors.push(item);
        }
      }
      queue.visitors = remainingVisitors;

      const remainingChecklists = [];
      for (const item of queue.checklists) {
        try {
          await postQueueItem({ action: 'SUBMIT_CHECKLIST', ...item });
          syncCount++;
        } catch {
          remainingChecklists.push(item);
        }
      }
      queue.checklists = remainingChecklists;

      const remainingSos = [];
      for (const item of queue.sos || []) {
        try {
          await postQueueItem({ action: 'TRIGGER_SOS', ...item });
          syncCount++;
        } catch {
          remainingSos.push(item);
        }
      }
      queue.sos = remainingSos;

      saveQueueToStorage(queue);
      if (syncCount > 0) {
        showToast(`Synchronized ${syncCount} cached operations`);
      }
      fetchState();
    } catch (err) {
      console.error('Failed to sync offline items:', err);
      showToast('Sync failed — check server connection', 'error');
    }
  };

  // Trigger SOS Panic
  const handleTriggerSos = async () => {
    const nextSosState = !sosActive;

    if (nextSosState) {
      try {
        const { lat, lng } = await getLocation();
        setSosActive(true);
        if (isOnline) {
          await postStateAction(apiBase, {
            action: 'TRIGGER_SOS',
            guardId,
            guardName,
            tenantId,
            lat,
            lng,
            alertMessage: `Emergency panic by ${guardName}`,
          });
          fetchState();
          showToast('SOS sent to Command Centre', 'error');
        } else {
          const queue = { ...offlineQueue };
          if (!queue.sos) queue.sos = [];
          queue.sos.push({
            guardId,
            guardName,
            tenantId,
            lat,
            lng,
            alertMessage: `Emergency panic by ${guardName} (queued offline)`,
            queuedAt: new Date().toISOString(),
          });
          saveQueueToStorage(queue);
          showToast('SOS queued — will send when back online', 'error');
        }
      } catch (e) {
        setSosActive(false);
        showToast(e.message || 'Could not send SOS', 'error');
      }
      return;
    }

    setSosActive(false);
    if (!isOnline) {
      showToast('Alarm cleared on device', 'info');
      return;
    }
    try {
      await postStateAction(apiBase, { action: 'CLEAR_SOS', guardId, guardName, tenantId });
      fetchState();
      showToast('Distress alarm cancelled');
    } catch (e) {
      showToast(e.message || 'Could not clear alarm', 'error');
    }
  };

  const playMovementAlertBeepLocal = playMovementAlertBeep;

  // NFC Tap
  const handleNfcTap = async (checkpointId, cpName) => {
    if (!isOnDuty) {
      showToast('Clock in first to log patrol points', 'error');
      return;
    }
    const cp = checkpoints.find((c) => c.id === checkpointId);
    const patrolUi = getCheckpointPatrolUi(cp);
    if (!patrolUi.canScan) {
      showToast(
        patrolUi.phase === 'waiting' && patrolUi.msUntilDue
          ? `Next patrol in ${formatCountdown(patrolUi.msUntilDue)}`
          : 'Point logged — wait for the next interval',
        'info'
      );
      return;
    }
    playNfcScan();
    scanRadius.current = 2;
    
    if (isOnline) {
      try {
        let lat, lng;
        try {
          const loc = await getLocation();
          lat = loc.lat;
          lng = loc.lng;
        } catch (_) { /* optional GPS */ }
        const res = await fetch(apiUrl('/api/state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'TAP_NFC',
            checkpointId,
            guardId,
            guardName,
            tenantId,
            premiseId,
            lat,
            lng,
            nfcTagId: cp?.code || null,
          }),
        });
        if (res.ok) {
          playNfcSuccess();
          const now = new Date().toISOString();
          setLocalScanTimes((prev) => ({ ...prev, [checkpointId]: now }));
          showToast(`Patrol point logged: ${cpName}`);
          fetchState();
        }
      } catch (e) {
        showToast('Connection lost — saved offline', 'error');
        queuePatrolTap(checkpointId, cpName);
      }
    } else {
      queuePatrolTap(checkpointId, cpName);
    }
  };

  const queuePatrolTap = (checkpointId, cpName) => {
    const queue = { ...offlineQueue };
    queue.patrols.push({ checkpointId, guardId, guardName, tenantId, premiseId, timestamp: new Date().toISOString() });
    saveQueueToStorage(queue);
    setLocalScanTimes((prev) => ({ ...prev, [checkpointId]: new Date().toISOString() }));
    playNfcSuccess();
    showToast(`Scanned offline: ${cpName}`, 'info');
  };

  // Log Incident
  const handleLogIncident = async (e) => {
    e.preventDefault();
    if (!incDesc.trim() || incidentSubmittingRef.current) return;

    const clientRequestId = crypto.randomUUID();
    const payload = {
      tenantId,
      guardId,
      guardName,
      type: incType,
      description: incDesc.trim(),
      photo: incPhoto,
      voice: incVoice,
      clientRequestId,
    };

    incidentSubmittingRef.current = true;
    setIncidentSubmitting(true);

    if (isOnline) {
      try {
        await postStateAction(apiBase, { action: 'LOG_INCIDENT', ...payload });
        showToast('Incident reported to Command Centre');
        setIncDesc('');
        setIncPhoto(null);
        setIncVoice(null);
        fetchState();
      } catch (err) {
        showToast(err.message || 'Could not report incident', 'error');
        queueIncident(payload);
      } finally {
        incidentSubmittingRef.current = false;
        setIncidentSubmitting(false);
      }
    } else {
      queueIncident(payload);
      incidentSubmittingRef.current = false;
      setIncidentSubmitting(false);
    }
  };

  const queueIncident = (payload) => {
    const queue = { ...offlineQueue };
    queue.incidents.push({ ...payload, timestamp: new Date().toISOString() });
    saveQueueToStorage(queue);
    showToast('Incident saved offline', 'info');
    setIncDesc('');
    setIncPhoto(null);
    setIncVoice(null);
  };

  const handleCapturePhoto = async () => {
    try {
      const dataUrl = await captureIncidentPhoto();
      if (!dataUrl) return;
      if (dataUrl.length > 600000) {
        showToast('Photo too large — move closer and try again', 'error');
        return;
      }
      setIncPhoto(dataUrl);
      playSuccessBeep();
    } catch (e) {
      showToast(e.message || 'Could not open camera', 'error');
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording && voiceRecorderRef.current) {
      setIsRecording(false);
      try {
        const dataUrl = await voiceRecorderRef.current.stop();
        voiceRecorderRef.current = null;
        if (dataUrl) {
          if (dataUrl.length > 400000) {
            showToast('Recording too long — keep under 30 seconds', 'error');
            return;
          }
          setIncVoice(dataUrl);
          playSuccessBeep();
        }
      } catch (e) {
        showToast(e.message || 'Could not save recording', 'error');
      }
      return;
    }
    try {
      voiceRecorderRef.current = await startVoiceMemo();
      setIsRecording(true);
    } catch (e) {
      showToast(e.message || 'Microphone permission required', 'error');
    }
  };

  useEffect(() => () => { stopQrScanner(); }, []);

  const handleScanQrBadge = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const decoded = await scanQrFromCamera('visitor-qr-reader');
      const parsed = parseVisitorQr(decoded);
      if (!parsed?.name) {
        showToast('Could not read visitor details from QR code', 'error');
        return;
      }
      setVName(parsed.name);
      setVIdNumber(parsed.idNumber || '');
      setVCompany(parsed.company || '');
      setVPlate(parsed.vehiclePlate || '');
      playSuccessBeep();
      showToast(`Scanned: ${parsed.name}`);
    } catch (e) {
      if (String(e?.message || e).toLowerCase().includes('cancel')) return;
      showToast(e.message || 'QR scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };


  // Sign in Visitor
  const handleAddVisitor = async (e) => {
    e.preventDefault();
    if (!vName || !vIdNumber) return;

    const payload = {
      tenantId,
      guardId,
      guardName,
      name: vName,
      idNumber: vIdNumber,
      company: vCompany,
      vehiclePlate: vPlate
    };

    if (isOnline) {
      try {
        const res = await fetch(apiUrl('/api/state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REGISTER_VISITOR', ...payload })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Could not register visitor');
        }
        showToast(`Visitor checked in: ${vName}`);
        setVName('');
        setVIdNumber('');
        setVCompany('');
        setVPlate('');
        fetchState();
      } catch (err) {
        showToast(err.message || 'Server unreachable — saved offline', 'error');
        queueVisitor(payload);
      }
    } else {
      queueVisitor(payload);
    }
  };

  const queueVisitor = (payload) => {
    const queue = { ...offlineQueue };
    queue.visitors.push({ ...payload, guardId, guardName });
    saveQueueToStorage(queue);
    showToast(`Visitor queued offline: ${vName}`, 'info');
    setVName('');
    setVIdNumber('');
    setVCompany('');
    setVPlate('');
  };

  const handleCheckoutVisitor = async (visitorId) => {
    try {
      await postStateAction(apiBase, {
        action: 'CHECKOUT_VISITOR',
        tenantId,
        visitorId,
        guardId,
      });
      showToast('Visitor checked out');
      fetchState();
    } catch (e) {
      showToast(e.message || 'Could not check out visitor', 'error');
    }
  };

  const activeVisitors = (state?.visitors || []).filter(
    (v) => v.tenantId === tenantId && v.status === 'Active'
  );

  // Complete Checklist
  const handleSubmitChecklist = async (e) => {
    e.preventDefault();
    if (!activeChecklistId) return;

    const template = state?.checklistTemplates[tenantId]?.find(t => t.id === activeChecklistId);
    if (!template) return;

    const answers = { ...checklistAnswers };
    template.fields.forEach(f => {
      if (answers[f.id] === undefined) {
        answers[f.id] = f.type === 'boolean' ? false : 'N/A';
      }
    });

    const payload = {
      tenantId,
      guardId,
      templateId: activeChecklistId,
      templateName: template.name,
      guardName,
      values: answers
    };

    if (isOnline) {
      try {
        await fetch(apiUrl('/api/state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SUBMIT_CHECKLIST', ...payload })
        });
        showToast(`Checklist submitted: ${template.name}`);
        setActiveChecklistId('');
        setChecklistAnswers({});
        fetchState();
      } catch (err) {
        showToast('Checklist saved offline', 'error');
        queueChecklist(payload);
      }
    } else {
      queueChecklist(payload);
    }
  };

  const queueChecklist = (payload) => {
    const queue = { ...offlineQueue };
    queue.checklists.push(payload);
    saveQueueToStorage(queue);
    showToast('Checklist completed offline', 'info');
    setActiveChecklistId('');
    setChecklistAnswers({});
  };

  // Radar Scan Map Canvas drawing effect
  useEffect(() => {
    if (activeTab !== 'patrol') return;
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let sweepAngle = 0;

    const cps = (state?.checkpoints[tenantId] || []).filter((cp) => !premiseId || cp.premiseId === premiseId);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    const drawLocalMap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (dark) {
        ctx.fillStyle = '#0f1f17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Radial background grid lines
      ctx.strokeStyle = dark ? 'rgba(82, 183, 136, 0.12)' : 'rgba(27, 67, 50, 0.08)';
      ctx.lineWidth = 1;
      for (let r = 30; r < 200; r += 30) {
        ctx.beginPath();
        ctx.arc(mapCenter.x, mapCenter.y, r, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Scanner radar sweep line
      sweepAngle = (sweepAngle + 0.02) % (2 * Math.PI);
      ctx.beginPath();
      ctx.moveTo(mapCenter.x, mapCenter.y);
      ctx.arc(
        mapCenter.x, 
        mapCenter.y, 
        150, 
        sweepAngle - 0.25, 
        sweepAngle, 
        false
      );
      ctx.lineTo(mapCenter.x, mapCenter.y);
      const grad = ctx.createRadialGradient(mapCenter.x, mapCenter.y, 10, mapCenter.x, mapCenter.y, 150);
      grad.addColorStop(0, dark ? 'rgba(82, 183, 136, 0.28)' : 'rgba(64, 145, 108, 0.22)');
      grad.addColorStop(1, 'rgba(64, 145, 108, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Checkpoint Pins
      cps.forEach((cp, idx) => {
        // Calculate a circular position offset relative to central guard node
        const angle = (idx * (2 * Math.PI)) / cps.length;
        const x = mapCenter.x + Math.cos(angle) * 75;
        const y = mapCenter.y + Math.sin(angle) * 75;

        // Save coordinates for visual mapping triggers
        cp.coords = { x, y };

        const isScanned = cp.status === 'Scanned';

        // Glowing outer sensor ring
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = isScanned ? 'rgba(16, 185, 129, 0.12)' : 'rgba(203, 213, 225, 0.15)';
        ctx.fill();
        ctx.strokeStyle = isScanned ? '#22c55e' : (dark ? '#4b5563' : '#cbd5e1');
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Checkpoint pin
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = isScanned ? '#22c55e' : (dark ? '#6b7280' : '#94a3b8');
        ctx.fill();

        // Label
        ctx.fillStyle = dark ? '#8fbf9f' : '#475569';
        ctx.font = '500 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cp.name.substring(0, 10) + '...', x, y + 22);
      });

      // Animated Tap Scan Ring
      if (scanRadius.current > 0 && scanRadius.current < 45) {
        scanRadius.current += 1.5;
        ctx.beginPath();
        ctx.arc(mapCenter.x, mapCenter.y, scanRadius.current, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Central Guard locator node
      ctx.beginPath();
      ctx.arc(mapCenter.x, mapCenter.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = dark ? '#52b788' : '#1b4332';
      ctx.fill();
      ctx.strokeStyle = dark ? '#12251c' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(drawLocalMap);
    };

    drawLocalMap();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, state, tenantId, premiseId, theme]);

  // Derived properties
  const activeTenant = state?.tenants[tenantId] || { name: 'Titan Protection', primaryColor: '#1b4332' };
  const allGuards = state?.guards?.[tenantId] || [];
  const assignedGuards = allGuards.filter(
    (g) => g.status === 'Active' && (!premiseId || (g.assignedPremiseIds || []).includes(premiseId))
  );
  const activeGuard = loggedInGuard || allGuards.find((g) => g.id === guardId) || null;
  const guardName = activeGuard?.fullName || 'Guard';
  const premises = state?.premises?.[tenantId] || [];
  const guardProfile =
    state && guardId
      ? buildGuardProfileContext(state, tenantId, guardId) ||
        (activeGuard ? buildGuardProfileContext({ ...state, guards: { ...state.guards, [tenantId]: [activeGuard] } }, tenantId, guardId) : null)
      : null;
  const myPremises = activeGuard
    ? premises.filter((p) => (activeGuard.assignedPremiseIds || []).includes(p.id))
    : premises;
  const attendance = state?.attendance?.[tenantId] || [];
  const myAttendance = attendance.find((a) => a.guardId === guardId && (a.status === 'On Duty' || a.status === 'Late'));
  const isOnDuty = !!myAttendance;
  const todayShifts = (state?.shifts?.[tenantId] || []).filter(
    (s) => s.guardId === guardId && s.date === new Date().toISOString().slice(0, 10)
  );
  const mySwapRequests = (state?.shiftSwapRequests?.[tenantId] || []).filter((s) => s.requestingGuardId === guardId);
  const swapableShifts = (state?.shifts?.[tenantId] || []).filter(
    (s) => s.guardId === guardId && s.status !== 'Completed' && s.status !== 'Cancelled'
  );
  const activePremise = premises.find((p) => p.id === premiseId);
  const geofenceRadius = Number(state?.systemSettings?.geofenceRadiusMeters) || 6;
  const allCheckpoints = state?.checkpoints[tenantId] || [];
  const checkpoints = useMemo(() => {
    const linked = premiseId
      ? allCheckpoints.filter((cp) => cp.premiseId === premiseId)
      : allCheckpoints;
    const base = linked.length > 0 || !premiseId
      ? linked
      : (state?.places?.[premiseId] || []).map((place) => ({
          id: `${tenantId}-cp-${place.id.slice(-6)}`,
          name: place.name,
          schedule: place.schedule || 'Every 30 mins',
          status: 'Pending',
          lastScanned: null,
          premiseId,
          placeId: place.id,
          coordinates: place.coordinates,
        }));
    return base.map((cp) => {
      const lastScanned = localScanTimes[cp.id] || cp.lastScanned || null;
      return {
        ...cp,
        lastScanned,
        status: lastScanned ? 'Scanned' : cp.status,
      };
    });
  }, [allCheckpoints, premiseId, state?.places, tenantId, localScanTimes]);
  const templates = state?.checklistTemplates[tenantId] || [];
  const offlineCount = offlineQueue.patrols.length + offlineQueue.incidents.length + offlineQueue.visitors.length + offlineQueue.checklists.length + (offlineQueue.sos?.length || 0);

  // Re-render patrol countdown labels while on duty
  useEffect(() => {
    if (!isOnDuty || activeTab !== 'patrol') return undefined;
    const timer = setInterval(() => setPatrolTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, [isOnDuty, activeTab]);

  // Calculate checklist completion percentage
  const template = templates.find(t => t.id === activeChecklistId);
  const checklistFieldsCount = template?.fields.length || 0;
  const answeredCount = Object.keys(checklistAnswers).length;
  const completionPercent = checklistFieldsCount > 0 ? Math.round((answeredCount / checklistFieldsCount) * 100) : 0;


  // Movement heartbeat while on duty
  useEffect(() => {
    if (!isOnDuty || !isOnline || !guardId) return;
    const sendHeartbeat = async () => {
      try {
        const { lat, lng } = await getLocation();
        await fetch(apiUrl('/api/state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'GUARD_HEARTBEAT', guardId, tenantId, lat, lng }),
        });
      } catch (_) { /* ignore */ }
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 45000);
    return () => clearInterval(timer);
  }, [isOnDuty, isOnline, guardId, tenantId]);

  // No-movement alert — play sound when supervisor flag is set
  useEffect(() => {
    if (myAttendance?.needsMovementAck && !movementAlertPlayed.current) {
      playMovementAlertBeepLocal();
      movementAlertPlayed.current = true;
    }
    if (!myAttendance?.needsMovementAck) {
      movementAlertPlayed.current = false;
    }
  }, [myAttendance?.needsMovementAck]);

  // Missed clock-out alert from server (30 min after shift end)
  useEffect(() => {
    if (!guardId || !state || !hasLoadedStateRef.current) return;
    const alerts = (state.guardAlerts?.[tenantId] || []).filter(
      (a) => a.guardId === guardId && a.status === 'Active' && a.type === 'missed_clock_out'
    );
    if (alerts.length > 0) {
      const latest = alerts.reduce((best, a) => {
        if (!best) return a;
        return new Date(a.createdAt).getTime() > new Date(best.createdAt).getTime() ? a : best;
      }, null);
      if (latest && latest.id !== missedClockOutPlayed.current) {
        playMissedClockOutBeep();
        missedClockOutPlayed.current = latest.id;
        showToast('Shift ended — return to premises geofence to clock out', 'error');
      }
    } else {
      missedClockOutPlayed.current = null;
    }
  }, [state, guardId, tenantId]);

  // 30-minute pre-shift clock-in reminder (local scheduler)
  useEffect(() => {
    if (!isAuthenticated || !guardId || !state || isOnDuty) return undefined;

    const reminderMins = Number(state.systemSettings?.shiftClockInReminderMinutes) || 30;
    const today = new Date().toISOString().slice(0, 10);
    const shifts = (state.shifts?.[tenantId] || []).filter(
      (s) => s.guardId === guardId && s.date === today && s.status === 'Scheduled'
    );

    const checkReminders = () => {
      const now = Date.now();
      shifts.forEach((shift) => {
        const start = new Date(`${shift.date}T${shift.startTime}:00`).getTime();
        if (Number.isNaN(start)) return;
        const reminderAt = start - reminderMins * 60 * 1000;
        const key = `${shift.id}_pre${reminderMins}`;
        if (now >= reminderAt && now < start && !shiftReminderPlayed.current.has(key)) {
          shiftReminderPlayed.current.add(key);
          playShiftReminderBeep();
          const minsLeft = Math.max(1, Math.round((start - now) / 60000));
          showToast(`Shift starts in ~${minsLeft} min — go to premises to clock in`, 'info');
          try {
            localStorage.setItem(`titan_shift_reminder_${key}`, '1');
          } catch {
            /* ignore */
          }
        }
      });
    };

    shifts.forEach((shift) => {
      const key = `${shift.id}_pre${reminderMins}`;
      try {
        if (localStorage.getItem(`titan_shift_reminder_${key}`)) {
          shiftReminderPlayed.current.add(key);
        }
      } catch {
        /* ignore */
      }
    });

    checkReminders();
    const timer = setInterval(checkReminders, 60000);
    return () => clearInterval(timer);
  }, [isAuthenticated, guardId, state, isOnDuty, tenantId]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleLogin = (guard, options = {}) => {
    setAuthSession(guard.id);
    setGuardId(guard.id);
    setLoggedInGuard(guard);
    localStorage.setItem('titan_guard_id', guard.id);
    try {
      sessionStorage.setItem('titan_guard_profile', JSON.stringify(guard));
    } catch {
      /* ignore quota errors */
    }
    const resolved = resolveGuardPremiseId({
      guard,
      premises: state?.premises?.[tenantId] || [],
      premiseId,
      guardProfile: state ? buildGuardProfileContext(state, tenantId, guard.id) : null,
      attendance: state?.attendance?.[tenantId] || [],
      guardId: guard.id,
    });
    if (resolved) {
      setPremiseId(resolved);
      localStorage.setItem('titan_premise_id', resolved);
    } else {
      setPremiseId('');
      localStorage.removeItem('titan_premise_id');
    }
    if (options.mustChangePin) {
      setPendingGuard(guard);
      setLoginPinUsed(options.currentPin || '');
      setMustChangePin(true);
      setIsAuthenticated(false);
      return;
    }
    setPendingGuard(null);
    setMustChangePin(false);
    setIsAuthenticated(true);
    const first = guard.fullName.split(' ').pop();
    showToast(`Welcome back, ${first}!`);
  };

  const handlePinChanged = () => {
    setMustChangePin(false);
    setLoginPinUsed('');
    const guard = pendingGuard || loggedInGuard;
    if (guard) {
      setLoggedInGuard(guard);
      try {
        sessionStorage.setItem('titan_guard_profile', JSON.stringify(guard));
      } catch {
        /* ignore */
      }
    }
    setPendingGuard(null);
    setIsAuthenticated(true);
    showToast('PIN updated — you are signed in');
    fetchState();
  };

  const handleLogout = () => {
    clearAuthSession();
    sessionStorage.removeItem('titan_guard_profile');
    setIsAuthenticated(false);
    setMustChangePin(false);
    setLoginPinUsed('');
    setPendingGuard(null);
    setLoggedInGuard(null);
    setActiveTab('patrol');
    showToast('Signed out securely', 'info');
  };

  const defaultPatrolIntervalMinutes = Number(state?.systemSettings?.defaultPatrolIntervalMinutes) || 30;
  const patrolShiftProgress = useMemo(
    () =>
      computePatrolShiftProgress({
        checkpoints,
        occurrenceBook: state?.occurrenceBook || [],
        guardId,
        guardName,
        premiseId,
        myAttendance,
        todayShifts,
        defaultIntervalMinutes: defaultPatrolIntervalMinutes,
        now: Date.now(),
      }),
    [
      checkpoints,
      state?.occurrenceBook,
      guardId,
      guardName,
      premiseId,
      myAttendance,
      todayShifts,
      defaultPatrolIntervalMinutes,
      patrolTick,
      localScanTimes,
    ]
  );
  const patrolPercent = patrolShiftProgress.percent;
  const patrolLogLabel = patrolShiftProgress.expected
    ? `${patrolShiftProgress.completed}/${patrolShiftProgress.expected}`
    : `0/${checkpoints.length}`;
  const dueNowCount = checkpoints.filter((cp) => getCheckpointPatrolUi(cp).canScan).length;
  const overdueCount = dueNowCount;
  const patrolComplete =
    patrolShiftProgress.expected > 0 && patrolShiftProgress.completed >= patrolShiftProgress.expected;

  const handleProfilePhoto = async () => {
    if (!guardId || photoBusy) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await pickProfilePhoto();
      if (!dataUrl) return;
      if (dataUrl.length > 500000) {
        showToast('Photo too large — move closer and try again', 'error');
        return;
      }
      await postStateAction(apiBase, { action: 'UPDATE_GUARD_PHOTO', guardId, tenantId, photoUrl: dataUrl });
      await fetchState();
      showToast('Profile photo updated');
    } catch (e) {
      showToast(e.message || 'Could not update photo', 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    if (navigator.vibrate) navigator.vibrate(10);
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (navigator.vibrate) navigator.vibrate(12);
    await fetchState();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="phone-container">
      {splashVisible && <SplashScreen exiting={splashExiting} />}
      {locPermVisible && (
        <LocationPermissionPrompt
          appName="Titan Monitor"
          onDone={() => setLocPermVisible(false)}
          autoRequested={locPermAutoRequested}
          includeMicrophone
        />
      )}
      {toast && (
        <div className={`mob-toast mob-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {!splashVisible && !isAuthenticated && mustChangePin && (pendingGuard || activeGuard) && (
        <ChangePin
          guard={pendingGuard || activeGuard}
          tenantId={tenantId}
          apiBase={apiBase}
          currentPin={loginPinUsed}
          onComplete={handlePinChanged}
        />
      )}

      {!splashVisible && !isAuthenticated && !mustChangePin && (
        <PinLogin
          tenantId={tenantId}
          apiBase={apiBase}
          tenantName={activeTenant.name}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLogin={(guard, opts) => handleLogin(guard, opts)}
        />
      )}

      {!splashVisible && isAuthenticated && (
      <>
      {/* Smartphone SOS overlay alarm screen */}
      {sosActive && (
        <div className="sos-overlay">
          <AlertTriangle size={72} style={{ color: '#ffffff', animation: 'bounce 1s infinite' }} />
          <h1 style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '900', marginTop: '1rem', letterSpacing: '-0.03em' }}>
            SOS PANIC TRIGGERED
          </h1>
          <p style={{ color: '#fee2e2', fontSize: '0.95rem', margin: '1rem 0 2rem 0', lineHeight: 1.4 }}>
            Your device's location coordinates and distress notification have been sent to the Command Centre dispatch. Support is en-route.
          </p>
          <button className="mob-btn mob-btn-secondary" style={{ width: '220px', background: '#ffffff', color: '#dc2626', border: 'none', fontSize: '1rem' }} onClick={handleTriggerSos}>
            Cancel Distress Alarm
          </button>
        </div>
      )}

      {/* 45-minute no-movement check */}
      {isOnDuty && myAttendance?.welfarePending && (
        <div className="mob-alert-banner mob-alert-welfare">
          <strong>Welfare check — confirm you are OK</strong>
          <button type="button" className="mob-btn mob-btn-primary mob-btn-sm" onClick={handleWelfareAck}>
            Confirm OK
          </button>
        </div>
      )}
      {isOnDuty && myAttendance?.needsMovementAck && (
        <div className="sos-overlay" style={{ background: 'rgba(180, 83, 9, 0.95)' }}>
          <AlertTriangle size={56} style={{ color: '#ffffff' }} />
          <h2 style={{ color: '#ffffff', fontSize: '1.35rem', fontWeight: 800, marginTop: '1rem' }}>
            Patrol Check — Are You OK?
          </h2>
          <p style={{ color: '#fef3c7', fontSize: '0.9rem', margin: '1rem 1.5rem 1.5rem', lineHeight: 1.45, textAlign: 'center' }}>
            No movement detected for 45+ minutes. Confirm you are awake and on site. Your supervisor has been notified.
          </p>
          <button
            className="mob-btn"
            style={{ width: '240px', background: '#ffffff', color: '#b45309', border: 'none', fontSize: '1rem', fontWeight: 700 }}
            onClick={handleMovementAck}
          >
            I'm OK
          </button>
        </div>
      )}

      {showUpdateScreen && (
        <AppUpdateScreen apiBase={apiBase} onClose={() => setShowUpdateScreen(false)} />
      )}

      {/* Header */}
      <header className="mob-header mob-header-branded">
        <div>
          <img src="/emblem-dark.jpg" alt="Titan Protection" className="mob-brand-logo" />
          <div className="mob-brand-tagline">Built to Protect</div>
        </div>

        <div className="mob-header-actions">
          <div className="mob-header-update-wrap">
            <AppUpdatePanel apiBase={apiBase} compact onOpenFullPage={() => setShowUpdateScreen(true)} />
          </div>
          {offlineCount > 0 && (
            <span className="mob-sync-badge" onClick={syncOfflineQueue} title="Click to sync offline cache">
              <RotateCw size={10} style={{ animation: 'spin 2s linear infinite' }} /> {offlineCount} Sync
            </span>
          )}

          <button
            className="mob-theme-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            className="mob-wifi-btn"
            onClick={() => handleToggleOnline(!isOnline)}
            title={isOnline ? 'Switch to Offline Mode' : 'Connect to Database'}
          >
            {isOnline ? (
              <Wifi size={20} style={{ color: '#4ade80' }} />
            ) : (
              <WifiOff size={20} style={{ color: '#f87171' }} />
            )}
          </button>
        </div>
      </header>

      {/* Guard status strip */}
      <div className={`mob-guard-strip ${isOnDuty ? 'on-duty' : ''}`}>
        <div className="mob-guard-row">
          <div className="mob-guard-identity">
            <ProfilePhoto
              photoUrl={activeGuard?.photoUrl}
              initials={guardInitials(activeGuard?.fullName || guardName)}
              name={activeGuard?.fullName || guardName}
              onDuty={isOnDuty}
            />
            <div className="mob-guard-select-wrap">
              <div className="mob-guard-label">{isOnDuty ? 'On duty' : 'Signed in'}</div>
              <div className="mob-guard-name">{activeGuard?.fullName || guardName}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', marginTop: '0.1rem' }}>
                {activeGuard?.employeeNumber}{activeGuard?.suburb ? ` · ${activeGuard.suburb}` : ''}
              </div>
            </div>
          </div>
          <button className="mob-btn mob-btn-secondary mob-logout-btn" onClick={handleLogout} title="Sign out">
            <LogOut size={14} /> Out
          </button>
        </div>
        <div className="mob-duty-row">
          <div className={`mob-duty-status ${isOnDuty ? 'live' : ''}`}>
            {isOnDuty && <span className="mob-live-dot" />}
            {isOnDuty ? (
              <>On duty since {new Date(myAttendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
            ) : guardProfile?.focusShift ? (
              <>Be at <strong>{guardProfile.focusShift.premiseName}</strong> by {guardProfile.focusShift.startTime}</>
            ) : todayShifts.length > 0 ? (
              <>Shift: {todayShifts[0].startTime} – {todayShifts[0].endTime}</>
            ) : (
              <>Ready to clock in</>
            )}
          </div>
          <div className="mob-duty-actions">
            <button type="button" className="mob-btn mob-btn-danger mob-sos-chip" onClick={handleTriggerSos}>SOS</button>
            {isOnDuty ? (
              <button className="mob-btn mob-btn-secondary mob-clock-btn" onClick={handleClockOut}>Clock Out</button>
            ) : (
              <button className="mob-btn mob-clock-btn in" onClick={handleClockIn}>Clock In</button>
            )}
          </div>
        </div>
      </div>

      {/* Main content viewport */}
      <div className="mob-content">

        <div className="mob-greeting-row">
          <div className="mob-greeting-col">
            <div className="mob-greeting" style={{ marginBottom: 0 }}>
              <h2>{getGreeting()}, {guardName.split(' ')[0] || 'Guard'} 👋</h2>
              <p>
                {activePremise
                  ? `${activePremise.name}${activePremise.suburb ? ` · ${activePremise.suburb}` : ''}`
                  : myPremises.length === 0
                    ? 'No site assigned — contact your supervisor'
                    : 'Select your site to begin'}
              </p>
            </div>
            {myPremises.length > 1 && (
              <select
                className="mob-select mob-site-select"
                value={premiseId || ''}
                onChange={(e) => selectPremise(e.target.value)}
                aria-label="Active site"
              >
                {myPremises.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <button
            className={`mob-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh data"
            aria-label="Refresh"
          >
            <RotateCw size={18} />
          </button>
        </div>

        {activePremise?.coordinates && !isOnDuty && (
          <SiteGuide target={activePremise} radiusMeters={geofenceRadius} compact />
        )}

        {!state && isOnline && (
          <div className="mob-skeleton-wrap" style={{ marginBottom: '1rem' }}>
            <div className="mob-skeleton hero" />
            <div className="mob-skeleton card" />
            <div className="mob-skeleton row" />
            <div className="mob-skeleton row" />
          </div>
        )}
        
        {/* ================= TAB 1: PATROL SCREEN ================= */}
        {activeTab === 'patrol' && (
          <div className="mob-tab-panel" key={`patrol-${tabKey}`}>
            {patrolComplete && (
              <div className="mob-victory-banner">
                <Sparkles size={22} />
                <div>
                  <strong>Shift patrol target reached!</strong>
                  <span>{patrolShiftProgress.completed} of {patrolShiftProgress.expected} logs for this shift.</span>
                </div>
              </div>
            )}

            <div className="mob-duty-steps">
              <div className={`mob-duty-step ${isOnDuty ? 'done' : 'active'}`}>
                <strong>1.</strong> Clock in
              </div>
              <div className={`mob-duty-step ${isOnDuty ? (dueNowCount > 0 ? 'active' : patrolShiftProgress.completed > 0 ? 'done' : '') : ''}`}>
                <strong>2.</strong> Scan points ({patrolLogLabel})
              </div>
              <div className={`mob-duty-step ${patrolComplete ? 'done' : ''}`}>
                <strong>3.</strong> Complete
              </div>
            </div>

            {!isOnDuty && checkpoints.length > 0 && (
              <p className="mob-duty-hint">Clock in above, then log each patrol point when you reach it.</p>
            )}
            {isOnDuty && dueNowCount > 0 && (
              <p className="mob-duty-hint">{dueNowCount} point{dueNowCount !== 1 ? 's' : ''} ready to log now.</p>
            )}

            <div className="mob-stat-row">
              <div className="mob-stat-chip">
                <div className="value">{patrolLogLabel}</div>
                <div className="label">Shift logs</div>
              </div>
              <div className="mob-stat-chip">
                <div className="value">{patrolPercent}%</div>
                <div className="label">Shift progress</div>
              </div>
              <div className={`mob-stat-chip ${isOnDuty ? 'highlight' : ''}`}>
                <div className="value">{isOnDuty ? 'ON' : 'OFF'}</div>
                <div className="label">Shift</div>
              </div>
            </div>

            <h3 className="mob-section-title">
              <span className="mob-section-icon patrol"><Shield size={16} /></span>
              {activePremise ? `${activePremise.name} — Patrol points` : 'Patrol points'}
            </h3>

            {activePremise?.coordinates && (
              <SiteGuide
                target={activePremise}
                radiusMeters={geofenceRadius}
              />
            )}

            {checkpoints.length === 0 ? (
              <div className="mob-empty">
                <div className="mob-empty-icon">📍</div>
                {myPremises.length === 0
                  ? 'No premises assigned to you. Ask your supervisor to assign you to a site on the dashboard.'
                  : !premiseId
                    ? 'Select your assigned site above to view patrol points.'
                    : 'No patrol points for this site. Ask your supervisor to add patrol points on the dashboard.'}
              </div>
            ) : (
              checkpoints.map(cp => {
                const patrolUi = getCheckpointPatrolUi(cp);
                return (
                <div
                  key={cp.id}
                  className={`mob-card mob-checkpoint ${patrolUi.isDoneVisual ? 'done' : ''} ${patrolUi.phase === 'waiting' ? 'waiting' : ''} ${!isOnDuty ? 'mob-checkpoint-locked' : ''}`}
                >
                  <div className="mob-checkpoint-body">
                    <h4>{cp.name}</h4>
                    <div className="mob-checkpoint-tags">
                      <span className="mob-tag">{cp.schedule}</span>
                      <span className={`mob-tag ${patrolUi.phase === 'done' ? 'success' : patrolUi.phase === 'waiting' ? 'waiting' : ''}`}>
                        {patrolUi.tag}
                      </span>
                    </div>
                  </div>
                  
                  {cp.coordinates?.lat != null && (
                    <SiteGuide
                      target={{ name: cp.name, lat: cp.coordinates.lat, lng: cp.coordinates.lng }}
                      radiusMeters={geofenceRadius}
                      compact
                    />
                  )}

                  <button 
                    onClick={() => handleNfcTap(cp.id, cp.name)}
                    disabled={!isOnDuty || !patrolUi.canScan}
                    className={`mob-btn mob-nfc-btn ${patrolUi.isDoneVisual ? 'done' : ''} ${patrolUi.phase === 'waiting' ? 'waiting' : ''}`}
                  >
                    {patrolUi.phase === 'done' ? (
                      <><Check size={12} /> Done</>
                    ) : patrolUi.phase === 'waiting' ? (
                      <><Clock size={12} /> Waiting</>
                    ) : (
                      <><Zap size={12} /> Log scan</>
                    )}
                  </button>
                </div>
              );})
            )}
          </div>
        )}

        {/* ================= TAB 2: INCIDENT REPORT (OB) ================= */}
        {activeTab === 'incidents' && (
          <div className="mob-tab-panel" key={`incidents-${tabKey}`}>
            <h3 className="mob-section-title">
              <span className="mob-section-icon incident"><AlertTriangle size={16} /></span>
              File Occurrence Book
            </h3>
            
            <form onSubmit={handleLogIncident} className="mob-card elevated">
              <label className="mob-field-label">Incident Category</label>
              <select className="mob-select" value={incType} onChange={e => setIncType(e.target.value)}>
                <option value="Intrusion Alert">Intrusion Alert</option>
                <option value="Safety Hazard">Safety Hazard</option>
                <option value="Theft Report">Theft Report</option>
                <option value="Maintenance Issue">Maintenance Issue</option>
                <option value="Gate Failure">Gate Failure</option>
                <option value="General Observation">General Observation</option>
              </select>

              <label className="mob-field-label">Detailed Description</label>
              <textarea 
                className="mob-textarea" 
                rows="4" 
                placeholder="Log activity, security observations, or hazard descriptions..." 
                value={incDesc}
                onChange={e => setIncDesc(e.target.value)}
                required
              />

              {/* Sound equalizer waveform for visual feedback */}
              {isRecording && (
                <div className="voice-wave-container">
                  <div className="voice-wave-bar" />
                  <div className="voice-wave-bar" />
                  <div className="voice-wave-bar" />
                  <div className="voice-wave-bar" />
                  <div className="voice-wave-bar" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--mob-danger)', marginLeft: '0.5rem', fontWeight: 'bold' }}>Recording...</span>
                </div>
              )}

              {/* Attachments buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <button 
                  type="button" 
                  className={`mob-btn mob-btn-secondary ${incPhoto ? 'mob-btn-success' : ''}`}
                  onClick={handleCapturePhoto}
                  style={{ fontSize: '0.75rem', padding: '0.55rem' }}
                >
                  <Camera size={14} /> {incPhoto ? 'Photo Attached' : 'Capture Image'}
                </button>
                <button 
                  type="button" 
                  className={`mob-btn mob-btn-secondary ${incVoice ? 'mob-btn-success' : ''}`}
                  onClick={handleVoiceToggle}
                  style={{ fontSize: '0.75rem', padding: '0.55rem', background: isRecording ? 'var(--mob-danger)' : '' }}
                >
                  {isRecording ? (
                    <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><MicOff size={14} /> Stop Rec</span>
                  ) : (
                    <><Mic size={14} /> {incVoice ? 'Voice Record OK' : 'Voice Memo'}</>
                  )}
                </button>
              </div>

              {incPhoto && (
                <div style={{ margin: '0.5rem 0', borderRadius: '8px', overflow: 'hidden', height: '110px', border: '1px solid var(--mob-border)' }}>
                  <img src={incPhoto} alt="Review attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <button type="submit" className="mob-btn mob-btn-danger" disabled={incidentSubmitting}>
                {incidentSubmitting ? 'Submitting…' : 'Submit Occurrence Log'}
              </button>
            </form>

            {(state?.occurrenceBook || []).filter(
              (i) =>
                i.guardId === guardId &&
                !['Patrol Tap', 'Shift Clock-In', 'Shift Clock-Out', 'Checklist Submission'].includes(i.type)
            ).slice(0, 5).length > 0 && (
              <div className="mob-card" style={{ marginTop: '1rem' }}>
                <div className="mob-card-label">Your Recent Reports</div>
                {(state?.occurrenceBook || [])
                  .filter(
                    (i) =>
                      i.guardId === guardId &&
                      !['Patrol Tap', 'Shift Clock-In', 'Shift Clock-Out', 'Checklist Submission'].includes(i.type)
                  )
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.id} className="mob-list-item">
                      <strong style={{ fontSize: '0.85rem' }}>{item.type}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>
                        {new Date(item.timestamp).toLocaleString()} · {item.status}
                      </div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>{item.description}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: CHECKLIST WORKSPACE ================= */}
        {activeTab === 'checklists' && (
          <div className="mob-tab-panel" key={`checklists-${tabKey}`}>
            <h3 className="mob-section-title">
              <span className="mob-section-icon checklist"><FileCheck size={16} /></span>
              Compliance Audits
            </h3>

            {activeChecklistId ? (
              <div className="mob-card elevated">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--mob-border)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{template?.name}</h4>
                  <button className="mob-btn mob-btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem', borderRadius: '999px', width: 'auto' }} onClick={() => setActiveChecklistId('')}>
                    Exit
                  </button>
                </div>

                <div style={{ margin: '0.5rem 0 1.25rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--mob-text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    <span>Audit Progress</span>
                    <span>{completionPercent}%</span>
                  </div>
                  <div className="mob-progress-track">
                    <div className="mob-progress-fill" style={{ width: `${completionPercent}%` }} />
                  </div>
                </div>

                <form onSubmit={handleSubmitChecklist}>
                  {template?.fields.map(field => (
                    <div key={field.id} style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.35rem', color: 'var(--mob-text)', fontWeight: 500 }}>{field.label}</label>
                      {field.type === 'boolean' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            type="button" 
                            className={`mob-btn ${checklistAnswers[field.id] === true ? '' : 'mob-btn-secondary'}`}
                            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', borderRadius: '6px', boxShadow: 'none' }}
                            onClick={() => setChecklistAnswers({ ...checklistAnswers, [field.id]: true })}
                          >
                            Yes
                          </button>
                          <button 
                            type="button" 
                            className={`mob-btn ${checklistAnswers[field.id] === false ? 'mob-btn-danger' : 'mob-btn-secondary'}`}
                            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', borderRadius: '6px', boxShadow: 'none' }}
                            onClick={() => setChecklistAnswers({ ...checklistAnswers, [field.id]: false })}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          className="mob-input" 
                          placeholder="Type response details..." 
                          value={checklistAnswers[field.id] || ''} 
                          onChange={(e) => setChecklistAnswers({ ...checklistAnswers, [field.id]: e.target.value })} 
                          required
                          style={{ marginBottom: 0 }}
                        />
                      )}
                    </div>
                  ))}
                  
                  <button type="submit" className="mob-btn" style={{ marginTop: '1.25rem' }}>
                    Submit Completed Audit
                  </button>
                </form>
              </div>
            ) : (
              <div>
                {templates.length === 0 ? (
                  <div className="mob-empty">
                    <div className="mob-empty-icon">📋</div>
                    No safety audits assigned yet. Your supervisor can create templates in Master Admin.
                  </div>
                ) : (
                  templates.map(t => (
                    <div key={t.id} className="mob-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{t.name}</h4>
                        <p style={{ fontSize: '0.725rem', color: 'var(--mob-text-muted)', margin: '0.25rem 0 0 0' }}>{t.description || 'Audit template'}</p>
                      </div>
                      <button className="mob-btn" style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.75rem', borderRadius: '12px' }} onClick={() => {
                        setActiveChecklistId(t.id);
                        setChecklistAnswers({});
                      }}>
                        Start
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: GUARD PROFILE ================= */}
        {activeTab === 'profile' && (
          <div className="mob-tab-panel" key={`profile-${tabKey}`}>
            <h3 className="mob-section-title">
              <span className="mob-section-icon profile"><UserCheck size={16} /></span>
              Guard Profile
            </h3>

            {!activeGuard && (
              <div className="mob-card">
                <p style={{ fontSize: '0.85rem', color: 'var(--mob-text-muted)', margin: 0 }}>
                  Could not load your profile. Pull down to refresh or sign out and sign in again with your PIN.
                </p>
              </div>
            )}

            {activeGuard && (
              <div className="mob-card mob-profile-hero">
                <div className="mob-profile-hero-row">
                  <ProfilePhoto
                    photoUrl={activeGuard.photoUrl}
                    initials={guardInitials(activeGuard.fullName)}
                    name={activeGuard.fullName}
                    size="lg"
                    editable
                    onEdit={handleProfilePhoto}
                    busy={photoBusy}
                  />
                  <div className="mob-profile-hero-text">
                    <strong>{activeGuard.fullName}</strong>
                    <div className="sub">{activeGuard.employeeNumber} · Grade {activeGuard.grade || '—'}</div>
                    {activeGuard.status && (
                      <span className="mob-profile-status">{activeGuard.status}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeGuard && (
              <div className="mob-card mob-profile-details">
                {activeGuard.email && (
                  <div className="mob-profile-detail">
                    <Mail size={15} />
                    <div>
                      <span className="mob-profile-detail-label">Email</span>
                      <strong>{activeGuard.email}</strong>
                    </div>
                  </div>
                )}
                {activeGuard.phone && (
                  <div className="mob-profile-detail">
                    <Phone size={15} />
                    <div>
                      <span className="mob-profile-detail-label">Phone</span>
                      <a href={`tel:${activeGuard.phone.replace(/\s/g, '')}`} className="mob-profile-link">{activeGuard.phone}</a>
                    </div>
                  </div>
                )}
                {activeGuard.idNumber && (
                  <div className="mob-profile-detail">
                    <Shield size={15} />
                    <div>
                      <span className="mob-profile-detail-label">ID Number</span>
                      <strong>{activeGuard.idNumber}</strong>
                    </div>
                  </div>
                )}
                {(activeGuard.suburb || activeGuard.city || guardProfile?.territory) && (
                  <div className="mob-profile-detail">
                    <MapPin size={15} />
                    <div>
                      <span className="mob-profile-detail-label">Area</span>
                      <strong>
                        {[activeGuard.suburb, activeGuard.city].filter(Boolean).join(', ')}
                        {guardProfile?.territory ? ` · ${guardProfile.territory.name}` : ''}
                      </strong>
                    </div>
                  </div>
                )}
                {(activeGuard.licenseNumber || activeGuard.licenseExpiry) && (
                  <div className="mob-profile-detail">
                    <BadgeCheck size={15} />
                    <div>
                      <span className="mob-profile-detail-label">PSIRA / License</span>
                      <strong>
                        {activeGuard.licenseNumber || '—'}
                        {activeGuard.licenseExpiry ? ` · exp. ${activeGuard.licenseExpiry}` : ''}
                      </strong>
                    </div>
                  </div>
                )}
                {activeGuard.performanceScore?.composite != null && (
                  <div className="mob-profile-detail">
                    <TrendingUp size={15} />
                    <div>
                      <span className="mob-profile-detail-label">Performance</span>
                      <strong>{activeGuard.performanceScore.composite}% composite score</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(guardProfile?.currentShift || guardProfile?.nextShiftToday || guardProfile?.focusShift) && (
              <div className="mob-shift-card">
                <div className="shift-label">
                  {guardProfile.currentShift ? '🟢 Current Shift' : '⏭ Next Assignment'}
                </div>
                {(guardProfile.currentShift || guardProfile.nextShiftToday || guardProfile.focusShift) && (() => {
                  const s = guardProfile.currentShift || guardProfile.nextShiftToday || guardProfile.focusShift;
                  return (
                    <>
                      <strong style={{ fontSize: '1rem' }}>{s.premiseName}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--mob-text-muted)', marginTop: '0.3rem' }}>
                        {s.date} · {s.startTime} – {s.endTime} ({s.shiftType})
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: 'var(--mob-primary)', fontWeight: 700 }}>
                        Be on site by {s.startTime}
                        {s.suburb && <span> · {s.suburb}, {s.city}</span>}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {guardProfile?.reliefGuard && (
              <div className="mob-card">
                <div className="mob-card-label">Shift Relief / Handover</div>
                <strong style={{ fontSize: '0.95rem' }}>{guardProfile.reliefGuard.fullName}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--mob-text-muted)', marginTop: '0.25rem' }}>
                  Arrives {guardProfile.reliefShift?.startTime || '—'} at {guardProfile.reliefShift?.premiseName || 'same site'}
                </div>
                {guardProfile.reliefGuard.phone && (
                  <div className="mob-contact-row">
                    <a href={`tel:${guardProfile.reliefGuard.phone.replace(/\s/g, '')}`} className="mob-contact-link">
                      <Phone size={14} /> Call Relief
                    </a>
                  </div>
                )}
              </div>
            )}

            {(guardProfile?.supervisor || guardProfile?.supervisors?.[0]) && (
              <div className="mob-card">
                <div className="mob-card-label">Your Supervisor</div>
                {[guardProfile.supervisor || guardProfile.supervisors[0]].filter(Boolean).map((s) => (
                  <div key={s.id} className="mob-list-item">
                    <strong style={{ fontSize: '0.88rem' }}>{s.fullName}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>{s.role}</div>
                    <div className="mob-contact-row">
                      {s.phone && (
                        <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="mob-contact-link">
                          <Phone size={12} /> {s.phone}
                        </a>
                      )}
                      {s.email && (
                        <a href={`mailto:${s.email}`} className="mob-contact-link">
                          <Mail size={12} /> Email
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mob-card">
              <div className="mob-card-label">My Assigned Premises</div>
              {(guardProfile?.assignedPremises || []).length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--mob-text-muted)', margin: 0 }}>No premises assigned — ask your supervisor.</p>
              ) : (
                guardProfile.assignedPremises.map((p) => (
                  <div key={p.id} className="mob-site-pick-wrap">
                    <button
                      type="button"
                      className={`mob-list-item mob-site-pick ${premiseId === p.id ? 'active' : ''}`}
                      onClick={() => selectPremise(p.id)}
                    >
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>{[p.suburb, p.city].filter(Boolean).join(', ')}</div>
                      {premiseId === p.id && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--mob-accent)', fontWeight: 700 }}>Active site</span>
                      )}
                    </button>
                    {p.coordinates?.lat != null && (
                      <SiteGuide target={p} radiusMeters={geofenceRadius} compact />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mob-card">
              <div className="mob-card-label">Upcoming Shifts</div>
              {(guardProfile?.upcomingShifts || []).length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--mob-text-muted)', margin: 0 }}>No shifts scheduled.</p>
              ) : (
                guardProfile.upcomingShifts.slice(0, 8).map((s) => (
                  <div key={s.id} className="mob-list-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span><strong>{s.premiseName}</strong><br /><span style={{ color: 'var(--mob-text-muted)', fontSize: '0.7rem' }}>{s.suburb}</span></span>
                    <span style={{ textAlign: 'right', color: 'var(--mob-text-muted)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{s.date}<br />{s.startTime}–{s.endTime}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mob-card elevated">
              <div className="mob-card-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ArrowLeftRight size={14} /> Request Shift Swap
              </div>
              <form onSubmit={handleRequestShiftSwap} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <select
                  className="mob-select"
                  value={swapForm.shiftId}
                  onChange={(e) => setSwapForm({ ...swapForm, shiftId: e.target.value })}
                >
                  <option value="">Select your shift</option>
                  {swapableShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.date} {s.startTime}–{s.endTime} ({premises.find((p) => p.id === s.premiseId)?.name || s.premiseId})
                    </option>
                  ))}
                </select>
                <select
                  className="mob-select"
                  value={swapForm.targetGuardId}
                  onChange={(e) => setSwapForm({ ...swapForm, targetGuardId: e.target.value })}
                >
                  <option value="">Swap with colleague (optional)</option>
                  {allGuards.filter((g) => g.id !== guardId && g.status === 'Active').map((g) => (
                    <option key={g.id} value={g.id}>{g.fullName}</option>
                  ))}
                </select>
                <input
                  className="mob-input"
                  placeholder="Reason for swap request"
                  value={swapForm.reason}
                  onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
                <button type="submit" className="mob-btn mob-btn-secondary">
                  Submit Swap Request
                </button>
                {mySwapRequests.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--mob-text-muted)', margin: 0 }}>
                    Recent requests: {mySwapRequests.slice(0, 3).map((s) => s.status).join(', ')}
                  </p>
                )}
              </form>
            </div>

            <div className="mob-card">
              <div className="mob-card-label">App Update</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--mob-text-muted)', margin: '0 0 0.65rem' }}>
                Check for the latest Titan Monitor build and install with one tap.
              </p>
              <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" onClick={() => setShowUpdateScreen(true)}>
                Open Update Page
              </button>
            </div>

            <button type="button" className="mob-btn mob-btn-secondary" style={{ width: '100%', marginTop: '0.25rem' }} onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>

          </div>
        )}

        {activeTab === 'access' && (
          <div className="mob-tab-panel" key={`access-${tabKey}`}>
            <h3 className="mob-section-title">
              <span className="mob-section-icon access"><Users size={16} /></span>
              Access Desk Scan
            </h3>

            {/* QR Scanner camera graphic */}
            <div className="mob-card" style={{ padding: '0.5rem' }}>
              <div className="scanner-viewport">
                {isScanning ? (
                  <div className="scanner-scanning-msg">
                    <Loader2 size={28} className="spin" />
                    <p>Opening camera… point at the visitor QR code</p>
                  </div>
                ) : (
                  <>
                    <div className="scanner-laser" />
                    <div className="scanner-target-box">
                      <QrCode size={40} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.35)' }} />
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="mob-btn mob-btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.65rem' }} onClick={handleScanQrBadge} disabled={isScanning}>
                  {isScanning ? 'Scanning…' : 'Scan Visitor QR Code'}
                </button>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
                Tap scan — your camera opens to capture the QR. Formats: JSON, Name|ID|Company|Plate, or plain name.
              </p>
            </div>
            
            <form onSubmit={handleAddVisitor} className="mob-card elevated">
              <label className="mob-field-label">Visitor Full Name</label>
              <input className="mob-input" value={vName} onChange={e => setVName(e.target.value)} placeholder="e.g. Samuel Moyo" required />

              <label className="mob-field-label">National ID / Passport</label>
              <input className="mob-input" value={vIdNumber} onChange={e => setVIdNumber(e.target.value)} placeholder="ID-442291-B" required />

              <label className="mob-field-label">Company Represented</label>
              <input className="mob-input" value={vCompany} onChange={e => setVCompany(e.target.value)} placeholder="e.g. DHL Courier ZW" />

              <label className="mob-field-label">Vehicle Plate (Optional)</label>
              <input className="mob-input" value={vPlate} onChange={e => setVPlate(e.target.value)} placeholder="e.g. ADV-7201-ZW" style={{ marginBottom: '1rem' }} />

              <button type="submit" className="mob-btn mob-btn-success">
                <UserCheck size={16} /> Register Access Entry
              </button>
            </form>

            {activeVisitors.length > 0 && (
              <div className="mob-card" style={{ marginTop: '0.75rem' }}>
                <div className="mob-card-label">Active on site ({activeVisitors.length})</div>
                {activeVisitors.map((v) => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--mob-border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)' }}>{v.company || '—'} · {v.idNumber}</div>
                    </div>
                    <button type="button" className="mob-btn mob-btn-secondary mob-btn-sm" onClick={() => handleCheckoutVisitor(v.id)}>
                      Check out
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom tab bar */}
      <nav className="mob-nav">
        <button className={`mob-nav-item ${activeTab === 'patrol' ? 'active' : ''}`} onClick={() => switchTab('patrol')}>
          <span className="mob-nav-icon-wrap">
            <Shield size={18} />
            {overdueCount > 0 && activeTab !== 'patrol' && (
              <span className="mob-nav-badge">{overdueCount}</span>
            )}
          </span>
          <span>Patrol</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'incidents' ? 'active' : ''}`} onClick={() => switchTab('incidents')}>
          <span className="mob-nav-icon-wrap"><AlertTriangle size={18} /></span>
          <span>Incident</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'checklists' ? 'active' : ''}`} onClick={() => switchTab('checklists')}>
          <span className="mob-nav-icon-wrap"><FileText size={18} /></span>
          <span>Audit</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => switchTab('profile')}>
          <span className="mob-nav-icon-wrap"><UserCheck size={18} /></span>
          <span>My Profile</span>
        </button>
        <button className={`mob-nav-item ${activeTab === 'access' ? 'active' : ''}`} onClick={() => switchTab('access')}>
          <span className="mob-nav-icon-wrap"><Users size={18} /></span>
          <span>Access</span>
        </button>
      </nav>
      </>
      )}
    </div>
  );
}
