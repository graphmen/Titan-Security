import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured on the server');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      statement_timeout: 15000,
      query_timeout: 15000,
    });
  }
  return pool;
}

export function hasReadOnlySql() {
  return Boolean(process.env.DATABASE_URL);
}

/** Strip comments and validate SELECT-only queries. */
export function validateReadOnlySql(sql) {
  const trimmed = String(sql || '').trim();
  if (!trimmed) throw new Error('Query is empty');

  const stripped = trimmed
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();

  const upper = stripped.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Only SELECT queries are allowed (read-only)');
  }

  const forbidden =
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|CALL|COPY|VACUUM|REINDEX|CLUSTER|COMMENT|SECURITY|SET\s+ROLE|PG_SLEEP|LO_IMPORT|LO_EXPORT|INTO\s+OUTFILE)\b/i;
  if (forbidden.test(stripped)) {
    throw new Error('Query contains forbidden keywords — read-only SELECT only');
  }

  const semicolons = (stripped.match(/;/g) || []).length;
  if (semicolons > 1) {
    throw new Error('Only one SQL statement is allowed per run');
  }

  return stripped.replace(/;\s*$/, '');
}

export async function runReadOnlySql(sql, { maxRows = 500 } = {}) {
  const safe = validateReadOnlySql(sql);
  let query = safe;
  if (!/\bLIMIT\b/i.test(query)) {
    query = `${query} LIMIT ${maxRows}`;
  }

  const started = Date.now();
  const result = await getPool().query(query);
  const columns = result.fields?.map((f) => f.name) || (result.rows[0] ? Object.keys(result.rows[0]) : []);

  return {
    rows: result.rows,
    columns,
    rowCount: result.rows.length,
    durationMs: Date.now() - started,
    limited: !/\bLIMIT\b/i.test(safe),
  };
}
