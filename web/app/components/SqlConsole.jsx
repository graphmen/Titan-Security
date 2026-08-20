'use client';

import React, { useState } from 'react';
import { Play, Download, Copy, Terminal, AlertCircle } from 'lucide-react';
import { SQL_PRESETS } from '../../lib/sqlPresets';
import { rowsToCsv, downloadTextFile, formatCell } from '../../lib/dbExplorer';
import { apiFetch } from '../../lib/apiClient';
import './databaseExplorer.css';

export default function SqlConsole({ dataSource }) {
  const [sql, setSql] = useState(SQL_PRESETS[0]?.sql || 'SELECT 1');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');

  const runQuery = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Query failed');
      setResult(body);
    } catch (e) {
      setError(e.message || 'Query failed');
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const exportJson = () => {
    if (!result?.rows) return;
    downloadTextFile(
      `titan-sql-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(result.rows, null, 2),
      'application/json'
    );
  };

  const exportCsv = () => {
    if (!result?.rows) return;
    downloadTextFile(
      `titan-sql-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(result.rows, result.columns)
    );
  };

  const copyResults = async () => {
    if (!result?.rows) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
      setCopyMsg('Results copied');
      setTimeout(() => setCopyMsg(''), 2000);
    } catch {
      setCopyMsg('Copy failed');
    }
  };

  return (
    <div className="sql-console">
      <div className="sql-console-head">
        <div>
          <h3><Terminal size={16} style={{ display: 'inline', marginRight: '0.35rem' }} />SQL console</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
            Read-only SELECT against Postgres ({dataSource === 'supabase' ? 'live database' : 'requires DATABASE_URL'}).
            Results capped at 500 rows unless your query includes LIMIT.
          </p>
        </div>
        <div className="sql-console-presets">
          <label htmlFor="sql-preset" style={{ fontSize: '0.7rem', color: '#64748b' }}>Presets</label>
          <select
            id="sql-preset"
            className="form-select"
            style={{ fontSize: '0.75rem', minWidth: 180 }}
            defaultValue=""
            onChange={(e) => {
              const preset = SQL_PRESETS.find((p) => p.label === e.target.value);
              if (preset) setSql(preset.sql);
              e.target.value = '';
            }}
          >
            <option value="">Load preset…</option>
            {SQL_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        className="sql-console-editor"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
        rows={8}
        aria-label="SQL query"
      />

      <div className="sql-console-actions">
        <button type="button" className="btn-primary" onClick={runQuery} disabled={running || !sql.trim()}>
          <Play size={14} /> {running ? 'Running…' : 'Run SELECT'}
        </button>
        {result && (
          <>
            <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem' }} onClick={copyResults}>
              <Copy size={12} /> Copy JSON
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem' }} onClick={exportCsv}>
              <Download size={12} /> Export CSV
            </button>
            <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem' }} onClick={exportJson}>
              <Download size={12} /> Export JSON
            </button>
          </>
        )}
        {copyMsg && <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>{copyMsg}</span>}
      </div>

      {error && (
        <div className="sql-console-error">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="sql-console-results">
          <div className="sql-console-meta">
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} · {result.durationMs}ms
            {result.limited ? ' · auto-LIMIT 500 applied' : ''}
          </div>
          {result.rows.length === 0 ? (
            <p className="db-explorer-empty" style={{ padding: '2rem' }}>Query returned no rows.</p>
          ) : (
            <div className="db-explorer-table-wrap">
              <table className="db-explorer-table">
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr key={idx}>
                      {result.columns.map((col) => (
                        <td key={col} title={formatCell(row[col])}>{formatCell(row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
