import { NextRequest, NextResponse } from 'next/server';
import { buildPlan, STRATEGIES, type StrategyKey } from '@/lib/analytics/bankroll';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const bank = Math.max(100, Math.min(100_000_000, Number(p.get('bank') ?? 10000)));
  const key = (p.get('strategy') ?? 'balanced') as StrategyKey;
  const goal = Math.max(1.2, Math.min(10, Number(p.get('goal') ?? 2)));
  const day = p.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
  if (!STRATEGIES[key]) return NextResponse.json({ error: 'неизвестная стратегия' }, { status: 400 });
  return NextResponse.json({ plan: buildPlan(bank, key, goal, day) });
}
