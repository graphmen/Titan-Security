import React, { useState } from 'react';
import { Building2, MapPin, Navigation, Plus, Pencil } from 'lucide-react';
import { getLocation } from '../utils/api';

const emptyPremise = (territoryId = '') => ({
  name: '', address: '', city: 'Harare', suburb: '', territoryId, ownerName: '', ownerContact: '', lat: '', lng: '',
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
    premiseId: '', name: '', type: 'Patrol Point', description: '', lat: '', lng: '', hasNfc: true, schedule: 'Every 2 hours',
  });
  const [editingPremiseId, setEditingPremiseId] = useState(null);

  const captureGps = async (target, premiseId = null) => {
    try {
      const { lat, lng } = await getLocation();
      const coords = { lat: lat.toFixed(6), lng: lng.toFixed(6) };
      if (target === 'premise') {
        setPremiseForm((f) => ({ ...f, ...coords }));
      } else if (target === 'place') {
        setPlaceForm((f) => ({ ...f, ...coords }));
      } else if (premiseId) {
        await onAction('UPDATE_PREMISE', {
          premiseId,
          updates: { lat: parseFloat(coords.lat), lng: parseFloat(coords.lng) },
        });
        showToast('Site GPS updated');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSavePremise = async (e) => {
    e.preventDefault();
    if (!premiseForm.name || !premiseForm.address || !premiseForm.territoryId) {
      showToast('Name, address and territory required', 'error');
      return;
    }
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
            lat: parseFloat(premiseForm.lat) || 0,
            lng: parseFloat(premiseForm.lng) || 0,
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
          lat: parseFloat(premiseForm.lat) || 0,
          lng: parseFloat(premiseForm.lng) || 0,
        });
        showToast(`Site registered: ${premiseForm.name}`);
      }
      setPremiseForm(emptyPremise(premiseForm.territoryId));
      setEditingPremiseId(null);
    } catch (err) {
      showToast(err.message, 'error');
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
    });
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    if (!placeForm.premiseId || !placeForm.name) {
      showToast('Select a site and enter place name', 'error');
      return;
    }
    try {
      await onAction('CREATE_PLACE', {
        premiseId: placeForm.premiseId,
        name: placeForm.name,
        type: placeForm.type,
        description: placeForm.description,
        lat: parseFloat(placeForm.lat) || undefined,
        lng: parseFloat(placeForm.lng) || undefined,
        hasNfc: placeForm.hasNfc,
        schedule: placeForm.schedule,
      });
      showToast(`Place added: ${placeForm.name}`);
      setPlaceForm((f) => ({ ...f, name: '', description: '', lat: '', lng: '' }));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="mob-tab-panel">
      <h3 className="mob-section-title"><Building2 size={16} /> {editingPremiseId ? 'Edit Site' : 'Register Site'}</h3>
      <form onSubmit={handleSavePremise} className="mob-card elevated">
        <label className="mob-field-label">Site Name *</label>
        <input className="mob-input" value={premiseForm.name} onChange={(e) => setPremiseForm({ ...premiseForm, name: e.target.value })} required />
        <label className="mob-field-label">Address *</label>
        <input className="mob-input" value={premiseForm.address} onChange={(e) => setPremiseForm({ ...premiseForm, address: e.target.value })} required />
        <label className="mob-field-label">Territory *</label>
        <select className="mob-select" value={premiseForm.territoryId} onChange={(e) => setPremiseForm({ ...premiseForm, territoryId: e.target.value })} required>
          <option value="">Select territory</option>
          {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="mob-field-label">Suburb</label>
        <input className="mob-input" value={premiseForm.suburb} onChange={(e) => setPremiseForm({ ...premiseForm, suburb: e.target.value })} />
        <div className="mob-coord-row">
          <div><label className="mob-field-label">Lat</label><input className="mob-input" value={premiseForm.lat} onChange={(e) => setPremiseForm({ ...premiseForm, lat: e.target.value })} /></div>
          <div><label className="mob-field-label">Lng</label><input className="mob-input" value={premiseForm.lng} onChange={(e) => setPremiseForm({ ...premiseForm, lng: e.target.value })} /></div>
        </div>
        <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" onClick={() => captureGps('premise')}>
          <Navigation size={14} /> Capture GPS Here
        </button>
        <div className="mob-form-actions">
          {editingPremiseId && (
            <button type="button" className="mob-btn mob-btn-secondary" onClick={() => { setEditingPremiseId(null); setPremiseForm(emptyPremise()); }}>Cancel</button>
          )}
          <button type="submit" className="mob-btn"><Plus size={14} /> {editingPremiseId ? 'Update Site' : 'Save Site'}</button>
        </div>
      </form>

      <h3 className="mob-section-title"><MapPin size={16} /> Add Patrol Place</h3>
      <form onSubmit={handleSavePlace} className="mob-card elevated">
        <label className="mob-field-label">Site *</label>
        <select className="mob-select" value={placeForm.premiseId} onChange={(e) => setPlaceForm({ ...placeForm, premiseId: e.target.value })} required>
          <option value="">Select site</option>
          {premises.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="mob-field-label">Place Name *</label>
        <input className="mob-input" value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} required />
        <label className="mob-field-label">Type</label>
        <select className="mob-select" value={placeForm.type} onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })}>
          <option>Patrol Point</option><option>Gate</option><option>Reception</option><option>Perimeter</option><option>Other</option>
        </select>
        <div className="mob-coord-row">
          <div><label className="mob-field-label">Lat</label><input className="mob-input" value={placeForm.lat} onChange={(e) => setPlaceForm({ ...placeForm, lat: e.target.value })} /></div>
          <div><label className="mob-field-label">Lng</label><input className="mob-input" value={placeForm.lng} onChange={(e) => setPlaceForm({ ...placeForm, lng: e.target.value })} /></div>
        </div>
        <button type="button" className="mob-btn mob-btn-secondary mob-btn-block-gap" onClick={() => captureGps('place')}>
          <Navigation size={14} /> Capture GPS Here
        </button>
        <button type="submit" className="mob-btn mob-btn-success"><Plus size={14} /> Add Place</button>
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
              <button type="button" className="mob-icon-btn" onClick={() => captureGps('update', p.id)} title="Update GPS"><Navigation size={14} /></button>
              <button type="button" className="mob-icon-btn" onClick={() => startEditPremise(p)} title="Edit"><Pencil size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
