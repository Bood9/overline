import { NextRequest, NextResponse } from 'next/server';
import { getInsights, getInsightStats } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const day = (p.get('day') as 'today' | 'tomorrow') ?? 'today';
  return NextResponse.json({
    rows: getInsights({ day, category: p.get('category') ?? 'all', limit: Number(p.get('limit') ?? 40) }),
    stats: getInsightStats(day),
  });
}
