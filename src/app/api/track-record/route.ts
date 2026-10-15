import { NextResponse } from 'next/server';
import { getTrackRecord, settlePredictions } from '@/lib/analytics/track-record';
export const dynamic = 'force-dynamic';

export async function GET() {
  settlePredictions();
  return NextResponse.json({ record: getTrackRecord() });
}
