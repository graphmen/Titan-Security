import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/webAuth';
import { hasReadOnlySql, runReadOnlySql } from '../../../../lib/readOnlySql';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req) {
  const session = await getSessionFromRequest(req);
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Master Admin sign-in required' }, { status: 401 });
  }

  if (!hasReadOnlySql()) {
    return NextResponse.json(
      { error: 'DATABASE_URL is not configured — SQL console requires direct Postgres access' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sql = body?.sql || body?.query;
  if (!sql || typeof sql !== 'string') {
    return NextResponse.json({ error: 'sql field is required' }, { status: 400 });
  }

  try {
    const result = await runReadOnlySql(sql, { maxRows: Math.min(Number(body.maxRows) || 500, 1000) });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Query failed' }, { status: 400 });
  }
}
