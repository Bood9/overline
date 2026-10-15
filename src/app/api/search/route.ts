import { NextRequest, NextResponse } from 'next/server';
import { searchFixtures } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: searchFixtures(q, 12) });
}
