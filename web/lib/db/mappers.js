/** Map app objects ↔ Supabase row shapes (snake_case). */

export function tenantToRow(t) {
  return {
    id: t.id,
    name: t.name,
    primary_color: t.primaryColor || '#1b4332',
    logo_text: t.logoText || t.name?.substring(0, 2)?.toUpperCase(),
    plan: t.plan || 'Growth Trial',
    status: t.status || 'Active',
  };
}

export function rowToTenant(r) {
  return {
    id: r.id,
    name: r.name,
    primaryColor: r.primary_color,
    logoText: r.logo_text,
    plan: r.plan,
    status: r.status,
  };
}

export function territoryToRow(t, tenantId) {
  return {
    id: t.id,
    tenant_id: tenantId,
    name: t.name,
    city: t.city || null,
    description: t.description || null,
    status: t.status || 'Active',
    created_at: t.createdAt || new Date().toISOString(),
  };
}

export function rowToTerritory(r, suburbs = []) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    city: r.city,
    description: r.description,
    status: r.status,
    suburbs,
    createdAt: r.created_at,
  };
}

export function suburbToRow(s, territoryId) {
  return { id: s.id, territory_id: territoryId, name: s.name };
}

export function supervisorToRow(s, tenantId) {
  return {
    id: s.id,
    tenant_id: tenantId,
    employee_number: s.employeeNumber || null,
    full_name: s.fullName,
    phone: s.phone || null,
    email: s.email || null,
    role: s.role || null,
    status: s.status || 'Active',
    created_at: s.createdAt || new Date().toISOString(),
  };
}

export function rowToSupervisor(r, assignedTerritoryIds = []) {
  return {
    id: r.id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    role: r.role,
    status: r.status,
    assignedTerritoryIds,
    createdAt: r.created_at,
  };
}

export function premiseToRow(p, tenantId) {
  return {
    id: p.id,
    tenant_id: tenantId,
    territory_id: p.territoryId || null,
    name: p.name,
    owner_name: p.ownerName || null,
    owner_contact: p.ownerContact || null,
    address: p.address || null,
    city: p.city || null,
    suburb: p.suburb || null,
    lat: p.coordinates?.lat ?? null,
    lng: p.coordinates?.lng ?? null,
    status: p.status || 'Active',
    created_at: p.createdAt || new Date().toISOString(),
  };
}

