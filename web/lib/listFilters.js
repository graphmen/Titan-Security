/** Case-insensitive search across string fields extracted from each item. */
export function matchesSearch(item, query, getStrings) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return getStrings(item).some((s) => String(s || '').toLowerCase().includes(q));
}

/** Filter premises to a territory; returns all when territoryId is empty. */
export function premisesInTerritory(premises, territoryId) {
  if (!territoryId) return premises;
  return premises.filter((p) => p.territoryId === territoryId);
}
