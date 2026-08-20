'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './premisesMap.css';
import { isValidGpsCoord } from '../../lib/guards';

const DEFAULT_CENTER = [-17.8292, 31.0522];
const DEFAULT_ZOOM = 12;

const BASEMAP_OPTIONS = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'terrain', label: 'Terrain' },
];

const FALLBACK_TILE = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 20,
};

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.google?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-titan-gmaps]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.titanGmaps = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
}

function premiseMarkerIcon(label) {
  return L.divIcon({
    className: '',
    html: `<div class="premises-map-marker">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function guardMarkerIcon(label) {
  return L.divIcon({
    className: '',
    html: `<div class="premises-map-marker guard">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function placeMarkerIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="premises-map-marker place">•</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function popupHtml(title, lines) {
  const body = lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('');
  return `<div class="premises-map-popup"><h4>${title}</h4>${body}</div>`;
}

export default function PremisesMapPanel({
  premises = [],
  places = {},
  guards = [],
  attendance = [],
  geofenceRadiusMeters = 6,
  height = 420,
  showPlaces = false,
  selectedPremiseId = null,
  title = 'Protected Premises Map',
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ markers: [], circles: [], basemap: null });
  const googleReady = useRef(false);
  const [basemap, setBasemap] = useState('roadmap');
  const [mapReady, setMapReady] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mappedPremises = premises.filter((p) => isValidGpsCoord(p.coordinates?.lat, p.coordinates?.lng));
  const onDuty = attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    const fallback = L.tileLayer(FALLBACK_TILE.url, {
      attribution: FALLBACK_TILE.attribution,
      maxZoom: FALLBACK_TILE.maxZoom,
    });
    fallback.addTo(map);
    layersRef.current.basemap = fallback;
    mapInstance.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstance.current = null;
      layersRef.current = { markers: [], circles: [], basemap: null };
    };
  }, []);

  useEffect(() => {
    if (!googleKey || googleReady.current) return;
    loadGoogleMapsScript(googleKey)
      .then(async () => {
        await import('leaflet.gridlayer.googlemutant');
        googleReady.current = true;
        setGoogleAvailable(true);
      })
      .catch(() => {
        googleReady.current = false;
        setGoogleAvailable(false);
      });
  }, [googleKey]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const applyBasemap = async () => {
      if (layersRef.current.basemap) {
        map.removeLayer(layersRef.current.basemap);
        layersRef.current.basemap = null;
      }

      if (googleAvailable && googleKey) {
        try {
          await import('leaflet.gridlayer.googlemutant');
          if (window.google?.maps && L.gridLayer?.googleMutant) {
            const layer = L.gridLayer.googleMutant({ type: basemap, maxZoom: 21 });
            layer.addTo(map);
            layersRef.current.basemap = layer;
            return;
          }
        } catch (_) {
          /* fall through to Carto */
        }
      }

      const fallback = L.tileLayer(FALLBACK_TILE.url, {
        attribution: FALLBACK_TILE.attribution,
        maxZoom: FALLBACK_TILE.maxZoom,
      });
      fallback.addTo(map);
      layersRef.current.basemap = fallback;
    };

    applyBasemap();
  }, [basemap, googleAvailable, googleKey, mapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    layersRef.current.markers.forEach((m) => map.removeLayer(m));
    layersRef.current.circles.forEach((c) => map.removeLayer(c));
    layersRef.current.markers = [];
    layersRef.current.circles = [];

    const bounds = L.latLngBounds([]);

    mappedPremises.forEach((premise, idx) => {
      const { lat, lng } = premise.coordinates;
      const latlng = [lat, lng];
      bounds.extend(latlng);

      const isSelected = selectedPremiseId === premise.id;
      const marker = L.marker(latlng, {
        icon: premiseMarkerIcon(String(idx + 1)),
        zIndexOffset: isSelected ? 1000 : 0,
      });
      const acc = premise.coordinates.accuracyMeters;
      marker.bindPopup(
        popupHtml(premise.name, [
          premise.address,
          premise.suburb ? `${premise.suburb}${premise.city ? `, ${premise.city}` : ''}` : premise.city,
          acc ? `GPS accuracy: ±${acc}m` : 'GPS accuracy: not recorded',
          `Geofence: ${geofenceRadiusMeters}m`,
        ])
      );
      marker.addTo(map);
      layersRef.current.markers.push(marker);

      const circle = L.circle(latlng, {
        radius: geofenceRadiusMeters,
        color: isSelected ? '#1b4332' : '#40916c',
        weight: isSelected ? 2 : 1,
        fillColor: '#1b4332',
        fillOpacity: isSelected ? 0.12 : 0.06,
      });
      circle.addTo(map);
      layersRef.current.circles.push(circle);

      if (showPlaces) {
        const premisePlaces = places[premise.id] || [];
        premisePlaces.forEach((place) => {
          if (!isValidGpsCoord(place.coordinates?.lat, place.coordinates?.lng)) return;
          const pl = [place.coordinates.lat, place.coordinates.lng];
          bounds.extend(pl);
          const pm = L.marker(pl, { icon: placeMarkerIcon() });
          pm.bindPopup(popupHtml(place.name, [place.type, place.description].filter(Boolean)));
          pm.addTo(map);
          layersRef.current.markers.push(pm);
        });
      }
    });

    onDuty.forEach((att) => {
      const guard = guards.find((g) => g.id === att.guardId);
      const premise = premises.find((p) => p.id === att.premiseId);
      const coords = att.lastCoords || att.clockInCoords;
      if (!isValidGpsCoord(coords?.lat, coords?.lng)) return;
      const latlng = [coords.lat, coords.lng];
      bounds.extend(latlng);
      const initials = (guard?.fullName || 'G').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const marker = L.marker(latlng, { icon: guardMarkerIcon(initials) });
      marker.bindPopup(
        popupHtml(guard?.fullName || 'On-duty guard', [
          premise?.name ? `At: ${premise.name}` : null,
          `Since ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        ])
      );
      marker.addTo(map);
      layersRef.current.markers.push(marker);
    });

    if (mappedPremises.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [
    mappedPremises,
    premises,
    places,
    guards,
    onDuty,
    geofenceRadiusMeters,
    showPlaces,
    selectedPremiseId,
    mapReady,
  ]);

  if (mappedPremises.length === 0) {
    return (
      <div className="premises-map-empty" style={{ minHeight: height }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{title}</p>
        <p style={{ fontSize: '0.85rem' }}>No premises with GPS coordinates yet.</p>
        <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
          Register a site and capture GPS on location (±10m accuracy) to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="premises-map-root" style={{ minHeight: height }}>
      <div ref={mapRef} style={{ minHeight: height }} />
      <div className="premises-map-stats">
        <strong>{mappedPremises.length}</strong> site{mappedPremises.length !== 1 ? 's' : ''} mapped
        {onDuty.length > 0 && <> · <strong>{onDuty.length}</strong> on duty</>}
      </div>
      {googleAvailable && (
        <div className="premises-map-toolbar">
          <select
            className="premises-map-basemap-select"
            value={basemap}
            onChange={(e) => setBasemap(e.target.value)}
            aria-label="Basemap style"
          >
            {BASEMAP_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="premises-map-legend">
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#1b4332' }} /> Premises
        </span>
        <span className="premises-map-legend-item">
          <span className="premises-map-legend-dot" style={{ background: '#2563eb' }} /> On-duty guard
        </span>
        {showPlaces && (
          <span className="premises-map-legend-item">
            <span className="premises-map-legend-dot" style={{ background: '#10b981' }} /> Patrol place
          </span>
        )}
        <span className="premises-map-legend-item">
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #40916c', display: 'inline-block' }} /> {geofenceRadiusMeters}m geofence
        </span>
      </div>
    </div>
  );
}
