import React, { useState } from 'react';
import { MapPin, Building2, Settings } from 'lucide-react';
import {
  requestLocationPermission,
  markLocationPermissionPrompted,
} from '../utils/location';
import { APP_VERSION_CODE } from '../config';

export default function LocationPermissionPrompt({ appName, onDone }) {
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const finish = () => {
    markLocationPermissionPrompted(APP_VERSION_CODE);
    onDone?.();
  };

  const handleAllow = async () => {
    setBusy(true);
    setDenied(false);
    try {
      const { granted } = await requestLocationPermission();
      if (granted) {
        finish();
      } else {
        setDenied(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="loc-perm-overlay" role="dialog" aria-modal="true" aria-labelledby="loc-perm-title">
      <div className="loc-perm-card">
        <div className="loc-perm-icon-wrap">
          <MapPin size={28} strokeWidth={2} />
        </div>
        <h2 id="loc-perm-title" className="loc-perm-title">Location access required</h2>
        <p className="loc-perm-text">
          {appName} needs your location to capture premises coordinates and verify site GPS for your guards.
        </p>
        <ul className="loc-perm-list">
          <li><Building2 size={14} /> Register premises and important place coordinates</li>
          <li><MapPin size={14} /> Enable guard geofence clock-in at your sites</li>
        </ul>

        {denied && (
          <p className="loc-perm-denied">
            <Settings size={14} />
            Permission was denied. Open phone Settings → Apps → {appName} → Permissions → Location → Allow.
          </p>
        )}

        <button
          type="button"
          className="loc-perm-btn loc-perm-btn-primary"
          onClick={handleAllow}
          disabled={busy}
        >
          {busy ? 'Requesting…' : denied ? 'Try again' : 'Allow location access'}
        </button>
        <button type="button" className="loc-perm-btn loc-perm-btn-secondary" onClick={finish} disabled={busy}>
          {denied ? 'Continue without GPS' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
