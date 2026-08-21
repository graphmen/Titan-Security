import React, { useEffect, useState } from 'react';
import { Compass, Navigation, MapPin } from 'lucide-react';
import { getLocation } from '../utils/location';
import {
  bearingDegrees,
  compassDirection,
  formatDistance,
  haversineMeters,
  isWithinRadiusMeters,
  openMapsNavigation,
} from '../utils/navigation';

export default function SiteGuide({ target, radiusMeters = 6, compact = false }) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState('');

  const lat = target?.lat ?? target?.coordinates?.lat;
  const lng = target?.lng ?? target?.coordinates?.lng;
  const name = target?.name || 'Site';

  useEffect(() => {
    if (lat == null || lng == null) return undefined;
    let cancelled = false;

    const refresh = async () => {
      try {
        const fix = await getLocation();
        if (!cancelled) {
          setPos(fix);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'GPS unavailable');
      }
    };

    refresh();
    const id = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lng]);

  if (lat == null || lng == null) return null;

  const distance = pos ? haversineMeters(pos.lat, pos.lng, lat, lng) : null;
  const bearing = pos ? bearingDegrees(pos.lat, pos.lng, lat, lng) : null;
  const inside = pos ? isWithinRadiusMeters(pos.lat, pos.lng, lat, lng, radiusMeters) : false;

  return (
    <div className={`mob-site-guide ${compact ? 'compact' : ''}`}>
      <div className="mob-site-guide-head">
        <MapPin size={14} />
        <span>{name}</span>
        {inside && <span className="mob-site-guide-in">In zone</span>}
      </div>
      <div className="mob-site-guide-body">
        <div
          className="mob-compass"
          style={{ transform: bearing != null ? `rotate(${bearing}deg)` : undefined }}
          aria-hidden
        >
          <Compass size={compact ? 28 : 36} />
          <span className="mob-compass-n">N</span>
        </div>
        <div className="mob-site-guide-stats">
          <div className="mob-site-guide-stat">
            <span className="label">Distance</span>
            <strong>{distance != null ? formatDistance(distance) : '…'}</strong>
          </div>
          <div className="mob-site-guide-stat">
            <span className="label">Bearing</span>
            <strong>{bearing != null ? `${Math.round(bearing)}° ${compassDirection(bearing)}` : '…'}</strong>
          </div>
          <div className="mob-site-guide-stat">
            <span className="label">Clock-in zone</span>
            <strong>{radiusMeters}m</strong>
          </div>
        </div>
      </div>
      {error && <p className="mob-site-guide-error">{error}</p>}
      <button
        type="button"
        className="mob-btn mob-btn-secondary mob-nav-btn"
        onClick={() => openMapsNavigation(lat, lng, name)}
      >
        <Navigation size={14} /> Navigate to point
      </button>
    </div>
  );
}
