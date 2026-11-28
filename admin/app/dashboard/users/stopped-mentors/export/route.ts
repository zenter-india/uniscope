import { NextResponse } from 'next/server';
import { backendFetchText } from '../../../../../lib/backend';

/** Proxies the CSV of mentors who stopped before submitting a college ID through
 * the admin session: the backend endpoint needs the ADMIN token that only ever
 * exists server-side (see lib/backend.ts). It lives under the Users section, so
 * only an admin who can view Users can download it. */
export async function GET() {
  const csv = await backendFetchText('/users/stopped-mentors/export');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="uniscope-mentors-who-stopped.csv"',
    },
  });
}
