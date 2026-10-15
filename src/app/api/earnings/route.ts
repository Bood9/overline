import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth/session';
import { buildEarningsPlan, commitPlan, settlePending, EarningsError } from '@/lib/analytics/earnings';
export const dynamic = 'force-dynamic';

const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function validate(balance: number, target: number) {
  if (!(balance >= 100) || balance > 1e9) return 'Баланс должен быть от 100 до 1 000 000 000';
  if (!(target > 0)) return 'Минимальный заработок должен быть больше нуля';
  if (target > balance) return 'Цель на день больше всего баланса — так не бывает без ставки ва-банк';
  return null;
}

/** Preview a plan for the given balance and daily target. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const balance = num(p.get('balance')), target = num(p.get('target'));
  const err = validate(balance, target);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  settlePending();
  return NextResponse.json({ plan: buildEarningsPlan({ balance, target, day: p.get('day') ?? undefined }) });
}

/** Freeze the plan for the day. Stakes are recomputed server-side. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const balance = num(body.balance), target = num(body.target);
  const err = validate(balance, target);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  try {
    return NextResponse.json({ day: commitPlan({ balance, target, day: body.day }) });
  } catch (e) {
    if (e instanceof EarningsError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
