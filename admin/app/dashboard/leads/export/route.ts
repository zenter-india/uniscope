import { NextRequest, NextResponse } from 'next/server';
import { backendFetchText } from '../../../../lib/backend';

/** Proxies the CSV export through the admin session — the backend endpoint
 * requires the ADMIN JWT that only ever exists server-side (see
 * lib/backend.ts), so a direct browser link to the backend can't work. */
export async function GET(request: NextRequest) {
  const qs = request.nextUrl.searchParams.toString();
  const csv = await backendFetchText(`/enrollments/export${qs ? `?${qs}` : ''}`);
  // The Account creation page asks for the sign-ups without an account, so its
  // download says so in its name.
  const account = request.nextUrl.searchParams.get('account');
  const filename =
    account === 'failed'
      ? 'uniscope-account-creation-needs-attention.csv'
      : account === 'missing'
        ? 'uniscope-account-creation-all-without-account.csv'
        : 'uniscope-enrollments.csv';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
