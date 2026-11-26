import { NextRequest, NextResponse } from 'next/server';
import { backendFetchText } from '../../../../lib/backend';
import { isRealDay, moneyQueryString, PLATFORMS } from '../days';
import type { Platform } from '../types';

const BOM = String.fromCharCode(0xfeff);

/** Proxies the CSV export through the admin session — the backend endpoint
 * needs the ADMIN token that only exists server-side (see lib/backend.ts), so
 * a direct browser link to the backend can't work. Only known filters are
 * passed on. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const platform = sp.get('platform') as Platform | null;
  const qs = moneyQueryString({
    days: Number(sp.get('days')) || undefined,
    from: isRealDay(sp.get('from')) ? (sp.get('from') as string) : undefined,
    to: isRealDay(sp.get('to')) ? (sp.get('to') as string) : undefined,
    platform: platform && PLATFORMS.includes(platform) ? platform : undefined,
    q: sp.get('q') ?? undefined,
  });

  try {
    const csv = await backendFetchText(`/admin/money/topups/export${qs ? `?${qs}` : ''}`);
    // The backend starts the file with a byte-order mark so Excel opens names
    // as UTF-8, but reading the response as text drops it. Put it back.
    const body = csv.startsWith(BOM) ? csv : `${BOM}${csv}`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="uniscope-topups.csv"',
      },
    });
  } catch (e) {
    return new NextResponse(
      e instanceof Error ? e.message : 'The export is unavailable right now.',
      { status: 502 },
    );
  }
}
