'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Layers, Minus, Plus, Ruler, Search, Siren } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './premisesMap.css';
import { isValidGpsCoord } from '../../lib/guards';
import {
  BASEMAPS,
  DEFAULT_BASEMAP_ID,
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
import {
  ACTIVITY_WINDOWS,
  EXTENDED_DEFAULT_LAYERS,
  LAYER_PRESETS,
  buildPatrolRoutes,
  buildHeatmapCells,
  buildSearchIndex,
  checkpointDisplayStatus,
  enrichedPremisePopupLines,
  filterActivityByWindow,
  filterSearchIndex,
  formatMeasureDistance,
  gpsQualityLevel,
  guardStatusStyle,
  haversineMeters,
  placesForPremise,
  resolveHeatmapEvents,
  territoryStats,
  todayShifts,
} from '../../lib/mapEnhancements';

const MARKER_STYLES = {
  premise: { fill: '#1b4332', stroke: '#86efac', label: 'SITE' },
  place: { fill: '#b91c1c', stroke: '#fca5a5', label: 'P' },
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

function pinIcon(kind, label = '', extraClass = '', colors = null) {
  const style = colors || MARKER_STYLES[kind] || MARKER_STYLES.activity;
  const pinLabel = kind === 'premise' && label ? label.slice(0, 3).toUpperCase() : (colors?.label || style.label);
  const size = kind === 'sos' ? 40 : kind === 'premise' ? 36 : kind === 'place' ? 22 : kind === 'activity' ? 28 : 36;
  const fill = colors?.fill || style.fill;
  const stroke = colors?.stroke || style.stroke;
  return L.divIcon({
    className: `custom-leaflet-marker ${extraClass} ${colors?.pulse ? 'gis-marker-pulse' : ''}`,
    html: svgPin(fill, stroke, pinLabel, size),
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
  { key: 'gpsQuality', label: 'GPS accuracy rings', color: '#22c55e' },
  { key: 'places', label: 'Patrol places', color: '#ef4444' },
  { key: 'patrolRoutes', label: 'Patrol routes', color: '#059669' },
  // checkpoints hidden until NFC patrol is enabled on the map
  { key: 'guards', label: 'Live guards', color: '#60a5fa' },
  { key: 'trails', label: 'Movement trails', color: '#2563eb' },
  { key: 'shiftRoster', label: "Today's shifts", color: '#f59e0b' },
  { key: 'alerts', label: 'Active alerts', color: '#ef4444' },
  { key: 'activity', label: 'Recent activity', color: '#a78bfa' },
  { key: 'heatmap', label: 'Activity heatmap', color: '#ec4899' },
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
  shifts = [],
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

  const measureLayerRef = useRef(null);
  const sosFlewRef = useRef(false);

  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [layers, setLayers] = useState(EXTENDED_DEFAULT_LAYERS);
  const [mapReady, setMapReady] = useState(false);
  const [activityWindowId, setActivityWindowId] = useState('24h');
  const [territoryFilter, setTerritoryFilter] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

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

  const activityWindow = ACTIVITY_WINDOWS.find((w) => w.id === activityWindowId) || ACTIVITY_WINDOWS[1];

  const filteredPremises = useMemo(() => {
    let list = premises.filter((p) => isValidGpsCoord(p.coordinates?.lat, p.coordinates?.lng));
    if (territoryFilter) list = list.filter((p) => p.territoryId === territoryFilter);
    return list;
  }, [premises, territoryFilter]);

  const mappedPremises = filteredPremises;

  const shiftsToday = useMemo(() => todayShifts(shifts), [shifts]);

  const searchIndex = useMemo(
    () => buildSearchIndex({ premises, guards, places, checkpoints, territories }),
    [premises, guards, places, checkpoints, territories]
  );

  const searchResults = useMemo(
    () => filterSearchIndex(searchIndex, mapSearch),
    [searchIndex, mapSearch]
  );

  const filteredAttendance = useMemo(() => {
    if (!territoryFilter) return attendance;
    const siteIds = new Set(premises.filter((p) => p.territoryId === territoryFilter).map((p) => p.id));
    return attendance.filter((a) => siteIds.has(a.premiseId));
  }, [attendance, premises, territoryFilter]);

  const activityForWindow = useMemo(
    () => filterActivityByWindow(occurrenceBook, activityWindow.ms).slice(0, 50),
    [occurrenceBook, activityWindow.ms]
  );

  const heatmapEvents = useMemo(
    () => resolveHeatmapEvents(occurrenceBook, ctx, activityWindow.ms),
    [occurrenceBook, ctx, activityWindow.ms]
  );

  const onDutyGuards = useMemo(
    () => filteredAttendance.filter((a) => a.status === 'On Duty' || a.status === 'Late'),
    [filteredAttendance]
  );

  const applyPreset = (presetId) => {
    const preset = LAYER_PRESETS[presetId];
    if (preset) setLayers({ ...EXTENDED_DEFAULT_LAYERS, ...preset.layers });
  };

  const resolveSearchTarget = (item) => {
    if (item.coords) return item.coords;
    if (item.guardId) {
      const att = onDutyGuards.find((a) => a.guardId === item.guardId);
      return coordsFrom(att?.lastCoords) || coordsFrom(att?.clockInCoords);
    }
    if (item.territoryId) {
      const b = territoryBounds(item.territoryId, premises);
      return b?.center || null;
    }
    return null;
  };

  const stats = useMemo(
    () => countMapStats({ premises, places, checkpoints, attendance, guardAlerts, occurrenceBook, activeSos }),
    [premises, places, checkpoints, attendance, guardAlerts, occurrenceBook, activeSos]
  );

  const recentActivity = activityForWindow;

  const measureDistance = measurePoints.length === 2
    ? haversineMeters(measurePoints[0], measurePoints[1])
    : null;

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

  const flyToSos = useCallback(() => {
    const pos = parseSosCoords(activeSos, attendance, guards);
    if (pos) flyToCoords(pos, 18);
  }, [activeSos, attendance, guards, flyToCoords]);

  useEffect(() => {
    if (!activeSos?.active || sosFlewRef.current) return;
    const pos = parseSosCoords(activeSos, attendance, guards);
    if (pos && mapInstance.current) {
      mapInstance.current.flyTo([pos.lat, pos.lng], 18, { duration: 1 });
      sosFlewRef.current = true;
    }
    if (!activeSos?.active) sosFlewRef.current = false;
  }, [activeSos, attendance, guards]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return undefined;

    const onMapClick = (e) => {
      if (!measureMode) return;
      setMeasurePoints((prev) => {
        const next = [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }];
        return next.length > 2 ? next.slice(-2) : next;
      });
    };

    map.on('click', onMapClick);
    return () => map.off('click', onMapClick);
  }, [measureMode, mapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    if (measureLayerRef.current) {
      map.removeLayer(measureLayerRef.current);
      measureLayerRef.current = null;
    }
    if (measurePoints.length === 0) return;

    const fg = L.featureGroup();
    measurePoints.forEach((pt, i) => {
      L.circleMarker([pt.lat, pt.lng], {
        radius: 6, color: '#fbbf24', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 2,
      }).bindPopup(i === 0 ? 'Point A' : 'Point B').addTo(fg);
    });
    if (measurePoints.length === 2) {
      const dist = haversineMeters(measurePoints[0], measurePoints[1]);
      L.polyline(
        measurePoints.map((p) => [p.lat, p.lng]),
        { color: '#fbbf24', weight: 3, dashArray: '6 4' }
      ).bindPopup(`Distance: ${formatMeasureDistance(dist)}`).addTo(fg);
    }
    fg.addTo(map);
    measureLayerRef.current = fg;
  }, [measurePoints, mapReady]);

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
      setMapReady(false);
    };
  }, [compact]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return undefined;
    const fixSize = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // ignore resize errors on unmounted map
      }
    };
    fixSize();
    const t1 = setTimeout(fixSize, 50);
    const t2 = setTimeout(fixSize, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady, compact, showSidebar]);

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
        if (territoryFilter && t.id !== territoryFilter) return;
        const bounds = territoryBounds(t.id, premises);
        if (!bounds) return;
        const ts = territoryStats(t.id, { premises, attendance, guardAlerts });
        const rect = L.rectangle(
          [[bounds.south, bounds.west], [bounds.north, bounds.east]],
          { color: '#f59e0b', weight: 1.5, dashArray: '6 4', fillColor: '#fbbf24', fillOpacity: 0.08 }
        );
        rect.bindPopup(popupHtml(t.name, 'Territory', '#f59e0b', [
          `${ts.sites} site(s) · ${ts.onDuty} on duty · ${ts.alerts} alert(s)`,
          t.city ? `City: ${t.city}` : null,
        ]));
        rect.addTo(group);
        extendBounds.push([bounds.south, bounds.west], [bounds.north, bounds.east]);
      });
    }

    if (layers.patrolRoutes) {
      buildPatrolRoutes(places).forEach((route) => {
        if (territoryFilter) {
          const prem = premises.find((p) => p.id === route.premiseId);
          if (prem?.territoryId !== territoryFilter) return;
        }
        const line = L.polyline(route.points, {
          color: '#059669', weight: 2, opacity: 0.75, dashArray: '8 6',
        });
        const prem = premises.find((p) => p.id === route.premiseId);
        line.bindPopup(popupHtml(prem?.name || 'Patrol route', 'Patrol route', '#059669', [
          `${route.names.length} checkpoint(s) linked`,
          route.names.join(' → '),
        ]));
        line.addTo(group);
        route.points.forEach((pt) => extendBounds.push(pt));
      });
    }

    if (layers.heatmap) {
      const cells = buildHeatmapCells(
        heatmapEvents.map((e) => ({ lat: e._mapLat, lng: e._mapLng })),
        filteredAttendance
      );
      cells.forEach((cell) => {
        L.circle([cell.lat, cell.lng], {
          radius: 40 + cell.intensity * 80,
          color: '#ec4899',
          weight: 0,
          fillColor: '#ec4899',
          fillOpacity: 0.12 + cell.intensity * 0.35,
        }).addTo(group);
      });
    }

    if (layers.premises || layers.geofences) {
      mappedPremises.forEach((premise) => {
        const { lat, lng } = premise.coordinates;
        const latlng = [lat, lng];
        extendBounds.push(latlng);
        const isSelected = selectedPremiseId === premise.id;
        const territory = territories.find((t) => t.id === premise.territoryId);
        const onSite = filteredAttendance.filter(
          (a) => a.premiseId === premise.id && (a.status === 'On Duty' || a.status === 'Late')
        );
        const placeCount = placesForPremise(places, premise.id).length;
        const gq = gpsQualityLevel(premise);

        if (layers.gpsQuality) {
          L.circle(latlng, {
            radius: gq.level === 'good' ? 12 : gq.level === 'poor' ? 18 : 8,
            color: gq.color,
            weight: 2,
            fillColor: gq.color,
            fillOpacity: 0.12,
            dashArray: gq.level === 'none' ? '4 4' : null,
          }).addTo(group);
        }

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
            icon: pinIcon('premise', (premise.name || 'Site').slice(0, 3)),
            zIndexOffset: isSelected ? 900 : 100,
          });
          marker.bindPopup(
            popupHtml(premise.name || 'Site', 'Premises', '#86efac', enrichedPremisePopupLines(premise, {
              territory,
              onDutyAttendance: onSite,
              placeCount,
              geofenceRadiusMeters,
              guardAlerts,
              shiftsToday,
              guards,
            }), { lat, lng })
          );
          marker.addTo(group);
        }
      });
    }

    if (layers.places) {
      mappedPremises.forEach((premise) => {
        placesForPremise(places, premise.id).forEach((place) => {
          const c = coordsFrom(place.coordinates);
          if (!c) return;
          extendBounds.push([c.lat, c.lng]);
          const marker = L.marker([c.lat, c.lng], {
            icon: pinIcon('place'),
            zIndexOffset: 50,
          });
          marker.bindPopup(
            popupHtml(place.name, 'Patrol place', '#ef4444', [
              `Site: ${premise.name}`,
              place.type ? `Type: ${place.type}` : null,
              place.description || null,
              place.hasNfc ? `NFC: ${place.nfcCode || 'configured'}` : 'No NFC',
              place.schedule ? `Schedule: ${place.schedule}` : null,
              place.coordinates?.accuracyMeters ? `GPS ±${place.coordinates.accuracyMeters}m` : null,
            ], c)
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
        const cpStat = checkpointDisplayStatus(cp);
        const marker = L.marker([c.lat, c.lng], {
          icon: pinIcon('checkpoint', '', cpStat.tone === 'overdue' ? 'gis-marker-pulse' : '', {
            fill: cpStat.tone === 'ok' ? '#15803d' : cpStat.tone === 'overdue' ? '#b91c1c' : '#1d4ed8',
            stroke: cpStat.tone === 'ok' ? '#86efac' : cpStat.tone === 'overdue' ? '#fca5a5' : '#93c5fd',
            label: 'NFC',
            pulse: cpStat.tone === 'overdue',
          }),
        });
        marker.bindPopup(
          popupHtml(cp.name, 'NFC checkpoint', cpStat.color, [
            cp.premiseName ? `Site: ${cp.premiseName}` : null,
            `Code: ${cp.code || '—'}`,
            `Status: ${cpStat.label}`,
            cp.lastScanned ? `Last scan: ${new Date(cp.lastScanned).toLocaleString()}` : 'Not scanned yet',
            cp.schedule ? `Schedule: ${cp.schedule}` : null,
          ], c)
        );
        marker.addTo(group);
      });
    }

    if (layers.shiftRoster) {
      shiftsToday.forEach((shift) => {
        const prem = premises.find((p) => p.id === shift.premiseId);
        const c = coordsFrom(prem?.coordinates);
        if (!c) return;
        const alreadyOn = filteredAttendance.some(
          (a) => a.guardId === shift.guardId && a.premiseId === shift.premiseId && (a.status === 'On Duty' || a.status === 'Late')
        );
        if (alreadyOn) return;
        const guard = guards.find((g) => g.id === shift.guardId);
        const offset = [c.lat + 0.00008, c.lng + 0.00008];
        extendBounds.push(offset);
        const marker = L.marker(offset, {
          icon: pinIcon('activity', '', '', {
            fill: '#b45309', stroke: '#fcd34d', label: 'S', pulse: false,
          }),
        });
        marker.bindPopup(popupHtml(guard?.fullName || 'Scheduled guard', 'Shift roster', '#f59e0b', [
          prem ? `Site: ${prem.name}` : null,
          `Date: ${shift.date}`,
          `${shift.startTime || '—'} – ${shift.endTime || '—'}`,
          shift.status ? `Status: ${shift.status}` : 'Not clocked in yet',
        ]));
        marker.addTo(group);
      });
    }

    if (layers.trails || layers.guards) {
      onDutyGuards.forEach((att) => {
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
            const gStyle = guardStatusStyle(att);
            if (att.geofenceViolation) {
              L.circle([pos.lat, pos.lng], {
                radius: geofenceRadiusMeters * 2,
                color: '#ef4444',
                weight: 2,
                dashArray: '5 5',
                fillColor: '#ef4444',
                fillOpacity: 0.08,
              }).addTo(group);
            }
            const marker = L.marker([pos.lat, pos.lng], {
              icon: pinIcon('guard', '', gStyle.pulse ? 'gis-marker-pulse' : '', gStyle),
            });
            const premiseCoords = coordsFrom(premise?.coordinates);
            const distFromSite = premiseCoords ? haversineMeters(pos, premiseCoords) : null;
            marker.bindPopup(
              popupHtml(guard?.fullName || 'On-duty guard', gStyle.status, gStyle.stroke, [
                premise ? `Site: ${premise.name}` : null,
                `Status: ${att.status}`,
                `Clock-in: ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                att.lateMinutes > 5 ? `Late by ${att.lateMinutes} min` : null,
                att.needsMovementAck ? '⚠ Movement check required' : null,
                att.geofenceViolation ? '⚠ Outside geofence' : null,
                distFromSite != null ? `Distance from site pin: ${formatMeasureDistance(distFromSite)}` : null,
                att.lastMovementAt ? `Last GPS: ${new Date(att.lastMovementAt).toLocaleTimeString()}` : null,
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
    filteredAttendance,
    onDutyGuards,
    checkpoints,
    guardAlerts,
    recentActivity,
    heatmapEvents,
    shiftsToday,
    activeSos,
    territories,
    territoryFilter,
    geofenceRadiusMeters,
    selectedPremiseId,
    compact,
    mapReady,
    ctx,
  ]);

  const sidebarContent = (
    <>
      <div className="gis-panel">
        <p className="gis-panel-title">Search map</p>
        <div className="gis-map-search-wrap">
          <Search size={14} className="gis-map-search-icon" />
          <input
            type="search"
            className="gis-map-search-input"
            placeholder="Site, guard, NFC, place…"
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="gis-map-search-results">
            {searchResults.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="gis-map-search-item"
                onClick={() => {
                  const target = resolveSearchTarget(item);
                  if (target) flyToCoords(target, 17);
                  setMapSearch('');
                }}
              >
                <span className="gis-map-search-type">{item.type}</span>
                <strong>{item.label}</strong>
                {item.sub && <span>{item.sub}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">View presets</p>
        <div className="gis-preset-row">
          {Object.entries(LAYER_PRESETS).map(([id, preset]) => (
            <button key={id} type="button" className="gis-preset-btn" onClick={() => applyPreset(id)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">Filters</p>
        <label className="gis-filter-label">
          Territory
          <select
            className="gis-filter-select"
            value={territoryFilter}
            onChange={(e) => setTerritoryFilter(e.target.value)}
          >
            <option value="">All territories</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="gis-filter-label" style={{ marginTop: '0.5rem' }}>
          Activity window
          <select
            className="gis-filter-select"
            value={activityWindowId}
            onChange={(e) => setActivityWindowId(e.target.value)}
          >
            {ACTIVITY_WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">Live operations</p>
        <div className="gis-stat-grid">
          <div className="gis-stat"><strong>{stats.premises}</strong><span>Sites mapped</span></div>
          <div className="gis-stat"><strong>{stats.onDuty}</strong><span>Guards on duty</span></div>
          <div className="gis-stat"><strong>{onDutyGuards.filter((a) => a.geofenceViolation).length}</strong><span>Geofence issues</span></div>
          <div className="gis-stat"><strong>{stats.alerts}</strong><span>Active alerts</span></div>
          <div className="gis-stat"><strong>{stats.checkpoints}</strong><span>NFC points</span></div>
          <div className="gis-stat"><strong>{recentActivity.length}</strong><span>Events ({activityWindow.label})</span></div>
        </div>
        {stats.sos > 0 && (
          <button type="button" className="gis-sos-btn" onClick={flyToSos}>
            <Siren size={14} /> SOS active — fly to location
          </button>
        )}
      </div>

      <div className="gis-panel">
        <p className="gis-panel-title">On-duty guards</p>
        <div className="gis-site-list">
          {onDutyGuards.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>No guards on duty right now.</p>
          ) : (
            onDutyGuards.map((att) => {
              const guard = guards.find((g) => g.id === att.guardId);
              const prem = premises.find((p) => p.id === att.premiseId);
              const gStyle = guardStatusStyle(att);
              return (
                <button
                  key={att.id}
                  type="button"
                  className="gis-site-item"
                  style={{ borderLeftColor: gStyle.fill }}
                  onClick={() => {
                    const pos = coordsFrom(att.lastCoords) || coordsFrom(att.clockInCoords);
                    if (pos) flyToCoords(pos, 18);
                  }}
                >
                  <strong>{guard?.fullName || 'Guard'}</strong>
                  <span>{prem?.name || 'Unknown site'} · {gStyle.status}</span>
                </button>
              );
            })
          )}
        </div>
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
        <p style={{ fontSize: '0.85rem' }}>Register premises and capture GPS on site (±5m) to populate the operations map.</p>
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
        <button
          type="button"
          className={`premises-map-ctrl-btn premises-map-ctrl-fit ${measureMode ? 'active' : ''}`}
          onClick={() => { setMeasureMode((m) => !m); setMeasurePoints([]); }}
          title="Measure distance"
        >
          <Ruler size={14} style={{ marginRight: 4 }} /> Measure
        </button>
      </div>

      {measureMode && (
        <div className="premises-map-measure-banner">
          Click two points on the map to measure distance.
          {measureDistance != null && ` · ${formatMeasureDistance(measureDistance)}`}
          <button type="button" onClick={() => setMeasurePoints([])}>Clear</button>
        </div>
      )}

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
            <span className="premises-map-legend-dot" style={{ background: '#ef4444' }} /> Places
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
