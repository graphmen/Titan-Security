'use client';

import React, { useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import {
  Building2,
  MapPin,
  User,
  Plus,
  Radio,
  ChevronRight,
  Copy,
  Check,
  Navigation,
  Trash2,
  Pencil,
  Users,
  Shield,
  UserCheck,
  Link2,
  AlertCircle,
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ListSearchBar, { TerritoryFilterSelect } from './ListSearchBar';
import { matchesSearch } from '../../lib/listFilters';
import { getSupervisorsForTerritory } from '../../lib/guardProfile';

const PLACE_TYPES = [
  { value: 'gate', label: 'Gate / Entrance' },
  { value: 'server_room', label: 'Server Room' },
  { value: 'warehouse', label: 'Warehouse / Storage' },
  { value: 'office', label: 'Office / Reception' },
  { value: 'perimeter', label: 'Perimeter / Fence' },
  { value: 'parking', label: 'Parking Area' },
  { value: 'other', label: 'Other Important Area' },
];

export default function PremisesRegistration({
  tenantId,
  premises = [],
  places = {},
  territories = [],
  supervisors = [],
  guards = [],
  shifts = [],
  attendance = [],
  checkpoints = [],
  onRefresh,
}) {
  const [selectedPremiseId, setSelectedPremiseId] = useState(premises[0]?.id || null);
  const [showPremiseForm, setShowPremiseForm] = useState(false);
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [editingPremiseId, setEditingPremiseId] = useState(null);
  const [editingPlaceId, setEditingPlaceId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [premiseSearch, setPremiseSearch] = useState('');
  const [premiseTerritoryFilter, setPremiseTerritoryFilter] = useState('');

  const [premiseForm, setPremiseForm] = useState({
    name: '',
    ownerName: '',
    ownerContact: '',
    address: '',
    city: '',
    suburb: '',
    territoryId: '',
    lat: '',
    lng: '',
  });

  const [placeForm, setPlaceForm] = useState({
    name: '',
    type: 'gate',
    description: '',
    lat: '',
    lng: '',
    hasNfc: true,
    nfcCode: '',
    schedule: 'Every 2 hours',
  });

  const selectedPremise = premises.find((p) => p.id === selectedPremiseId);
  const premisePlaces = selectedPremiseId ? places[selectedPremiseId] || [] : [];
  const selectedTerritory = territories.find((t) => t.id === premiseForm.territoryId);
  const suburbOptions = selectedTerritory?.suburbs || [];
  const territoryLabel = (tid) => territories.find((t) => t.id === tid)?.name || 'Unassigned';
  const guardsAtPremise = (premiseId) => guards.filter((g) => (g.assignedPremiseIds || []).includes(premiseId));

  const totalPlaces = premises.reduce((n, p) => n + (places[p.id]?.length || 0), 0);
  const nfcPlaces = premises.reduce(
    (n, p) => n + (places[p.id] || []).filter((pl) => pl.hasNfc).length,
    0
  );
  const assignedGuardIds = new Set();
  guards.forEach((g) => (g.assignedPremiseIds || []).forEach((pid) => assignedGuardIds.add(g.id)));
  const onDutyAtPremises = attendance.filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const unlinkedPremises = premises.filter((p) => !p.territoryId).length;
  const today = new Date().toISOString().slice(0, 10);

  const synthState = { premises: { [tenantId]: premises }, supervisors: { [tenantId]: supervisors }, territories: { [tenantId]: territories } };
  const supervisorsForPremise = (premise) =>
    premise?.territoryId ? getSupervisorsForTerritory(synthState, tenantId, premise.territoryId) : [];
  const shiftsAtPremise = (premiseId) =>
    shifts.filter((s) => s.premiseId === premiseId && s.date >= today && s.status !== 'Cancelled');
  const onDutyAtPremise = (premiseId) =>
    onDutyAtPremises.filter((a) => a.premiseId === premiseId);
  const checkpointsForPremise = (premiseId) =>
    checkpoints.filter((cp) => cp.premiseId === premiseId);

  const filteredPremises = premises.filter((p) => {
    if (premiseTerritoryFilter && p.territoryId !== premiseTerritoryFilter) return false;
    return matchesSearch(p, premiseSearch, (item) => [
      item.name,
      item.address,
      item.city,
      item.suburb,
      item.ownerName,
      item.ownerContact,
      item.id,
      territoryLabel(item.territoryId),
    ]);
  });

  const resetPremiseForm = () => {
    setPremiseForm({ name: '', ownerName: '', ownerContact: '', address: '', city: '', suburb: '', territoryId: '', lat: '', lng: '' });
    setEditingPremiseId(null);
    setShowPremiseForm(false);
  };

  const resetPlaceForm = () => {
    setPlaceForm({
      name: '',
      type: 'gate',
      description: '',
      lat: selectedPremise?.coordinates?.lat?.toString() || '',
      lng: selectedPremise?.coordinates?.lng?.toString() || '',
      hasNfc: true,
      nfcCode: '',
      schedule: 'Every 2 hours',
    });
    setEditingPlaceId(null);
    setShowPlaceForm(false);
  };

  const handleTerritoryChange = (territoryId) => {
    const t = territories.find((x) => x.id === territoryId);
    setPremiseForm({
      ...premiseForm,
      territoryId,
      city: t?.city || premiseForm.city,
      suburb: t?.suburbs?.some((s) => s.name === premiseForm.suburb) ? premiseForm.suburb : '',
    });
  };

  const startEditPremise = (p) => {
    setEditingPremiseId(p.id);
    setSelectedPremiseId(p.id);
    setPremiseForm({
      name: p.name,
      ownerName: p.ownerName || '',
      ownerContact: p.ownerContact || '',
      address: p.address,
      city: p.city || '',
      suburb: p.suburb || '',
      territoryId: p.territoryId || '',
      lat: p.coordinates?.lat?.toString() || '',
      lng: p.coordinates?.lng?.toString() || '',
    });
    setShowPremiseForm(true);
    setShowPlaceForm(false);
  };

  const startEditPlace = (place) => {
    setEditingPlaceId(place.id);
    setPlaceForm({
      name: place.name,
      type: place.type || 'gate',
      description: place.description || '',
      lat: place.coordinates?.lat?.toString() || '',
      lng: place.coordinates?.lng?.toString() || '',
      hasNfc: !!place.hasNfc,
      nfcCode: place.nfcCode || '',
      schedule: place.schedule || 'Every 2 hours',
    });
    setShowPlaceForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, extra } = deleteTarget;
    let ok = false;
    if (type === 'premise') ok = await postAction('DELETE_PREMISE', { premiseId: id });
    else if (type === 'place') ok = await postAction('DELETE_PLACE', { premiseId: extra, placeId: id });
    if (ok) {
      if (type === 'premise' && selectedPremiseId === id) setSelectedPremiseId(null);
      setDeleteTarget(null);
    }
  };

  const postAction = async (action, data) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenantId, ...data }),
      });
      if (!res.ok) throw new Error('Save failed');
      onRefresh?.();
      return true;
    } catch (e) {
      alert('Could not save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = (target) => {
    if (!navigator.geolocation) {
      alert('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (target === 'premise') {
          setPremiseForm((f) => ({ ...f, lat: latitude.toFixed(6), lng: longitude.toFixed(6) }));
        } else {
          setPlaceForm((f) => ({ ...f, lat: latitude.toFixed(6), lng: longitude.toFixed(6) }));
        }
      },
      () => alert('Could not get your location. Enter coordinates manually.')
    );
  };

  const copyId = (id) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePremise = async (e) => {
    e.preventDefault();
    if (!premiseForm.name || !premiseForm.address) return;
    const ok = editingPremiseId
      ? await postAction('UPDATE_PREMISE', { premiseId: editingPremiseId, updates: premiseForm })
      : await postAction('CREATE_PREMISE', premiseForm);
    if (ok) resetPremiseForm();
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    if (!selectedPremiseId || !placeForm.name) return;
    const ok = editingPlaceId
      ? await postAction('UPDATE_PLACE', { premiseId: selectedPremiseId, placeId: editingPlaceId, ...placeForm })
      : await postAction('CREATE_PLACE', { premiseId: selectedPremiseId, ...placeForm });
    if (ok) resetPlaceForm();
  };

  const handleDeletePlace = (placeId) => {
    setDeleteTarget({
      type: 'place',
      id: placeId,
      extra: selectedPremiseId,
      label: premisePlaces.find((p) => p.id === placeId)?.name,
      message: 'This place and its NFC patrol checkpoint will be permanently removed.',
    });
  };

  return (
    <div className="animate-fade-in">
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.type === 'premise' ? 'Delete Premises?' : 'Delete Place?'}
        message={deleteTarget?.message}
        itemLabel={deleteTarget?.label}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirming={saving}
      />

      {/* Dashboard stats — matches Guard & Supervisor tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { icon: Building2, label: 'Protected Sites', value: premises.length, color: 'var(--color-primary)', bg: '#d8f3dc' },
          { icon: MapPin, label: 'Patrol Places', value: totalPlaces, color: '#2563eb', bg: '#dbeafe' },
          { icon: Radio, label: 'NFC Checkpoints', value: nfcPlaces, color: 'var(--color-success)', bg: '#d1fae5' },
          { icon: Users, label: 'Guards Assigned', value: assignedGuardIds.size, color: '#7c3aed', bg: '#ede9fe' },
          { icon: Shield, label: 'On Duty at Sites', value: onDutyAtPremises.length, color: '#16a34a', bg: '#dcfce7' },
          { icon: AlertCircle, label: 'Needs Territory', value: unlinkedPremises, color: unlinkedPremises ? '#dc2626' : 'var(--text-muted)', bg: unlinkedPremises ? '#fee2e2' : '#f1f5f9' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="glass-panel" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ background: bg, padding: '0.55rem', borderRadius: '10px', lineHeight: 0 }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{label}</p>
              <h3 style={{ fontSize: '1.4rem', margin: '0.1rem 0 0', fontWeight: 700 }}>{value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* How modules connect */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.15rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: '#f8fafc' }}>
        <Link2 size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span><strong style={{ color: 'var(--text-main)' }}>Territories</strong> → assign to <strong style={{ color: 'var(--text-main)' }}>Premises</strong> → add <strong style={{ color: 'var(--text-main)' }}>Places & NFC</strong> → assign <strong style={{ color: 'var(--text-main)' }}>Guards</strong> → schedule <strong style={{ color: 'var(--text-main)' }}>Shifts</strong> → monitor in <strong style={{ color: 'var(--text-main)' }}>Command Centre</strong></span>
      </div>

      {territories.length === 0 && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', fontSize: '0.82rem', color: '#92400e' }}>
          Start by creating territories under <strong>Supervisor & Territories</strong>, then link each premises to a territory here.
        </div>
      )}

    <div className="dashboard-grid">
      {/* Left: Premises list */}
      <div className="col-4">
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} style={{ color: 'var(--color-primary)' }} />
              Protected Premises
            </h3>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => { resetPremiseForm(); setShowPremiseForm(true); setShowPlaceForm(false); }}
            >
              <Plus size={14} /> Register
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Register each building or site you protect. Every premises gets a unique ID for guards and mobile devices.
          </p>

          {(premises.length > 0 || premiseSearch || premiseTerritoryFilter) && (
            <div className="list-filter-row">
              <ListSearchBar
                value={premiseSearch}
                onChange={setPremiseSearch}
                placeholder="Search premises, address, owner…"
              />
              <TerritoryFilterSelect
                value={premiseTerritoryFilter}
                onChange={setPremiseTerritoryFilter}
                territories={territories}
              />
            </div>
          )}

          {premises.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dimmed)' }}>
              <Building2 size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>No premises registered yet.</p>
              <button type="button" className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowPremiseForm(true)}>
                Register First Premises
              </button>
            </div>
          ) : filteredPremises.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '2rem 1rem', fontSize: '0.85rem' }}>No premises match your search or territory filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredPremises.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setSelectedPremiseId(p.id); setShowPremiseForm(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPremiseId(p.id);
                      setShowPremiseForm(false);
                    }
                  }}
                  className="glass-card"
                  style={{
                    padding: '0.875rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: selectedPremiseId === p.id ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                    background: selectedPremiseId === p.id ? '#f0fdf4' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {p.address}{p.suburb ? `, ${p.suburb}` : ''}{p.city ? `, ${p.city}` : ''}
                  </div>
                  {p.territoryId && (
                    <span className="badge badge-green" style={{ fontSize: '0.62rem', marginBottom: '0.35rem' }}>{territoryLabel(p.territoryId)}</span>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.35rem' }}>
                    <span className="badge badge-blue" style={{ fontSize: '0.62rem' }}>{(places[p.id] || []).length} places</span>
                    <span className="badge badge-blue" style={{ fontSize: '0.62rem' }}>{guardsAtPremise(p.id).length} guards</span>
                    {(places[p.id] || []).some((pl) => pl.hasNfc) && (
                      <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>NFC</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{p.id}</code>
                    <div style={{ display: 'flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn-secondary" style={{ padding: '0.25rem' }} onClick={() => startEditPremise(p)} title="Edit"><Pencil size={12} /></button>
                      <button type="button" className="btn-danger" style={{ padding: '0.25rem' }} onClick={() => setDeleteTarget({ type: 'premise', id: p.id, label: p.name, message: 'All places and NFC checkpoints under this premises will also be deleted.' })} title="Delete"><Trash2 size={12} /></button>
                      <ChevronRight size={14} style={{ color: 'var(--text-dimmed)', marginLeft: '0.15rem' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail / forms */}
      <div className="col-8">
        {showPremiseForm ? (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>{editingPremiseId ? 'Edit Premises' : 'Register New Premises'}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Fill in the site details below. Link to a territory, city, and suburb for guard assignment.
            </p>
            <form onSubmit={handleSavePremise} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label>Premises Name *</label>
                <input className="form-input" value={premiseForm.name} onChange={(e) => setPremiseForm({ ...premiseForm, name: e.target.value })} placeholder="e.g. ABC Mall, Block B" required />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Owner / Client Name</label>
                <input className="form-input" value={premiseForm.ownerName} onChange={(e) => setPremiseForm({ ...premiseForm, ownerName: e.target.value })} placeholder="e.g. John Moyo" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Contact Number</label>
                <input className="form-input" value={premiseForm.ownerContact} onChange={(e) => setPremiseForm({ ...premiseForm, ownerContact: e.target.value })} placeholder="+263 77 000 0000" />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label>Street Address *</label>
                <input className="form-input" value={premiseForm.address} onChange={(e) => setPremiseForm({ ...premiseForm, address: e.target.value })} placeholder="e.g. 15 Samora Machel Avenue" required />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Territory</label>
                <select className="form-select" value={premiseForm.territoryId} onChange={(e) => handleTerritoryChange(e.target.value)}>
                  <option value="">Select territory</option>
                  {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>City / Town</label>
                <input className="form-input" value={premiseForm.city} onChange={(e) => setPremiseForm({ ...premiseForm, city: e.target.value })} placeholder="e.g. Harare" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Suburb</label>
                <select className="form-select" value={premiseForm.suburb} onChange={(e) => setPremiseForm({ ...premiseForm, suburb: e.target.value })}>
                  <option value="">Select suburb</option>
                  {suburbOptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>GPS Coordinates</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <input className="form-input" value={premiseForm.lat} onChange={(e) => setPremiseForm({ ...premiseForm, lat: e.target.value })} placeholder="Latitude" style={{ flex: 1 }} />
                  <input className="form-input" value={premiseForm.lng} onChange={(e) => setPremiseForm({ ...premiseForm, lng: e.target.value })} placeholder="Longitude" style={{ flex: 1 }} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => useMyLocation('premise')}>
                  <Navigation size={14} /> Use My Location
                </button>
                <button type="button" className="btn-secondary" onClick={resetPremiseForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ marginLeft: 'auto' }}>
                  {saving ? 'Saving…' : editingPremiseId ? 'Update Premises' : 'Save Premises'}
                </button>
              </div>
            </form>
          </div>
        ) : selectedPremise ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Premise summary */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>{selectedPremise.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    {[selectedPremise.suburb, selectedPremise.city].filter(Boolean).join(', ') || selectedPremise.address}
                    {selectedPremise.address && (selectedPremise.suburb || selectedPremise.city) ? ` · ${selectedPremise.address}` : !selectedPremise.suburb && !selectedPremise.city ? selectedPremise.address : ''}
                  </p>
                  {selectedPremise.ownerName && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <User size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {selectedPremise.ownerName}{selectedPremise.ownerContact ? ` · ${selectedPremise.ownerContact}` : ''}
                    </p>
                  )}
                  {selectedPremise.coordinates?.lat ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)', marginTop: '0.35rem' }}>
                      GPS: {selectedPremise.coordinates.lat}, {selectedPremise.coordinates.lng}
                    </p>
                  ) : null}
                </div>
                <button type="button" className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem' }} onClick={() => copyId(selectedPremise.id)}>
                  {copiedId === selectedPremise.id ? <Check size={12} /> : <Copy size={12} />}
                  {copiedId === selectedPremise.id ? ' Copied' : ' Copy ID'}
                </button>
                <button type="button" className="btn-secondary" style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem', marginLeft: '0.35rem' }} onClick={() => startEditPremise(selectedPremise)}>
                  <Pencil size={12} /> Edit
                </button>
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#edf7f0', borderRadius: '8px', fontSize: '0.75rem', color: '#1b4332' }}>
                <strong>Premises ID:</strong> <code>{selectedPremise.id}</code> — share this with guards on the mobile app.
              </div>
              {selectedPremise.territoryId && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.75rem' }}>
                  <strong>Territory:</strong> {territoryLabel(selectedPremise.territoryId)}
                  {selectedPremise.suburb && <span> · Suburb: {selectedPremise.suburb}</span>}
                </div>
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Assigned Guards ({guardsAtPremise(selectedPremise.id).length})</p>
                {guardsAtPremise(selectedPremise.id).length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dimmed)' }}>No guards assigned — assign via Guard Management → Register Guard → Assign to Premises.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {guardsAtPremise(selectedPremise.id).map((g) => (
                      <span key={g.id} className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{g.fullName} · {g.grade}</span>
                    ))}
                  </div>
                )}
              </div>

              {supervisorsForPremise(selectedPremise).length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Area Supervisors</p>
                  {supervisorsForPremise(selectedPremise).map((s) => (
                    <div key={s.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      <UserCheck size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {s.fullName} · {s.phone} · {s.role}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.72rem' }}>
                  <strong>{onDutyAtPremise(selectedPremise.id).length}</strong> on duty now
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.72rem' }}>
                  <strong>{shiftsAtPremise(selectedPremise.id).length}</strong> upcoming shifts
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.72rem' }}>
                  <strong>{checkpointsForPremise(selectedPremise.id).length}</strong> patrol checkpoints
                </div>
              </div>
            </div>

            {/* Places list */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem' }}>Important Places & NFC Points</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Add key areas inside this premises — server rooms, gates, etc. Enable NFC for guard patrol checkpoints.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    resetPlaceForm();
                    setShowPlaceForm(true);
                    setPlaceForm((f) => ({
                      ...f,
                      lat: selectedPremise.coordinates?.lat?.toString() || '',
                      lng: selectedPremise.coordinates?.lng?.toString() || '',
                    }));
                  }}
                >
                  <Plus size={14} /> Add Place
                </button>
              </div>

              {showPlaceForm && (
                <form onSubmit={handleSavePlace} style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.65rem' }}>{editingPlaceId ? 'Edit Place' : 'Add Place'}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                      <label>Place Name *</label>
                      <input className="form-input" value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} placeholder="e.g. Server Room, Main Gate" required />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label>Type</label>
                      <select className="form-select" value={placeForm.type} onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })}>
                        {PLACE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label>Patrol Schedule</label>
                      <select className="form-select" value={placeForm.schedule} onChange={(e) => setPlaceForm({ ...placeForm, schedule: e.target.value })}>
                        <option>Every 1 hour</option>
                        <option>Every 2 hours</option>
                        <option>Every 4 hours</option>
                        <option>Every shift</option>
                      </select>
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                      <label>Description (optional)</label>
                      <input className="form-input" value={placeForm.description} onChange={(e) => setPlaceForm({ ...placeForm, description: e.target.value })} placeholder="Brief note about this location" />
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                      <label>Place GPS Coordinates</label>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input className="form-input" value={placeForm.lat} onChange={(e) => setPlaceForm({ ...placeForm, lat: e.target.value })} placeholder="Latitude" style={{ flex: 1 }} />
                        <input className="form-input" value={placeForm.lng} onChange={(e) => setPlaceForm({ ...placeForm, lng: e.target.value })} placeholder="Longitude" style={{ flex: 1 }} />
                        <button type="button" className="btn-secondary" onClick={() => useMyLocation('place')} title="Use my location"><Navigation size={14} /></button>
                      </div>
                    </div>
                    <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={placeForm.hasNfc} onChange={(e) => setPlaceForm({ ...placeForm, hasNfc: e.target.checked })} />
                      <Radio size={14} style={{ color: 'var(--color-primary)' }} />
                      This place has an NFC tag for guard patrol
                    </label>
                    {placeForm.hasNfc && (
                      <div className="input-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                        <label>NFC Tag Code (auto-generated if blank)</label>
                        <input className="form-input" value={placeForm.nfcCode} onChange={(e) => setPlaceForm({ ...placeForm, nfcCode: e.target.value })} placeholder="e.g. NFC-SERVER-01" />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-secondary" onClick={resetPlaceForm}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editingPlaceId ? 'Update Place' : 'Save Place'}</button>
                  </div>
                </form>
              )}

              {premisePlaces.length === 0 ? (
                <p style={{ color: 'var(--text-dimmed)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                  No places added yet. Click &quot;Add Place&quot; to register server rooms, gates, and NFC patrol points.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {premisePlaces.map((place) => (
                    <div key={place.id} className="glass-card" style={{ padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{place.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {PLACE_TYPES.find((t) => t.value === place.type)?.label || place.type}
                          {place.coordinates?.lat ? ` · ${place.coordinates.lat}, ${place.coordinates.lng}` : ''}
                        </div>
                        {place.hasNfc && (
                          <span className="badge badge-blue" style={{ marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Radio size={10} /> {place.nfcCode} · {place.schedule}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" className="btn-secondary" style={{ padding: '0.35rem' }} onClick={() => startEditPlace(place)} title="Edit"><Pencil size={14} /></button>
                        <button type="button" className="btn-danger" style={{ padding: '0.35rem' }} onClick={() => handleDeletePlace(place.id)} title="Remove place">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dimmed)' }}>
            <Building2 size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Select a premises from the list, or register a new one to get started.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
