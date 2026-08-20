'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Layers, Minus, Plus } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './premisesMap.css';
import { isValidGpsCoord } from '../../lib/guards';
import {
  BASEMAPS,
  DEFAULT_BASEMAP_ID,
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

const MARKER_STYLES = {
  premise: { fill: '#1b4332', stroke: '#86efac', label: 'SITE' },
  place: { fill: '#047857', stroke: '#6ee7b7', label: 'P' },
  checkpoint: { fill: '#1d4ed8', stroke: '#93c5fd', label: 'NFC' },
  guard: { fill: '#1e40af', stroke: '#60a5fa', label: 'G' },
  alert: { fill: '#b91c1c', stroke: '#fca5a5', label: '!' },
  sos: { fill: '#7f1d1d', stroke: '#f87171', label: 'SOS' },
  activity: { fill: '#6d28d9', stroke: '#c4b5fd', label: '•' },
};

function svgPin(fill, stroke, label, size = 36) {
  const h = Math.round(size * 1.22);
  return `
    <div style="filter: drop-shadow(0px 5px 10px rgba(0,0,0,0.45));">
      <svg width="${size}" height="${h}" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.61116 0 0 7.61116 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
        <circle cx="17" cy="16" r="8" fill="#0f172a"/>
        <text x="17" y="19.5" fill="${stroke}" font-size="${label.length > 2 ? 6 : 7.5}" font-weight="900" font-family="sans-serif" text-anchor="middle">${label}</text>
      </svg>
    </div>`;
}

function pinIcon(kind, label = '', extraClass = '') {
  const style = MARKER_STYLES[kind] || MARKER_STYLES.activity;
  const pinLabel = kind === 'premise' && label ? label.slice(0, 3).toUpperCase() : style.label;
  const size = kind === 'sos' ? 40 : kind === 'activity' ? 28 : kind === 'place' ? 30 : 36;
  return L.divIcon({
    className: `custom-leaflet-marker ${extraClass}`,
    html: svgPin(style.fill, style.stroke, pinLabel, size),
    iconSize: [size, Math.round(size * 1.22)],
    iconAnchor: [size / 2, Math.round(size * 1.22)],
    popupAnchor: [0, -Math.round(size * 1.1)],
  });
}

function popupHtml(title, tag, tagColor, lines, coords = null) {
  const body = lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('');
  const tagEl = tag ? `<span class="popup-tag" style="background:${tagColor}33;color:${tagColor}">${tag}</span>` : '';
  const coordsEl = coords
    ? `<button type="button" class="popup-coords-btn" data-coords="${coords.lat},${coords.lng}">Copy GPS</button>`
    : '';
  return `<div class="premises-map-popup">${tagEl}<h4>${title}</h4>${body}${coordsEl}</div>`;
}

function activityClass(type) {
  if (type === 'SOS Panic Alarm') return 'sos';
  if (type === 'Patrol Tap') return 'patrol';
  if (type === 'Shift Clock-In' || type === 'Shift Clock-Out') return 'clock';
  return '';
}

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
  const basemapPanelRef = useRef(null);
  const fitOnceRef = useRef(false);
  const highlightRef = useRef(null);

  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [layers, setLayers] = useState(DEFAULT_LAYER_VISIBILITY);
  const [mapReady, setMapReady] = useState(false);

  const currentBasemap = BASEMAPS[basemapId] || BASEMAPS[DEFAULT_BASEMAP_ID];

  const selectBasemap = (id) => {
    setBasemapId(id);
    setBasemapOpen(false);
  };

  const zoomIn = () => mapInstance.current?.zoomIn();
  const zoomOut = () => mapInstance.current?.zoomOut();

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
      zoomControl: false,
      attributionControl: true,
    });

    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    overlayRef.current = L.featureGroup().addTo(map);
    mapInstance.current = map;
    setMapReady(true);

    map.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('.popup-coords-btn');
      if (!btn) return;
      btn.onclick = () => {
        const text = btn.getAttribute('data-coords') || '';
        navigator.clipboard?.writeText(text);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy GPS'; }, 1500);
      };
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      overlayRef.current = null;
      basemapRef.current = null;
      fitOnceRef.current = false;
    };
  }, [compact]);

  useEffect(() => {
    if (!basemapOpen) return undefined;
    const close = (e) => {
      if (basemapPanelRef.current && !basemapPanelRef.current.contains(e.target)) {
        setBasemapOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [basemapOpen]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const cfg = BASEMAPS[basemapId] || BASEMAPS[DEFAULT_BASEMAP_ID];
    if (basemapRef.current) map.removeLayer(basemapRef.current);
    basemapRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
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
            icon: pinIcon('premise', premise.name.slice(0, 3)),
            zIndexOffset: isSelected ? 900 : 100,
          });
          marker.bindPopup(
            popupHtml(premise.name, 'Premises', '#86efac', [
              premise.address,
              [premise.suburb, premise.city].filter(Boolean).join(', ') || null,
              territory ? `Territory: ${territory.name}` : 'Territory: unassigned',
              premise.coordinates.accuracyMeters
                ? `GPS ±${premise.coordinates.accuracyMeters}m`
                : null,
              `${onSite} guard(s) on duty · ${placeCount} patrol place(s)`,
              `Geofence radius: ${geofenceRadiusMeters}m`,
            ], { lat, lng })
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
              icon: pinIcon('guard'),
            });
            marker.bindPopup(
              popupHtml(guard?.fullName || 'On-duty guard', 'Live guard', '#60a5fa', [
                premise ? `Site: ${premise.name}` : null,
                `Status: ${att.status}`,
                `Clock-in: ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                att.lateMinutes > 5 ? `Late by ${att.lateMinutes} min` : null,
                att.needsMovementAck ? '⚠ Movement check required' : null,
                att.geofenceViolation ? '⚠ Outside geofence' : null,
              ], pos)
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
        const sosMarker = L.marker([sosPos.lat, sosPos.lng], { icon: pinIcon('sos') });
        sosMarker.bindPopup(
          popupHtml('SOS PANIC', 'Emergency', '#f87171', [
            activeSos.guardName ? `Guard: ${activeSos.guardName}` : null,
            activeSos.message || 'Emergency signal active',
            activeSos.timestamp ? `Since ${new Date(activeSos.timestamp).toLocaleTimeString()}` : null,
          ], sosPos)
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
        <p className="gis-panel-title">Sites on map</p>
        <div className="gis-site-list">
          {mappedPremises.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>No GPS-verified sites yet.</p>
          ) : (
            mappedPremises.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`gis-site-item ${selectedPremiseId === p.id ? 'active' : ''}`}
                onClick={() => flyToCoords(p.coordinates, 17)}
              >
                <strong>{p.name}</strong>
                <span>{p.coordinates.accuracyMeters ? `±${p.coordinates.accuracyMeters}m` : 'GPS locked'}</span>
              </button>
            ))
          )}
        </div>
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
        <div className="premises-map-hud-stats">
          <span><em>{stats.premises}</em> sites</span>
          <span><em>{stats.onDuty}</em> on duty</span>
          <span><em>{stats.checkpoints}</em> NFC</span>
          <span><em>{stats.alerts}</em> alerts</span>
          {stats.sos > 0 && <span className="sos-flash">SOS ACTIVE</span>}
        </div>
      </div>

      <div className="premises-map-controls-tr">
        <button type="button" className="premises-map-ctrl-btn" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" className="premises-map-ctrl-btn" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" className="premises-map-ctrl-btn premises-map-ctrl-fit" onClick={fitAll}>
          Fit all sites
        </button>
      </div>

      <div ref={basemapPanelRef} className={`premises-map-basemap-panel ${basemapOpen ? 'open' : ''}`}>
        {basemapOpen && (
          <div className="premises-map-basemap-list" role="listbox" aria-label="Basemap options">
            {Object.values(BASEMAPS).map((b) => (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={basemapId === b.id}
                className={`premises-map-basemap-option ${basemapId === b.id ? 'active' : ''}`}
                onClick={() => selectBasemap(b.id)}
              >
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="premises-map-basemap-toggle"
          onClick={() => setBasemapOpen((o) => !o)}
          aria-expanded={basemapOpen}
          aria-label="Toggle basemap menu"
        >
          <Layers size={14} />
          <span>{currentBasemap.icon}</span>
          <span className="premises-map-basemap-toggle-label">{currentBasemap.label}</span>
          <ChevronDown size={14} className={`premises-map-basemap-chevron ${basemapOpen ? 'open' : ''}`} />
        </button>
      </div>

      {compact && (
        <div className="premises-map-legend">
          <span className="premises-map-legend-item">
            <span className="premises-map-legend-dot" style={{ background: '#40916c' }} /> Premises
          </span>
          <span className="premises-map-legend-item">
            <span className="premises-map-legend-dot" style={{ background: '#60a5fa' }} /> Guards
          </span>
          <span className="premises-map-legend-item">
            <span className="premises-map-legend-dot" style={{ background: '#ef4444' }} /> Alerts
          </span>
        </div>
      )}
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
