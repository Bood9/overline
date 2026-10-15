import { NextRequest, NextResponse } from 'next/server';
import { getMatchesByDate, getLiveMatches } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('live') === '1') return NextResponse.json({ live: getLiveMatches() });
  const date = p.get('date') ?? new Date().toISOString().slice(0, 10);
  return NextResponse.json({ groups: getMatchesByDate(date, null, p.get('liveOnly') === '1') });
}