export function rowToPremise(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    territoryId: r.territory_id,
    name: r.name,
    ownerName: r.owner_name,
    ownerContact: r.owner_contact,
    address: r.address,
    city: r.city,
    suburb: r.suburb,
    coordinates: r.lat != null ? { lat: r.lat, lng: r.lng } : null,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function placeToRow(p, tenantId) {
  return {
    id: p.id,
    tenant_id: tenantId,
    premise_id: p.premiseId,
    name: p.name,
    type: p.type || null,
    description: p.description || null,
    lat: p.coordinates?.lat ?? null,
    lng: p.coordinates?.lng ?? null,
    has_nfc: Boolean(p.hasNfc),
    nfc_code: p.nfcCode || null,
    schedule: p.schedule || 'Every 2 hours',
    created_at: p.createdAt || new Date().toISOString(),
  };
}

export function rowToPlace(r) {
  return {
    id: r.id,
    premiseId: r.premise_id,
    tenantId: r.tenant_id,
    name: r.name,
    type: r.type,
    description: r.description,
    coordinates: r.lat != null ? { lat: r.lat, lng: r.lng } : null,
    hasNfc: r.has_nfc,
    nfcCode: r.nfc_code,
    schedule: r.schedule,
    createdAt: r.created_at,
  };
}

export function guardToRow(g, tenantId) {
  const nok = g.nextOfKin || {};
  const nokName = g.nextOfKinName ?? nok.name ?? null;
  const nokPhone = g.nextOfKinPhone ?? nok.phone ?? null;
  const nokRelationship = g.nextOfKinRelationship ?? nok.relationship ?? null;
  return {
    id: g.id,
    tenant_id: tenantId,
    territory_id: g.territoryId || null,
    employee_number: g.employeeNumber || null,
    full_name: g.fullName,
    id_number: g.idNumber || null,
    phone: g.phone || null,
    email: g.email || null,
    license_number: g.licenseNumber || null,
    license_expiry: g.licenseExpiry || null,
    grade: g.grade || null,
    status: g.status || 'Active',
    city: g.city || null,
    suburb: g.suburb || null,
    uniform_size: g.uniformSize || null,
    photo_url: g.photoUrl || null,
    login_pin: g.loginPin || null,
    pin_must_change: g.pinMustChange ?? true,
    pin_created_at: g.pinCreatedAt || null,
    next_of_kin_name: nokName,
    next_of_kin_phone: nokPhone,
    next_of_kin_relationship: nokRelationship,
    next_of_kin: {
      name: nokName || '',
      phone: nokPhone || '',
      relationship: nokRelationship || '',
    },
    performance_score: g.performanceScore || {},
    documents: g.documents || [],
    trainings: g.trainings || [],
    created_at: g.createdAt || new Date().toISOString(),
  };
}

export function rowToGuard(r, assignedPremiseIds = []) {
  const nokName = r.next_of_kin_name || r.next_of_kin?.name || '';
  const nokPhone = r.next_of_kin_phone || r.next_of_kin?.phone || '';
  const nokRelationship = r.next_of_kin_relationship || r.next_of_kin?.relationship || '';
  return {
    id: r.id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    idNumber: r.id_number,
    phone: r.phone,
    email: r.email,
    licenseNumber: r.license_number,
    licenseExpiry: r.license_expiry,
    grade: r.grade,
    status: r.status,
    territoryId: r.territory_id,
    city: r.city,
    suburb: r.suburb,
    assignedPremiseIds,
    photoUrl: r.photo_url,
    uniformSize: r.uniform_size,
    loginPin: r.login_pin,
    pinMustChange: r.pin_must_change,
    pinCreatedAt: r.pin_created_at,
    nextOfKin: {
      name: nokName,
      phone: nokPhone,
      relationship: nokRelationship,
    },
    performanceScore: r.performance_score || {},
    documents: r.documents || [],
    trainings: r.trainings || [],
    createdAt: r.created_at,
  };
}

export function shiftToRow(s, tenantId) {
  return {
    id: s.id,
    tenant_id: tenantId,
    guard_id: s.guardId,
    premise_id: s.premiseId || null,
    shift_date: s.date,
    start_time: s.startTime || null,
    end_time: s.endTime || null,
    shift_type: s.shiftType || null,
    status: s.status || 'Scheduled',
    created_at: s.createdAt || new Date().toISOString(),
  };
}

export function rowToShift(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    guardId: r.guard_id,
    premiseId: r.premise_id,
    date: r.shift_date,
    startTime: r.start_time,
    endTime: r.end_time,
    shiftType: r.shift_type,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function attendanceToRow(a, tenantId) {
  return {
    id: a.id,
    tenant_id: tenantId,
    guard_id: a.guardId,
    premise_id: a.premiseId || null,
    shift_id: a.shiftId || null,
    clock_in: a.clockIn || null,
    clock_out: a.clockOut || null,
    status: a.status || null,
    lat: a.coordinates?.lat ?? a.lat ?? null,
    lng: a.coordinates?.lng ?? a.lng ?? null,
    last_heartbeat: a.lastHeartbeat || null,
    created_at: a.createdAt || new Date().toISOString(),
  };
}

export function rowToAttendance(r) {
  return {
    id: r.id,
    guardId: r.guard_id,
    premiseId: r.premise_id,
    shiftId: r.shift_id,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    status: r.status,
    coordinates: r.lat != null ? { lat: r.lat, lng: r.lng } : null,
    lastHeartbeat: r.last_heartbeat,
    createdAt: r.created_at,
  };
}

export function checkpointToRow(cp, tenantId) {
  return {
    id: cp.id,
    tenant_id: tenantId,
    name: cp.name,
    code: cp.code || null,
    status: cp.status || 'Pending',
    last_scanned: cp.lastScanned || null,
    coords_x: cp.coords?.x ?? null,
    coords_y: cp.coords?.y ?? null,
    schedule: cp.schedule || null,
    premise_id: cp.premiseId || null,
    place_id: cp.placeId || null,
    lat: cp.coordinates?.lat ?? null,
    lng: cp.coordinates?.lng ?? null,
  };
}

export function rowToCheckpoint(r) {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    status: r.status,
    lastScanned: r.last_scanned,
    coords: r.coords_x != null ? { x: r.coords_x, y: r.coords_y } : null,
    coordinates: r.lat != null ? { lat: r.lat, lng: r.lng } : null,
    schedule: r.schedule,
    premiseId: r.premise_id,
    placeId: r.place_id,
    premiseName: r.premise_name,
  };
}

export function alertToRow(a, tenantId) {
  return {
    id: a.id,
    tenant_id: tenantId,
    guard_id: a.guardId || null,
    guard_name: a.guardName || null,
    type: a.type,
    severity: a.severity || 'info',
    message: a.message,
    status: a.status || 'Active',
    created_at: a.createdAt || new Date().toISOString(),
  };
}

export function rowToAlert(r) {
  return {
    id: r.id,
    type: r.type,
    severity: r.severity,
    guardId: r.guard_id,
    guardName: r.guard_name,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function swapToRow(s, tenantId) {
  return {
    id: s.id,
    tenant_id: tenantId,
    shift_id: s.shiftId,
    requester_guard_id: s.requesterGuardId,
    target_guard_id: s.targetGuardId || null,
    reason: s.reason || null,
    status: s.status || 'Pending',
    created_at: s.createdAt || new Date().toISOString(),
    resolved_at: s.resolvedAt || null,
  };
}

export function rowToSwap(r) {
  return {
    id: r.id,
    shiftId: r.shift_id,
    requesterGuardId: r.requester_guard_id,
    targetGuardId: r.target_guard_id,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function waToRow(w, tenantId) {
  return {
    id: w.id,
    tenant_id: tenantId,
    guard_id: w.guardId || null,
    to_phone: w.to || w.toPhone || null,
    message_type: w.type || null,
    body: w.body || null,
    wa_link: w.waLink || null,
    status: w.status || 'pending',
    created_at: w.createdAt || new Date().toISOString(),
    meta: w.meta || {},
  };
}

export function rowToWa(r) {
  return {
    id: r.id,
    guardId: r.guard_id,
    to: r.to_phone,
    type: r.message_type,
    body: r.body,
    waLink: r.wa_link,
    status: r.status,
    createdAt: r.created_at,
    meta: r.meta || {},
  };
}
