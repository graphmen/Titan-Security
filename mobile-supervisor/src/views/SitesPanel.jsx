import React, { useState } from 'react';
import { Building2, MapPin, Navigation, Plus, Pencil, Loader2 } from 'lucide-react';
import { getLocationForPremiseCapture, PREMISE_MAX_ACCURACY_METERS } from '../utils/location';

function SiteLoadingBanner({ title, subtitle }) {
  return (
    <div className="mob-site-loading" role="status" aria-live="polite">
      <Loader2 size={32} className="mob-site-loading-spinner" aria-hidden="true" />
      <p className="mob-site-loading-title">{title}</p>
      {subtitle ? <p className="mob-site-loading-sub">{subtitle}</p> : null}
      <div className="mob-progress-bar" aria-hidden="true">
        <div className="mob-progress-bar-fill" />
      </div>
    </div>
  );
}

function getLoadingState(gpsCapturing, saving) {
  if (saving === 'premise') {
    return { title: 'Saving site…', subtitle: 'Registering premises — please wait' };
  }
  if (saving === 'place') {
    return { title: 'Adding patrol place…', subtitle: 'Saving place to your site' };
  }
  if (gpsCapturing === 'premise') {
    return { title: 'Acquiring GPS…', subtitle: 'Hold still outdoors — locking ±5m fix (10–20s warmup, up to 60s)' };
  }
  if (gpsCapturing === 'place') {
    return { title: 'Acquiring GPS…', subtitle: 'Stand at the patrol point — hold still for a precise ±5m fix' };
  }
  if (typeof gpsCapturing === 'string' && gpsCapturing.startsWith('update-')) {
    return { title: 'Updating site GPS…', subtitle: 'Hold still outdoors — stabilizing precise location' };
  }
  return null;
}

const emptyPremise = (territoryId = '') => ({
  name: '', address: '', city: 'Harare', suburb: '', territoryId, ownerName: '', ownerContact: '', lat: '', lng: '', accuracyMeters: '',
});

