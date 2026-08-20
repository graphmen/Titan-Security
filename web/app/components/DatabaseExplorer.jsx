'use client';

import React, { useMemo, useState } from 'react';
import {
  Database,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import ListSearchBar from './ListSearchBar';
import {
  buildExplorerCatalog,
  filterRows,
  formatCell,
  groupTablesByCategory,
} from '../../lib/dbExplorer';
import './databaseExplorer.css';

const PAGE_SIZE = 30;

export default function DatabaseExplorer({
  state,
  tenantId,
  dataSource,
  onRefresh,
  refreshing = false,
}) {
  const catalog = useMemo(
    () => buildExplorerCatalog(state, tenantId),
    [state, tenantId]
  );

  const [activeTableId, setActiveTableId] = useState(catalog.tables[0]?.id || 'premises');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');

  const activeTable = catalog.tables.find((t) => t.id === activeTableId) || catalog.tables[0];
  const grouped = useMemo(() => groupTablesByCategory(catalog.tables), [catalog.tables]);

  const filteredRows = useMemo(() => {
    if (!activeTable) return [];
    return filterRows(activeTable.rows, search);
  }, [activeTable, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selectedRow = selectedIndex != null ? pageRows[selectedIndex] : null;

  const selectTable = (id) => {
    setActiveTableId(id);
    setSearch('');
    setPage(0);
    setSelectedIndex(null);
  };

  const copyJson = async (data, label) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyMsg(`${label} copied`);
      setTimeout(() => setCopyMsg(''), 2000);
    } catch {
      setCopyMsg('Copy failed');
    }
  };

  const downloadTable = () => {
    if (!activeTable) return;
    const blob = new Blob([JSON.stringify(filteredRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-${activeTable.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!catalog.tables.length) {
    return (
      <div className="db-explorer-empty glass-panel" style={{ padding: '3rem' }}>
        No data loaded. Refresh from the database to explore records.
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="db-explorer-summary">
        <span className={`badge ${dataSource === 'supabase' ? 'badge-green' : 'badge-yellow'}`}>
          {dataSource === 'supabase' ? 'Supabase live' : 'In-memory demo'}
        </span>
        <span className="badge badge-blue">{catalog.totalRows} total records</span>
        <span className="badge badge-green">{catalog.tables.length} collections</span>
        <span className="badge badge-blue">Tenant: {catalog.tenantId}</span>
        {onRefresh && (
          <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} /> Refresh data
          </button>
        )}
        {copyMsg && <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>{copyMsg}</span>}
      </div>

      <div className="db-explorer">
        <aside className="db-explorer-sidebar">
          <div className="db-explorer-sidebar-head">
            <h3><Database size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />Collections</h3>
          </div>
          <div className="db-explorer-sidebar-body">
            {Object.entries(grouped).map(([category, tables]) => (
              <div key={category} className="db-explorer-category">
                <div className="db-explorer-category-label">{category}</div>
                {tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`db-explorer-table-btn ${activeTable?.id === t.id ? 'active' : ''}`}
                    onClick={() => selectTable(t.id)}
                  >
                    <span>{t.label}</span>
                    <span className="db-explorer-count">{t.count}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <section className="db-explorer-main">
          <div className="db-explorer-main-head">
            <h3>{activeTable?.label || 'Table'}</h3>
            {activeTable?.supabaseTable && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                Supabase: <code>{activeTable.supabaseTable}</code>
                {activeTable.description ? ` · ${activeTable.description}` : ''}
              </p>
            )}
          </div>

          <div className="db-explorer-toolbar">
            <ListSearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(0); setSelectedIndex(null); }}
              placeholder="Search rows…"
              style={{ flex: 1, minWidth: 180, marginBottom: 0 }}
            />
            <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }} onClick={() => copyJson(filteredRows, 'Table JSON')}>
              <Copy size={12} /> Copy all
            </button>
            <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }} onClick={downloadTable}>
              <Download size={12} /> Export JSON
            </button>
          </div>

          <div className="db-explorer-main-body">
            {filteredRows.length === 0 ? (
              <div className="db-explorer-empty">
                <Search size={28} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                <p>No rows in <strong>{activeTable?.label}</strong>{search ? ' matching your search' : ''}.</p>
              </div>
            ) : (
              <>
                <div className="db-explorer-table-wrap">
                  <table className="db-explorer-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {activeTable.columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, idx) => (
                        <tr
                          key={row.id || `${safePage}-${idx}`}
                          className={selectedIndex === idx ? 'selected' : ''}
                          onClick={() => setSelectedIndex(idx)}
                        >
                          <td>{safePage * PAGE_SIZE + idx + 1}</td>
                          {activeTable.columns.map((col) => (
                            <td key={col} title={formatCell(row[col])}>{formatCell(row[col])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="db-explorer-pagination">
                  <span>
                    {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
                    {search ? ' (filtered)' : ''}
                  </span>
                  <div className="db-explorer-pagination-btns">
                    <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.45rem' }} disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft size={14} />
                    </button>
                    <span>Page {safePage + 1} / {pageCount}</span>
                    <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.45rem' }} disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="db-explorer-detail">
          <div className="db-explorer-detail-head">
            <h3>Record detail</h3>
          </div>
          <div className="db-explorer-detail-body">
            {selectedRow ? (
              <>
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.65rem' }}>
                  <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }} onClick={() => copyJson(selectedRow, 'Record')}>
                    <Copy size={11} /> Copy JSON
                  </button>
                </div>
                <pre className="db-explorer-json">{JSON.stringify(selectedRow, null, 2)}</pre>
              </>
            ) : (
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                Select a row to inspect the full JSON record. Sensitive fields (PINs, photos) are redacted.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
