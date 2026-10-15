import { NextRequest, NextResponse } from 'next/server';
import { getMoneyway } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return NextResponse.json({
    rows: getMoneyway({
      mode: (p.get('mode') as any) ?? 'money',
      market: p.get('market') ?? '1X2',
      phase: (p.get('phase') as any) ?? 'prematch',
      sort: (p.get('sort') as any) ?? 'share',
      country: p.get('country') || undefined,
      league: p.get('league') || undefined,
      q: p.get('q') || undefined,
      limit: Number(p.get('limit') ?? 60),
    }),
  });
}
