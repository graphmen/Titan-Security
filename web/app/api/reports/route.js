import { NextResponse } from 'next/server';
import { getSupabaseAppState, isSupabaseReady } from '../../../lib/supabaseState';
import { getLocalStateWithMonitoring } from '../../../lib/localStore';
import { patrolComplianceRate } from '../../../lib/patrolMonitoring';
import { isPremiumTenant, getAdminSessionKey, applyEvalSubscriptionOverrides } from '../../../lib/subscription';
import { getSessionFromRequest } from '../../../lib/webAuth';

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'summary';
  const tenantId = searchParams.get('tenantId') || 'titan';

  const session = await getSessionFromRequest(req);
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Master Admin sign-in required' }, { status: 401 });
  }

  const adminSessionKey = getAdminSessionKey(session);
  let state;
  try {
    if (await isSupabaseReady()) {
      state = await getSupabaseAppState(adminSessionKey);
    } else {
      state = getLocalStateWithMonitoring();
      applyEvalSubscriptionOverrides(state, adminSessionKey);
    }
  } catch {
    state = getLocalStateWithMonitoring();
    applyEvalSubscriptionOverrides(state, adminSessionKey);
  }

  if (!isPremiumTenant(state, tenantId)) {
    return NextResponse.json(
      { error: 'CSV report exports require a Premium subscription.' },
      { status: 403 }
    );
  }

  const guards = state.guards?.[tenantId] || [];
  const premises = state.premises?.[tenantId] || [];
  const attendance = (state.attendance?.[tenantId] || []).filter((a) => a.status === 'On Duty' || a.status === 'Late');
  const checkpoints = state.checkpoints?.[tenantId] || [];
  const alerts = (state.guardAlerts?.[tenantId] || []).filter((a) => a.status === 'Active');
  const ob = (state.occurrenceBook || []).filter((e) => !e.tenantId || e.tenantId === tenantId);

  if (type === 'attendance') {
    const rows = [
      ['Guard', 'Site', 'Clock In', 'Status', 'Late Minutes'].join(','),
      ...attendance.map((a) => {
        const g = guards.find((x) => x.id === a.guardId);
        const p = premises.find((x) => x.id === a.premiseId);
        return [g?.fullName, p?.name, a.clockIn, a.status, a.lateMinutes || 0].map(csvEscape).join(',');
      }),
    ];
    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="titan-attendance-${tenantId}.csv"`,
      },
    });
  }

  if (type === 'incidents') {
    const rows = [
      ['Timestamp', 'Type', 'Guard', 'Status', 'Description'].join(','),
      ...ob.filter((e) => e.type && !['Patrol Tap', 'Shift Clock-In', 'Shift Clock-Out'].includes(e.type)).map((e) =>
        [e.timestamp, e.type, e.guardName, e.status, e.description].map(csvEscape).join(',')
      ),
    ];
    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="titan-incidents-${tenantId}.csv"`,
      },
    });
  }

  const compliance = patrolComplianceRate(checkpoints);
  const summary = [
    ['Metric', 'Value'].join(','),
    ['Guards on duty', attendance.length].join(','),
    ['Active alerts', alerts.length].join(','),
    ['Patrol compliance %', compliance].join(','),
    ['Open incidents', ob.filter((e) => e.status && e.status !== 'Resolved').length].join(','),
    ['Generated at', new Date().toISOString()].join(','),
  ];
  return new NextResponse(summary.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="titan-summary-${tenantId}.csv"`,
    },
  });
}
