import React, { useState } from 'react';
import { MapPin, Shield, Settings } from 'lucide-react';
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
          {appName} needs your location for shift clock-in, geofence verification, SOS alerts, and on-site GPS capture.
        </p>
        <ul className="loc-perm-list">
          <li><Shield size={14} /> Clock-in only works when you are at the premises</li>
          <li><MapPin size={14} /> SOS sends your live coordinates to Command Centre</li>
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
