import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth/session';
import { runSchedule, runLiveTick, runOddsTick, runBackfill, ingestNews, ingestStats } from '@/lib/ingest/run';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Called by the local worker, by `npm run ingest`, or by a Vercel cron. */
export async function GET(req: NextRequest) {
  // either a logged-in session, or a real shared secret (Vercel cron sends it as a Bearer token)
  const secret = process.env.CRON_SECRET;
  const secretOk = !!secret && secret !== 'change-me' && secret.length >= 16 &&
    req.headers.get('authorization') === `Bearer ${secret}`;
  if (!secretOk && !isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const job = req.nextUrl.searchParams.get('job') ?? 'schedule';
  try {
    const result =
      job === 'live' ? await runLiveTick()
      : job === 'odds' ? await runOddsTick()
      : job === 'news' ? await ingestNews()
      : job === 'stats' ? await ingestStats(40)
      : job === 'backfill' ? await runBackfill(Number(req.nextUrl.searchParams.get('days') ?? 30))
      : await runSchedule();
    return NextResponse.json({ ok: true, job, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, job, error: e?.message ?? String(e) }, { status: 500 });
  }
}
