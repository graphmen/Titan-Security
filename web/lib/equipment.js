export const EQUIPMENT_TYPES = ['Radio', 'Uniform', 'Torch', 'Firearm', 'Keys', 'Other'];

export const EQUIPMENT_CONDITIONS = ['Good', 'Fair', 'Damaged', 'Lost'];

export const EQUIPMENT_STATUSES = ['Available', 'Issued', 'Maintenance', 'Retired'];

export function generateEquipmentId() {
  return `EQ-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export function equipmentForTenant(state, tenantId) {
  return (state?.equipment || []).filter((e) => !e.tenantId || e.tenantId === tenantId);
}

export function equipmentForPremise(state, tenantId, premiseId) {
  return equipmentForTenant(state, tenantId).filter((e) => e.premiseId === premiseId);
}
