import { NextRequest, NextResponse } from 'next/server';
import { getNews } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return NextResponse.json({
    rows: getNews({ source: p.get('source') ?? undefined, q: p.get('q') ?? undefined, limit: Number(p.get('limit') ?? 60) }),
  });
}
