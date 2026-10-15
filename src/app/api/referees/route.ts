import { NextRequest, NextResponse } from 'next/server';
import { getReferees } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return NextResponse.json({
    rows: getReferees({ league: p.get('league') ?? undefined, sort: (p.get('sort') as any) ?? 'yellow', limit: Number(p.get('limit') ?? 60) }),
  });
}