export default function SitesPanel({
  territories,
  premises,
  places,
  onAction,
  showToast,
}) {
  const [premiseForm, setPremiseForm] = useState(emptyPremise());
  const [placeForm, setPlaceForm] = useState({
    premiseId: '', name: '', type: 'Patrol Point', description: '', lat: '', lng: '', accuracyMeters: '', hasNfc: true, schedule: 'Every 2 hours',
  });
  const [editingPremiseId, setEditingPremiseId] = useState(null);
  const [gpsCapturing, setGpsCapturing] = useState(null);
  const [saving, setSaving] = useState(null);

  const isBusy = Boolean(gpsCapturing || saving);
  const loadingState = getLoadingState(gpsCapturing, saving);

  const captureGps = async (target, premiseId = null) => {
    setGpsCapturing(target === 'update' && premiseId ? `update-${premiseId}` : target);
    showToast('Hold still outdoors — GPS warming up (±5m target)…', 'info');
    try {
      const { lat, lng, accuracy } = await getLocationForPremiseCapture();
      const coords = {
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        accuracyMeters: Math.round(accuracy),
      };
      if (target === 'premise') {
        setPremiseForm((f) => ({ ...f, ...coords }));
        showToast(`GPS captured ${coords.accuracyMeters ? `±${coords.accuracyMeters}m` : ''}`);
      } else if (target === 'place') {
        setPlaceForm((f) => ({ ...f, ...coords }));
        showToast(`GPS captured ±${coords.accuracyMeters}m`);
      } else if (premiseId) {
        await onAction('UPDATE_PREMISE', {
          premiseId,
          updates: {
            lat: parseFloat(coords.lat),
            lng: parseFloat(coords.lng),
            accuracyMeters: coords.accuracyMeters,
          },
        });
        showToast(`Site GPS updated ±${coords.accuracyMeters}m`);
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGpsCapturing(null);
    }
  };

  const handleSavePremise = async (e) => {
    e.preventDefault();
    if (!premiseForm.name || !premiseForm.address || !premiseForm.territoryId) {
      showToast('Name, address and territory required', 'error');
      return;
    }
    if (!premiseForm.lat || !premiseForm.lng || !premiseForm.accuracyMeters) {
      showToast(`Capture GPS on site first (±${PREMISE_MAX_ACCURACY_METERS}m required)`, 'error');
      return;
    }
    setSaving('premise');
    try {
      if (editingPremiseId) {
        await onAction('UPDATE_PREMISE', {
          premiseId: editingPremiseId,
          updates: {
            name: premiseForm.name,
            address: premiseForm.address,
            city: premiseForm.city,
            suburb: premiseForm.suburb,
            ownerName: premiseForm.ownerName,
            ownerContact: premiseForm.ownerContact,
            lat: parseFloat(premiseForm.lat),
            lng: parseFloat(premiseForm.lng),
            accuracyMeters: parseFloat(premiseForm.accuracyMeters),
          },
        });
        showToast('Site updated');
      } else {
        await onAction('CREATE_PREMISE', {
          name: premiseForm.name,
          address: premiseForm.address,
          city: premiseForm.city,
          suburb: premiseForm.suburb,
          territoryId: premiseForm.territoryId,
          ownerName: premiseForm.ownerName,
          ownerContact: premiseForm.ownerContact,
          lat: parseFloat(premiseForm.lat),
          lng: parseFloat(premiseForm.lng),
          accuracyMeters: parseFloat(premiseForm.accuracyMeters),
        });
        showToast(`Site registered: ${premiseForm.name}`);
      }
      setPremiseForm(emptyPremise(premiseForm.territoryId));
      setEditingPremiseId(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const startEditPremise = (p) => {
    setEditingPremiseId(p.id);
    setPremiseForm({
      name: p.name,
      address: p.address || '',
      city: p.city || 'Harare',
      suburb: p.suburb || '',
      territoryId: p.territoryId || '',
      ownerName: p.ownerName || '',
      ownerContact: p.ownerContact || '',
      lat: p.coordinates?.lat?.toString() || '',
      lng: p.coordinates?.lng?.toString() || '',
      accuracyMeters: p.coordinates?.accuracyMeters?.toString() || '',
    });
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    if (!placeForm.premiseId || !placeForm.name) {
      showToast('Select a site and enter place name', 'error');
      return;
    }
    if (!placeForm.lat || !placeForm.lng || !placeForm.accuracyMeters) {
      showToast(`Capture GPS at the patrol point (±${PREMISE_MAX_ACCURACY_METERS}m required)`, 'error');
      return;
    }
    setSaving('place');
    try {
      await onAction('CREATE_PLACE', {
        premiseId: placeForm.premiseId,
        name: placeForm.name,
        type: placeForm.type,
        description: placeForm.description,
        lat: parseFloat(placeForm.lat),
        lng: parseFloat(placeForm.lng),
        accuracyMeters: parseFloat(placeForm.accuracyMeters),
        hasNfc: placeForm.hasNfc,
        schedule: placeForm.schedule,
      });
      showToast(`Place added: ${placeForm.name}`);
      setPlaceForm((f) => ({ ...f, name: '', description: '', lat: '', lng: '' }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mob-tab-panel">
      {loadingState ? (
        <SiteLoadingBanner title={loadingState.title} subtitle={loadingState.subtitle} />
      ) : null}

      <h3 className="mob-section-title"><Building2 size={16} /> {editingPremiseId ? 'Edit Site' : 'Register Site'}</h3>
      <form onSubmit={handleSavePremise} className={`mob-card elevated${isBusy ? ' mob-card-busy' : ''}`}>
        <label className="mob-field-label">Site Name *</label>
        <input className="mob-input" value={premiseForm.name} onChange={(e) => setPremiseForm({ ...premiseForm, name: e.target.value })} required disabled={isBusy} />
        <label className="mob-field-label">Address *</label>
        <input className="mob-input" value={premiseForm.address} onChange={(e) => setPremiseForm({ ...premiseForm, address: e.target.value })} required disabled={isBusy} />
        <label className="mob-field-label">Territory *</label>
        <select className="mob-select" value={premiseForm.territoryId} onChange={(e) => setPremiseForm({ ...premiseForm, territoryId: e.target.value })} required disabled={isBusy}>
          <option value="">Select territory</option>
          {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="mob-field-label">Suburb</label>
        <input className="mob-input" value={premiseForm.suburb} onChange={(e) => setPremiseForm({ ...premiseForm, suburb: e.target.value })} disabled={isBusy} />
        <div className="mob-coord-row">
          <div><label className="mob-field-label">Lat</label><input className="mob-input" value={premiseForm.lat} onChange={(e) => setPremiseForm({ ...premiseForm, lat: e.target.value })} disabled={isBusy} /></div>
          <div><label className="mob-field-label">Lng</label><input className="mob-input" value={premiseForm.lng} onChange={(e) => setPremiseForm({ ...premiseForm, lng: e.target.value })} disabled={isBusy} /></div>
        </div>
        <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" disabled={isBusy} onClick={() => captureGps('premise')}>
          {gpsCapturing === 'premise' ? <Loader2 size={14} className="mob-btn-spinner" /> : <Navigation size={14} />}
          {gpsCapturing === 'premise' ? 'Acquiring GPS…' : `Capture GPS (±${PREMISE_MAX_ACCURACY_METERS}m)`}
        </button>
        <div className="mob-form-actions">
          {editingPremiseId && (
            <button type="button" className="mob-btn mob-btn-secondary" disabled={isBusy} onClick={() => { setEditingPremiseId(null); setPremiseForm(emptyPremise()); }}>Cancel</button>
          )}
          <button type="submit" className="mob-btn" disabled={isBusy}>
            {saving === 'premise' ? <Loader2 size={14} className="mob-btn-spinner" /> : <Plus size={14} />}
            {saving === 'premise' ? 'Saving…' : editingPremiseId ? 'Update Site' : 'Save Site'}
          </button>
        </div>
      </form>

      <h3 className="mob-section-title"><MapPin size={16} /> Add Patrol Place</h3>
      <form onSubmit={handleSavePlace} className={`mob-card elevated${isBusy ? ' mob-card-busy' : ''}`}>
        <label className="mob-field-label">Site *</label>
        <select className="mob-select" value={placeForm.premiseId} onChange={(e) => setPlaceForm({ ...placeForm, premiseId: e.target.value })} required disabled={isBusy}>
          <option value="">Select site</option>
          {premises.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="mob-field-label">Place Name *</label>
        <input className="mob-input" value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} required disabled={isBusy} />
        <label className="mob-field-label">Type</label>
        <select className="mob-select" value={placeForm.type} onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })} disabled={isBusy}>
          <option>Patrol Point</option><option>Gate</option><option>Reception</option><option>Perimeter</option><option>Other</option>
        </select>
        <div className="mob-coord-row">
          <div><label className="mob-field-label">Lat</label><input className="mob-input" value={placeForm.lat} onChange={(e) => setPlaceForm({ ...placeForm, lat: e.target.value })} disabled={isBusy} /></div>
          <div><label className="mob-field-label">Lng</label><input className="mob-input" value={placeForm.lng} onChange={(e) => setPlaceForm({ ...placeForm, lng: e.target.value })} disabled={isBusy} /></div>
        </div>
        <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" disabled={isBusy} onClick={() => captureGps('place')}>
          {gpsCapturing === 'place' ? <Loader2 size={14} className="mob-btn-spinner" /> : <Navigation size={14} />}
          {gpsCapturing === 'place' ? 'Acquiring GPS…' : 'Capture GPS Here'}
        </button>
        <button type="submit" className="mob-btn mob-btn-success" disabled={isBusy}>
          {saving === 'place' ? <Loader2 size={14} className="mob-btn-spinner" /> : <Plus size={14} />}
          {saving === 'place' ? 'Adding…' : 'Add Place'}
        </button>
      </form>

      <div className="mob-card">
        <div className="mob-card-label">Your Sites ({premises.length})</div>
        {premises.map((p) => (
          <div key={p.id} className="mob-list-item mob-list-item-actions">
            <div>
              <strong>{p.name}</strong>
              <div className="mob-list-meta">{p.address}{p.coordinates?.lat ? ` · ${p.coordinates.lat.toFixed(5)}, ${p.coordinates.lng.toFixed(5)}` : ' · No GPS'}</div>
              <div className="mob-list-meta">{(places[p.id] || []).length} place(s)</div>
            </div>
            <div className="mob-inline-actions">
              <button
                type="button"
                className="mob-icon-btn"
                disabled={isBusy}
                onClick={() => captureGps('update', p.id)}
                title="Update GPS"
              >
                {gpsCapturing === `update-${p.id}` ? <Loader2 size={14} className="mob-btn-spinner" /> : <Navigation size={14} />}
              </button>
              <button type="button" className="mob-icon-btn" disabled={isBusy} onClick={() => startEditPremise(p)} title="Edit"><Pencil size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
