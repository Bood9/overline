import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth/session';
import { analyzeFixture, cachedPrediction, geminiEnabled } from '@/lib/ai/gemini';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get('fixture'));
  if (!id) return NextResponse.json({ error: 'fixture обязателен' }, { status: 400 });
  const cached = cachedPrediction(id);
  return NextResponse.json({ prediction: cached, enabled: geminiEnabled() });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.fixture);
  if (!id) return NextResponse.json({ error: 'fixture обязателен' }, { status: 400 });
  if (!geminiEnabled()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY не задан. Добавь ключ в .env.local и перезапусти сервер.' }, { status: 503 });
  }
  try {
    const prediction = await analyzeFixture(id, !!body.force);
    return NextResponse.json({ prediction });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Ошибка ИИ' }, { status: 500 });
  }
}
