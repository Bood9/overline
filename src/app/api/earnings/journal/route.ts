import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth/session';
import { getJournal, settlePending, deleteDay, resetJournal, EarningsError } from '@/lib/analytics/earnings';
export const dynamic = 'force-dynamic';

export async function GET() {
  const settled = settlePending();
  return NextResponse.json({ journal: getJournal(), settled });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });
  const p = req.nextUrl.searchParams;
  try {
    if (p.get('all') === '1') {
      resetJournal();
      return NextResponse.json({ ok: true });
    }
    const day = p.get('day');
    if (!day) return NextResponse.json({ error: 'day обязателен' }, { status: 400 });
    return NextResponse.json({ ok: deleteDay(day) });
  } catch (e) {
    if (e instanceof EarningsError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
