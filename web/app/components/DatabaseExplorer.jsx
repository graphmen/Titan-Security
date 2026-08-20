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
  Pencil,
  Save,
  X,
} from 'lucide-react';
import ListSearchBar from './ListSearchBar';
import {
  buildExplorerCatalog,
  filterRows,
  formatCell,
  groupTablesByCategory,
  rowsToCsv,
  downloadTextFile,
} from '../../lib/dbExplorer';
import {
  isTableEditable,
  isFieldEditable,
  buildCellUpdate,
  buildRowJsonUpdate,
} from '../../lib/dbExplorerEdit';
import { apiFetch } from '../../lib/apiClient';
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
  const [editMode, setEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonEditing, setJsonEditing] = useState(false);

  const activeTable = catalog.tables.find((t) => t.id === activeTableId) || catalog.tables[0];
  const tableEditable = isTableEditable(activeTable?.id);
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
    setEditingCell(null);
    setJsonEditing(false);
    setSaveError('');
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

  const downloadTableJson = () => {
    if (!activeTable) return;
    downloadTextFile(
      `titan-${activeTable.id}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(filteredRows, null, 2),
      'application/json'
    );
  };

  const downloadTableCsv = () => {
    if (!activeTable) return;
    downloadTextFile(
      `titan-${activeTable.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(filteredRows, activeTable.columns)
    );
  };

  const postAction = async (payload) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await apiFetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      onRefresh?.();
      return true;
    } catch (e) {
      setSaveError(e.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startCellEdit = (rowIdx, col, row) => {
    if (!editMode || !isFieldEditable(activeTable.id, col)) return;
    setEditingCell({ rowIdx, col });
    const val = row[col];
    setEditDraft(val == null ? '' : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val));
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setEditDraft('');
  };

  const saveCellEdit = async (row) => {
    if (!editingCell) return;
    const { col } = editingCell;
    const { payload, error } = buildCellUpdate(activeTable.id, row, col, editDraft, tenantId);
    if (error) {
      setSaveError(error);
      return;
    }
    const ok = await postAction(payload);
    if (ok) {
      setEditingCell(null);
      setEditDraft('');
    }
  };

  const startJsonEdit = () => {
    if (!selectedRow) return;
    setJsonDraft(JSON.stringify(selectedRow, null, 2));
    setJsonEditing(true);
    setSaveError('');
  };

  const cancelJsonEdit = () => {
    setJsonEditing(false);
    setJsonDraft('');
    setSaveError('');
  };

  const saveJsonEdit = async () => {
    if (!selectedRow) return;
    let parsed;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch {
      setSaveError('Invalid JSON — fix syntax before saving');
      return;
    }
    const { payload, error } = buildRowJsonUpdate(activeTable.id, selectedRow, parsed, tenantId);
    if (error) {
      setSaveError(error);
      return;
    }
    const ok = await postAction(payload);
    if (ok) setJsonEditing(false);
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
                  {tableEditable && editMode && (
                    <span className="db-explorer-edit-badge"> · Edit mode — double-click a cell</span>
                  )}
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
              {tableEditable && (
                <button
                  type="button"
                  className={`btn-secondary ${editMode ? 'db-explorer-edit-active' : ''}`}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }}
                  onClick={() => { setEditMode((m) => !m); setEditingCell(null); setSaveError(''); }}
                >
                  <Pencil size={12} /> {editMode ? 'Editing on' : 'Edit rows'}
                </button>
              )}
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }} onClick={() => copyJson(filteredRows, 'Table JSON')}>
                <Copy size={12} /> Copy all
              </button>
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }} onClick={downloadTableCsv}>
                <Download size={12} /> Export CSV
              </button>
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem' }} onClick={downloadTableJson}>
                <Download size={12} /> Export JSON
              </button>
            </div>

            {saveError && (
              <div className="db-explorer-save-error">{saveError}</div>
            )}

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
                            <th key={col} className={editMode && isFieldEditable(activeTable.id, col) ? 'editable-col' : ''}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, idx) => (
                          <tr
                            key={row.id || `${safePage}-${idx}`}
                            className={selectedIndex === idx ? 'selected' : ''}
                            onClick={() => { setSelectedIndex(idx); setJsonEditing(false); }}
                          >
                            <td>{safePage * PAGE_SIZE + idx + 1}</td>
                            {activeTable.columns.map((col) => {
                              const isEditing = editingCell?.rowIdx === idx && editingCell?.col === col;
                              const canEdit = editMode && isFieldEditable(activeTable.id, col);
                              return (
                                <td
                                  key={col}
                                  title={formatCell(row[col])}
                                  className={canEdit ? 'editable-cell' : ''}
                                  onDoubleClick={(e) => { e.stopPropagation(); startCellEdit(idx, col, row); }}
                                >
                                  {isEditing ? (
                                    <div className="db-explorer-cell-editor" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={editDraft}
                                        onChange={(e) => setEditDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveCellEdit(row);
                                          if (e.key === 'Escape') cancelCellEdit();
                                        }}
                                        autoFocus
                                        disabled={saving}
                                      />
                                      <button type="button" className="db-explorer-cell-btn save" onClick={() => saveCellEdit(row)} disabled={saving} title="Save">
                                        <Save size={11} />
                                      </button>
                                      <button type="button" className="db-explorer-cell-btn" onClick={cancelCellEdit} title="Cancel">
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ) : (
                                    formatCell(row[col])
                                  )}
                                </td>
                              );
                            })}
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
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }} onClick={() => copyJson(selectedRow, 'Record')}>
                      <Copy size={11} /> Copy JSON
                    </button>
                    {tableEditable && !jsonEditing && (
                      <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }} onClick={startJsonEdit}>
                        <Pencil size={11} /> Edit JSON
                      </button>
                    )}
                    {jsonEditing && (
                      <>
                        <button type="button" className="btn-primary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }} onClick={saveJsonEdit} disabled={saving}>
                          <Save size={11} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }} onClick={cancelJsonEdit} disabled={saving}>
                          <X size={11} /> Cancel
                        </button>
                      </>
                    )}
                  </div>
                  {jsonEditing ? (
                    <textarea
                      className="db-explorer-json-editor"
                      value={jsonDraft}
                      onChange={(e) => setJsonDraft(e.target.value)}
                      spellCheck={false}
                      rows={18}
                    />
                  ) : (
                    <pre className="db-explorer-json">{JSON.stringify(selectedRow, null, 2)}</pre>
                  )}
                  {jsonEditing && (
                    <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0.5rem 0 0' }}>
                      Only whitelisted fields are saved. PINs, coordinates, and media cannot be edited here.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Select a row to inspect the full JSON record. Sensitive fields (PINs, photos) are redacted.
                  {tableEditable && ' Turn on Edit rows to change values inline or via JSON.'}
                </p>
              )}
            </div>
          </aside>
        </div>
    </div>
  );
}
