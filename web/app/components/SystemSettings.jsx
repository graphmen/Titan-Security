'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  MapPin,
  Clock,
  FileWarning,
  RefreshCw,
  Bell,
  Activity,
  Check,
} from 'lucide-react';

const PANELS = {
  menu: { title: 'System Settings' },
  alerts: { title: 'Alerts & Sirens', subtitle: 'Command Centre audio and panic notifications' },
  gps: { title: 'GPS & Geofencing', subtitle: 'Clock-in radius and site boundary rules' },
  patrol: { title: 'Patrol Monitoring', subtitle: 'Movement checks for guards on active shifts' },
  compliance: { title: 'License Compliance', subtitle: 'PSIRA expiry warnings for supervisors' },
};

function MenuRow({ icon: Icon, label, hint, value, onClick }) {
  return (
    <button type="button" className="sys-settings-menu-row" onClick={onClick}>
      <span className="sys-settings-menu-icon">
        <Icon size={16} />
      </span>
      <span className="sys-settings-menu-text">
        <span className="sys-settings-menu-label">{label}</span>
        {hint && <span className="sys-settings-menu-hint">{hint}</span>}
      </span>
      {value ? (
        <span className="sys-settings-menu-value">{value}</span>
      ) : (
        <ChevronRight size={14} className="sys-settings-menu-chevron" />
      )}
    </button>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`sys-settings-toggle ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="sys-settings-toggle-thumb" />
    </button>
  );
}

function SelectSetting({ label, hint, value, options, onChange, disabled, suffix = '' }) {
  return (
    <div className="sys-settings-field">
      <div className="sys-settings-field-head">
        <span className="sys-settings-field-label">{label}</span>
        {hint && <span className="sys-settings-field-hint">{hint}</span>}
      </div>
      <select
        className="form-select sys-settings-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}{suffix}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SystemSettings({
  systemSettings = {},
  dataSource,
  stats = {},
  onUpdateSettings,
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState('menu');
  const [savingKey, setSavingKey] = useState(null);
  const rootRef = useRef(null);

  const connected = dataSource === 'supabase';

  const save = async (key, value) => {
    setSavingKey(key);
    try {
      await onUpdateSettings({ [key]: value });
    } finally {
      setSavingKey(null);
    }
  };

  const close = () => {
    setOpen(false);
    setPanel('menu');
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const renderPanelBody = () => {
    switch (panel) {
      case 'alerts':
        return (
          <div className="sys-settings-panel-body">
            <div className="sys-settings-toggle-row">
              <div>
                <div className="sys-settings-field-label">Siren on critical alerts</div>
                <div className="sys-settings-field-hint">Plays in Command Centre when SOS or critical guard alerts arrive.</div>
              </div>
              <Toggle
                on={!!systemSettings.sirenAlertsEnabled}
                disabled={savingKey === 'sirenAlertsEnabled'}
                onChange={(v) => save('sirenAlertsEnabled', v)}
              />
            </div>
            <div className="sys-settings-info-card">
              <Bell size={14} />
              <span>Linked to Command Centre, guard alerts, and active SOS signals.</span>
            </div>
          </div>
        );
      case 'gps':
        return (
          <div className="sys-settings-panel-body">
            <SelectSetting
              label="Geofence radius"
              hint="Guards must be within this distance to clock in at a premises."
              value={systemSettings.geofenceRadiusMeters ?? 800}
              options={[200, 400, 600, 800, 1000, 1500, 2000]}
              suffix="m"
              disabled={savingKey === 'geofenceRadiusMeters'}
              onChange={(v) => save('geofenceRadiusMeters', v)}
            />
            <div className="sys-settings-info-card">
              <MapPin size={14} />
              <span>Also used for geofence-exit alerts while guards are on duty.</span>
            </div>
          </div>
        );
      case 'patrol':
        return (
          <div className="sys-settings-panel-body">
            <SelectSetting
              label="No-movement threshold"
              hint="Raise a patrol check alert if GPS shows no movement for this long."
              value={systemSettings.noMovementAlertMinutes ?? 45}
              options={[15, 30, 45, 60, 90]}
              suffix=" min"
              disabled={savingKey === 'noMovementAlertMinutes'}
              onChange={(v) => save('noMovementAlertMinutes', v)}
            />
            <div className="sys-settings-info-card">
              <Activity size={14} />
              <span>Supervisors see these alerts under Guard Management and Command Centre.</span>
            </div>
          </div>
        );
      case 'compliance':
        return (
          <div className="sys-settings-panel-body">
            <SelectSetting
              label="License warning window"
              hint="Notify supervisors before a guard PSIRA license expires."
              value={systemSettings.licenseExpiryWarningDays ?? 60}
              options={[14, 30, 60, 90]}
              suffix=" days"
              disabled={savingKey === 'licenseExpiryWarningDays'}
              onChange={(v) => save('licenseExpiryWarningDays', v)}
            />
            <div className="sys-settings-info-card">
              <FileWarning size={14} />
              <span>Critical alerts fire within 14 days of expiry regardless of this window.</span>
            </div>
          </div>
        );
      default:
        return (
          <>
            <div className="sys-settings-stats-strip">
              <span>{stats.guards ?? 0} guards</span>
              <span>{stats.premises ?? 0} sites</span>
              <span>{stats.onDuty ?? 0} on duty</span>
            </div>
            <div className="sys-settings-menu-group">
              <MenuRow
                icon={systemSettings.sirenAlertsEnabled ? Volume2 : VolumeX}
                label="Alerts & Sirens"
                hint="Command Centre audio"
                value={systemSettings.sirenAlertsEnabled ? 'On' : 'Off'}
                onClick={() => setPanel('alerts')}
              />
              <MenuRow
                icon={MapPin}
                label="GPS & Geofencing"
                hint={`${systemSettings.geofenceRadiusMeters ?? 800}m radius`}
                onClick={() => setPanel('gps')}
              />
              <MenuRow
                icon={Clock}
                label="Patrol Monitoring"
                hint={`${systemSettings.noMovementAlertMinutes ?? 45} min threshold`}
                onClick={() => setPanel('patrol')}
              />
              <MenuRow
                icon={FileWarning}
                label="License Compliance"
                hint={`${systemSettings.licenseExpiryWarningDays ?? 60} day warning`}
                onClick={() => setPanel('compliance')}
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="sys-settings-root" ref={rootRef}>
      {open && (
        <div className="sys-settings-popover animate-fade-in">
          <div className="sys-settings-popover-header">
            {panel !== 'menu' ? (
              <button type="button" className="sys-settings-back" onClick={() => setPanel('menu')}>
                <ChevronLeft size={16} />
              </button>
            ) : (
              <span className="sys-settings-header-icon">
                <Settings size={15} />
              </span>
            )}
            <div className="sys-settings-header-text">
              <strong>{PANELS[panel].title}</strong>
              {PANELS[panel].subtitle && (
                <span>{PANELS[panel].subtitle}</span>
              )}
              {panel === 'menu' && (
                <span className="sys-settings-header-sub">
                  <span className={`sys-settings-dot ${connected ? 'is-live' : ''}`} />
                  {connected ? 'Live server' : 'Local demo'} · {stats.guards ?? 0} guards registered
                </span>
              )}
            </div>
          </div>

          <div className="sys-settings-popover-body">{renderPanelBody()}</div>

          {panel === 'menu' && savingKey && (
            <div className="sys-settings-saving">
              <RefreshCw size={12} className="spin" /> Saving…
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`sys-settings-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="sys-settings-trigger-avatar">
          <img src="/emblem-light.jpg" alt="" />
        </span>
        <span className="sys-settings-trigger-text">
          <span className="sys-settings-trigger-title">System Settings</span>
          <span className="sys-settings-trigger-sub">
            {connected ? (
              <><Check size={11} /> Connected</>
            ) : (
              <>Configure & sync</>
            )}
          </span>
        </span>
        <Settings size={16} className="sys-settings-trigger-gear" />
      </button>
    </div>
  );
}
