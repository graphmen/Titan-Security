'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './premisesMap.css';
import { isValidGpsCoord } from '../../lib/guards';
import {
  BASEMAPS,
  DEFAULT_LAYER_VISIBILITY,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  activityColor,
  coordsFrom,
  countMapStats,
  parseSosCoords,
  resolveAlertCoords,
  resolveObEventCoords,
  territoryBounds,
} from '../../lib/mapLayers';

const LAYER_DEFS = [
  { key: 'premises', label: 'Protected premises', color: '#40916c' },
  { key: 'geofences', label: 'Clock-in geofences', color: '#86efac' },
  { key: 'places', label: 'Patrol places', color: '#10b981' },
  { key: 'checkpoints', label: 'NFC checkpoints', color: '#3b82f6' },
  { key: 'guards', label: 'Live guards', color: '#60a5fa' },
  { key: 'trails', label: 'Movement trails', color: '#2563eb' },
  { key: 'alerts', label: 'Active alerts', color: '#ef4444' },
  { key: 'activity', label: 'Recent activity (24h)', color: '#a78bfa' },
  { key: 'territories', label: 'Territory zones', color: '#f59e0b' },
];

function pinIcon(kind, label = '', extraClass = '') {
  const emoji = {
    premise: '🏢',
    place: '📍',
    checkpoint: '📡',
    guard: '🛡️',
    alert: '⚠️',
    sos: '🆘',
    activity: '•',
  }[kind] || '•';

  return L.divIcon({
    className: '',
    html: `<div class="gis-pin ${kind} ${extraClass}"><div class="gis-pin-body"><span>${emoji}</span></div>${label ? `<div class="gis-pin-label">${label}</div>` : ''}</div>`,
    iconSize: label ? [120, 52] : [40, 40],
    iconAnchor: label ? [60, 40] : [20, 36],
  });
}

function popupHtml(title, tag, tagColor, lines) {
  const body = lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('');
  const tagEl = tag ? `<span class="popup-tag" style="background:${tagColor}22;color:${tagColor}">${tag}</span>` : '';
  return `<div class="premises-map-popup">${tagEl}<h4>${title}</h4>${body}</div>`;
}

function activityClass(type) {
  if (type === 'SOS Panic Alarm') return 'sos';
  if (type === 'Patrol Tap') return 'patrol';
  if (type === 'Shift Clock-In' || type === 'Shift Clock-Out') return 'clock';
  return '';
}

