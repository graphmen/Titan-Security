'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

export default function ListSearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  style,
}) {
  return (
    <div className="list-search-bar" style={style}>
      <Search size={15} className="list-search-icon" aria-hidden />
      <input
        type="search"
        className="form-input list-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="list-search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function TerritoryFilterSelect({ value, onChange, territories, label = 'Territory' }) {
  return (
    <div className="input-group list-filter-select" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All territories</option>
        {territories.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
