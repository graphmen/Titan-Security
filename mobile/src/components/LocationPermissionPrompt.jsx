import React, { useState } from 'react';
import { MapPin, Shield, Camera, Settings } from 'lucide-react';
import { requestEssentialPermissions } from '../utils/permissions';
import { markLocationPermissionPrompted } from '../utils/location';
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
      const { location } = await requestEssentialPermissions();
      if (location.granted) {
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
        <h2 id="loc-perm-title" className="loc-perm-title">Permissions required</h2>
        <p className="loc-perm-text">
          {appName} needs location and camera access for shift clock-in, SOS alerts, incident photos, and on-site GPS capture.
        </p>
        <ul className="loc-perm-list">
          <li><Shield size={14} /> Location — clock-in geofence and SOS coordinates</li>
          <li><MapPin size={14} /> GPS capture at premises and checkpoints</li>
          <li><Camera size={14} /> Camera — incident photos and profile pictures</li>
        </ul>

        {denied && (
          <p className="loc-perm-denied">
            <Settings size={14} />
            A permission was denied. Open Settings → Apps → {appName} → Permissions, then allow Location and Camera.
          </p>
        )}

        <button
          type="button"
          className="loc-perm-btn loc-perm-btn-primary"
          onClick={handleAllow}
          disabled={busy}
        >
          {busy ? 'Requesting…' : denied ? 'Try again' : 'Allow permissions'}
        </button>
        <button type="button" className="loc-perm-btn loc-perm-btn-secondary" onClick={finish} disabled={busy}>
          {denied ? 'Continue without permissions' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
