/** Client-safe SQL preset queries (no pg import). */
export const SQL_PRESETS = [
  {
    label: 'Guards overview',
    sql: `SELECT id, full_name, phone, email, status, territory_id, created_at
FROM guards ORDER BY created_at DESC`,
  },
  {
    label: 'Premises with GPS',
    sql: `SELECT id, name, address, city, suburb, lat, lng, territory_id, status
FROM premises ORDER BY name`,
  },
  {
    label: 'On-duty attendance',
    sql: `SELECT id, guard_id, premise_id, status, clock_in, late_minutes
FROM attendance WHERE status IN ('On Duty', 'Late') ORDER BY clock_in DESC`,
  },
  {
    label: 'Active guard alerts',
    sql: `SELECT id, type, severity, guard_id, guard_name, message, status, created_at
FROM guard_alerts WHERE status = 'Active' ORDER BY created_at DESC`,
  },
  {
    label: 'Recent occurrence book',
    sql: `SELECT id, type, guard_name, description, status, timestamp
FROM occurrence_book ORDER BY timestamp DESC`,
  },
  {
    label: 'NFC places',
    sql: `SELECT id, premise_id, name, type, lat, lng, has_nfc, nfc_code, schedule
FROM places ORDER BY premise_id, name`,
  },
  {
    label: 'Shifts this week',
    sql: `SELECT id, guard_id, premise_id, date, start_time, end_time, status
FROM shifts ORDER BY date DESC, start_time`,
  },
  {
    label: 'Table row counts',
    sql: `SELECT 'guards' AS table_name, COUNT(*)::int AS rows FROM guards
UNION ALL SELECT 'premises', COUNT(*)::int FROM premises
UNION ALL SELECT 'places', COUNT(*)::int FROM places
UNION ALL SELECT 'attendance', COUNT(*)::int FROM attendance
UNION ALL SELECT 'guard_alerts', COUNT(*)::int FROM guard_alerts
UNION ALL SELECT 'occurrence_book', COUNT(*)::int FROM occurrence_book
ORDER BY table_name`,
  },
];