export default function PremisesMapPanel({
  premises = [],
  places = {},
  guards = [],
  attendance = [],
  checkpoints = [],
  guardAlerts = [],
  occurrenceBook = [],
  activeSos = null,
  territories = [],
  geofenceRadiusMeters = 6,
  height = 560,
  showSidebar = false,
  compact = false,
  selectedPremiseId = null,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const overlayRef = useRef(null);
  const basemapRef = useRef(null);
  const fitOnceRef = useRef(false);
  const highlightRef = useRef(null);

  const [basemapId, setBasemapId] = useState('light');
  const [layers, setLayers] = useState(DEFAULT_LAYER_VISIBILITY);
  const [mapReady, setMapReady] = useState(false);

  const ctx = useMemo(
    () => ({ guards, attendance, premises, checkpoints }),
    [guards, attendance, premises, checkpoints]
  );

  const mappedPremises = useMemo(
    () => premises.filter((p) => isValidGpsCoord(p.coordinates?.lat, p.coordinates?.lng)),
    [premises]
  );

  const stats = useMemo(
    () => countMapStats({ premises, places, checkpoints, attendance, guardAlerts, occurrenceBook, activeSos }),
    [premises, places, checkpoints, attendance, guardAlerts, occurrenceBook, activeSos]
  );

  const recentActivity = useMemo(
    () =>
      occurrenceBook
        .filter((ob) => Date.now() - new Date(ob.timestamp).getTime() < 24 * 60 * 60 * 1000)
        .slice(0, 30),
    [occurrenceBook]
  );

  const toggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fitAll = useCallback(() => {
    const map = mapInstance.current;
    const group = overlayRef.current;
    if (!map || !group) return;
    const bounds = group.getBounds?.();
    if (bounds?.isValid()) {
      map.fitBounds(bounds.pad(0.12), { maxZoom: compact ? 16 : 15 });
    } else if (mappedPremises.length > 0) {
      const b = L.latLngBounds(mappedPremises.map((p) => [p.coordinates.lat, p.coordinates.lng]));
      map.fitBounds(b.pad(0.12), { maxZoom: compact ? 16 : 15 });
    } else {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }
  }, [compact, mappedPremises]);

  const flyToCoords = useCallback((coords, zoom = 17) => {
    if (!coords || !mapInstance.current) return;
    mapInstance.current.flyTo([coords.lat, coords.lng], zoom, { duration: 0.8 });
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: !compact,
      attributionControl: true,
    });

    if (compact) {
      L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    overlayRef.current = L.featureGroup().addTo(map);
    mapInstance.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstance.current = null;
      overlayRef.current = null;
      basemapRef.current = null;
      fitOnceRef.current = false;
    };
  }, [compact]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const cfg = BASEMAPS[basemapId] || BASEMAPS.light;
    if (basemapRef.current) map.removeLayer(basemapRef.current);
    basemapRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
  }, [basemapId, mapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    const group = overlayRef.current;
    if (!map || !group || !mapReady) return;

    group.clearLayers();
    if (highlightRef.current) {
      map.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }

    const extendBounds = [];

    if (layers.territories) {
      territories.forEach((t) => {
        const bounds = territoryBounds(t.id, premises);
        if (!bounds) return;
        const rect = L.rectangle(
          [[bounds.south, bounds.west], [bounds.north, bounds.east]],
          { color: '#f59e0b', weight: 1.5, dashArray: '6 4', fillColor: '#fbbf24', fillOpacity: 0.08 }
        );
        rect.bindPopup(popupHtml(t.name, 'Territory', '#f59e0b', [
          `${premises.filter((p) => p.territoryId === t.id).length} site(s) in zone`,
          t.city ? `City: ${t.city}` : null,
        ]));
        rect.addTo(group);
        extendBounds.push([bounds.south, bounds.west], [bounds.north, bounds.east]);
      });
    }

    if (layers.premises || layers.geofences) {
      mappedPremises.forEach((premise) => {
        const { lat, lng } = premise.coordinates;
        const latlng = [lat, lng];
        extendBounds.push(latlng);
        const isSelected = selectedPremiseId === premise.id;
        const territory = territories.find((t) => t.id === premise.territoryId);
        const onSite = attendance.filter(
          (a) => a.premiseId === premise.id && (a.status === 'On Duty' || a.status === 'Late')
        ).length;
        const placeCount = (places[premise.id] || []).length;

        if (layers.geofences) {
          L.circle(latlng, {
            radius: geofenceRadiusMeters,
            color: isSelected ? '#86efac' : '#40916c',
            weight: isSelected ? 2 : 1,
            fillColor: '#1b4332',
            fillOpacity: isSelected ? 0.14 : 0.07,
          }).addTo(group);
        }

        if (layers.premises) {
          const marker = L.marker(latlng, {
            icon: pinIcon('premise', compact ? '' : premise.name.slice(0, 18)),
            zIndexOffset: isSelected ? 900 : 100,
          });
          marker.bindPopup(
            popupHtml(premise.name, 'Premises', '#1b4332', [
              premise.address,
              [premise.suburb, premise.city].filter(Boolean).join(', ') || null,
              territory ? `Territory: ${territory.name}` : 'Territory: unassigned',
              premise.coordinates.accuracyMeters
                ? `GPS ±${premise.coordinates.accuracyMeters}m`
                : null,
              `${onSite} guard(s) on duty · ${placeCount} patrol place(s)`,
              `Geofence radius: ${geofenceRadiusMeters}m`,
            ])
          );
          marker.addTo(group);
        }
      });
    }

    if (layers.places) {
      mappedPremises.forEach((premise) => {
        (places[premise.id] || []).forEach((place) => {
          const c = coordsFrom(place.coordinates);
          if (!c) return;
          extendBounds.push([c.lat, c.lng]);
          const marker = L.marker([c.lat, c.lng], { icon: pinIcon('place') });
          marker.bindPopup(
            popupHtml(place.name, 'Patrol place', '#10b981', [
              `Site: ${premise.name}`,
              place.type ? `Type: ${place.type}` : null,
              place.description || null,
              place.hasNfc ? `NFC: ${place.nfcCode || 'configured'}` : 'No NFC',
              place.schedule ? `Schedule: ${place.schedule}` : null,
            ])
          );
          marker.addTo(group);
        });
      });
    }

    if (layers.checkpoints) {
      checkpoints.forEach((cp) => {
        const c = coordsFrom(cp.coordinates);
        if (!c) return;
        extendBounds.push([c.lat, c.lng]);
        const scanned = cp.status === 'Scanned';
        const marker = L.marker([c.lat, c.lng], {
          icon: pinIcon('checkpoint', '', scanned ? 'scanned' : ''),
        });
        marker.bindPopup(
          popupHtml(cp.name, 'NFC checkpoint', scanned ? '#16a34a' : '#2563eb', [
            cp.premiseName ? `Site: ${cp.premiseName}` : null,
            `Code: ${cp.code || '—'}`,
            `Status: ${cp.status || 'Pending'}`,
            cp.lastScanned ? `Last scan: ${new Date(cp.lastScanned).toLocaleString()}` : 'Not scanned yet',
            cp.schedule ? `Schedule: ${cp.schedule}` : null,
          ])
        );
        marker.addTo(group);
      });
    }

    if (layers.trails || layers.guards) {
      attendance
        .filter((a) => a.status === 'On Duty' || a.status === 'Late')
        .forEach((att) => {
          const guard = guards.find((g) => g.id === att.guardId);
          const premise = premises.find((p) => p.id === att.premiseId);
          const trail = att.movementTrail || [];
          const validTrail = trail.filter((pt) => isValidGpsCoord(pt.lat, pt.lng));

          if (layers.trails && validTrail.length > 1) {
            const line = L.polyline(
              validTrail.map((pt) => [pt.lat, pt.lng]),
              { color: '#2563eb', weight: 3, opacity: 0.75, dashArray: '4 8' }
            );
            line.bindPopup(
              popupHtml(guard?.fullName || 'Guard trail', 'Movement trail', '#2563eb', [
                `${validTrail.length} GPS point(s) recorded`,
                premise ? `Assigned site: ${premise.name}` : null,
              ])
            );
            line.addTo(group);
            validTrail.forEach((pt) => extendBounds.push([pt.lat, pt.lng]));
          }

          if (layers.guards) {
            const pos = coordsFrom(att.lastCoords) || coordsFrom(att.clockInCoords);
            if (!pos) return;
            extendBounds.push([pos.lat, pos.lng]);
            const marker = L.marker([pos.lat, pos.lng], {
              icon: pinIcon('guard', compact ? '' : (guard?.fullName?.split(' ')[0] || 'Guard')),
            });
            marker.bindPopup(
              popupHtml(guard?.fullName || 'On-duty guard', 'Live guard', '#2563eb', [
                premise ? `Site: ${premise.name}` : null,
                `Status: ${att.status}`,
                `Clock-in: ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                att.lateMinutes > 5 ? `Late by ${att.lateMinutes} min` : null,
                att.needsMovementAck ? '⚠ Movement check required' : null,
                att.geofenceViolation ? '⚠ Outside geofence' : null,
              ])
            );
            marker.addTo(group);
          }
        });
    }

    if (layers.alerts) {
      guardAlerts
        .filter((a) => a.status === 'Active')
        .forEach((alert) => {
          const pos = resolveAlertCoords(alert, ctx);
          if (!pos) return;
          extendBounds.push([pos.lat, pos.lng]);
          const marker = L.marker([pos.lat, pos.lng], { icon: pinIcon('alert') });
          marker.bindPopup(
            popupHtml(alert.guardName || 'Alert', alert.type?.replace(/_/g, ' ') || 'Alert', '#ef4444', [
              alert.message,
              alert.severity ? `Severity: ${alert.severity}` : null,
              alert.premiseId ? `Premise ID: ${alert.premiseId}` : null,
            ])
          );
          marker.addTo(group);
        });

      const sosPos = parseSosCoords(activeSos, attendance, guards);
      if (activeSos?.active && sosPos) {
        extendBounds.push([sosPos.lat, sosPos.lng]);
        L.circle([sosPos.lat, sosPos.lng], {
          radius: Math.max(geofenceRadiusMeters * 3, 25),
          color: '#dc2626',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 0.15,
        }).addTo(group);
        const sosMarker = L.marker([sosPos.lat, sosPos.lng], { icon: pinIcon('sos', 'SOS') });
        sosMarker.bindPopup(
          popupHtml('SOS PANIC', 'Emergency', '#dc2626', [
            activeSos.guardName ? `Guard: ${activeSos.guardName}` : null,
            activeSos.message || 'Emergency signal active',
            activeSos.timestamp ? `Since ${new Date(activeSos.timestamp).toLocaleTimeString()}` : null,
          ])
        );
        sosMarker.addTo(group);
      }
    }

    if (layers.activity) {
      recentActivity.forEach((ob) => {
        const pos = resolveObEventCoords(ob, ctx);
        if (!pos) return;
        extendBounds.push([pos.lat, pos.lng]);
        const color = activityColor(ob.type);
        const marker = L.marker([pos.lat, pos.lng], { icon: pinIcon('activity') });
        marker.bindPopup(
          popupHtml(ob.type, 'Activity', color, [
            ob.guardName ? `Guard: ${ob.guardName}` : null,
            ob.description,
            new Date(ob.timestamp).toLocaleString(),
            ob.status ? `Status: ${ob.status}` : null,
          ])
        );
        marker.addTo(group);
      });
    }

    if (!fitOnceRef.current && extendBounds.length > 0) {
      const b = L.latLngBounds(extendBounds);
      if (b.isValid()) {
        map.fitBounds(b.pad(0.12), { maxZoom: compact ? 16 : 15 });
        fitOnceRef.current = true;
      }
    }
  }, [
    layers,
    mappedPremises,
    premises,
    places,
    guards,
    attendance,
    checkpoints,
    guardAlerts,
    recentActivity,
    activeSos,
    territories,
    geofenceRadiusMeters,
    selectedPremiseId,
    compact,
    mapReady,
    ctx,
  ]);

  const sidebarContent = (
    <>
      <div className="gis-panel">
        <p className="gis-panel-title">Live operations</p>
        <div className="gis-stat-grid">
          <div className="gis-stat"><strong>{stats.premises}</strong><span>Sites mapped</span></div>
          <div className="gis-stat"><strong>{stats.onDuty}</strong><span>Guards on duty</span></div>
          <div className="gis-stat"><strong>{stats.checkpoints}</strong><span>NFC points</span></div>
          <div className="gis-stat"><strong>{stats.alerts}</strong><span>Active alerts</span></div>
          <div className="gis-stat"><strong>{stats.places}</strong><span>Patrol places</span></div>
          <div className="gis-stat"><strong>{stats.activity}</strong><span>Events (24h)</span></div>
        </div>
        {stats.sos > 0 && (
          <p style={{ margin: '0.65rem 0 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>
            SOS panic signal active — check map
          </p>
        )}
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">Map layers</p>
        <div className="gis-layer-list">
          {LAYER_DEFS.map(({ key, label, color }) => (
            <label key={key} className="gis-layer-item">
              <input type="checkbox" checked={!!layers[key]} onChange={() => toggleLayer(key)} />
              <span className="gis-layer-dot" style={{ background: color }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">Recent activity</p>
        <div className="gis-activity-feed">
          {recentActivity.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>No mapped events in the last 24 hours.</p>
          ) : (
            recentActivity.map((ob) => (
              <button
                key={ob.id}
                type="button"
                className={`gis-activity-item ${activityClass(ob.type)}`}
                style={{ textAlign: 'left', width: '100%', border: '1px solid #e2e8f0' }}
                onClick={() => {
                  const pos = resolveObEventCoords(ob, ctx);
                  if (pos) flyToCoords(pos);
                }}
              >
                <strong>{ob.type}</strong>
                <span>{ob.guardName ? `${ob.guardName} · ` : ''}{new Date(ob.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  if (mappedPremises.length === 0 && stats.checkpoints === 0) {
    const empty = (
      <div className="premises-map-empty" style={{ minHeight: height }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>GIS map awaiting site data</p>
        <p style={{ fontSize: '0.85rem' }}>Register premises and capture GPS on site (±10m) to populate the operations map.</p>
        <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
          Patrol places, NFC checkpoints, guard trails, and live alerts will appear here automatically.
        </p>
      </div>
    );
    if (!showSidebar) return empty;
    return (
      <div className="gis-map-page">
        <aside className="gis-map-sidebar">{sidebarContent}</aside>
        <div className="gis-map-stage">{empty}</div>
      </div>
    );
  }

  const mapCanvas = (
    <div
      className={`premises-map-root ${compact ? 'premises-map-compact' : ''}`}
      style={{ minHeight: height, height: showSidebar ? '100%' : height }}
    >
      <div ref={mapRef} style={{ height: '100%', minHeight: height }} />

      <div className="premises-map-hud">
        <strong>Titan GIS Operations Map</strong>
        <p>
          {stats.premises} sites · {stats.onDuty} on duty · {stats.checkpoints} checkpoints
          {stats.sos ? ' · SOS ACTIVE' : ''}
        </p>
      </div>

      <div className="premises-map-toolbar">
        <div className="premises-map-toolbar-row">
          <select
            className="premises-map-basemap-select"
            value={basemapId}
            onChange={(e) => setBasemapId(e.target.value)}
            aria-label="Basemap"
          >
            {Object.values(BASEMAPS).map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
          <button type="button" className="premises-map-btn" onClick={fitAll}>
            Fit all
          </button>
        </div>
      </div>

      <div className="premises-map-legend">
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#40916c' }} /> Premises
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#10b981' }} /> Places
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#3b82f6' }} /> NFC
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#60a5fa' }} /> Guards
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-line" style={{ background: '#2563eb' }} /> Trails
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#ef4444' }} /> Alerts
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#a78bfa' }} /> Activity
        </span>
      </div>
    </div>
  );

  if (!showSidebar) return mapCanvas;

  return (
    <div className="gis-map-page">
      <aside className="gis-map-sidebar">{sidebarContent}</aside>
      <div className="gis-map-stage">{mapCanvas}</div>
    </div>
  );
}
