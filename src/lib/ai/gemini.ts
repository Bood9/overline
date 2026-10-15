import { GoogleGenAI, Type } from '@google/genai';
import { all, one, run } from '@/lib/db';
import { buildFixtureContext } from './context';

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

let client: GoogleGenAI | null = null;
function ai() {
  if (!geminiEnabled()) throw new Error('GEMINI_API_KEY не задан');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return client;
}

const SYSTEM = `Ты — спортивный аналитик Overline (футбол, хоккей, баскетбол, киберспорт). Тебе дают срез данных по матчу:
форма команд, модель Пуассона, коэффициенты и их движение, оценка распределения денег,
профиль арбитра, личные встречи и новости.

Правила:
- Отвечай только на русском языке.
- Опирайся ТОЛЬКО на переданные данные. Если данных мало — прямо говори об этом и снижай уверенность.
- Не выдумывай числа, составы, травмы и факты, которых нет во входных данных.
- Уверенность (confidence) 0-100 отражает силу схождения сигналов, а не желание сделать ставку.
- Разбирай те рынки, по которым переданы данные: исход, тоталы, форы, а для футбола также обе забьют, карточки, фолы и угловые.
- Если во входных данных сказано, что статистики команд нет, ограничься разбором линии и стакана и прямо скажи, что фундаментальных данных не было.
- Пиши коротко и по делу, без воды и без призывов ставить деньги.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, description: 'Один ёмкий вывод по матчу, до 120 символов' },
    confidence: { type: Type.INTEGER, description: '0-100 общая уверенность в разборе' },
    expected_score: { type: Type.STRING, description: 'Ожидаемый счёт, например 1:1' },
    analysis: { type: Type.STRING, description: 'Разбор на 3-5 предложений' },
    picks: {
      type: Type.ARRAY,
      description: 'От 2 до 5 рекомендаций по разным рынкам, сильнейшая первой',
      items: {
        type: Type.OBJECT,
        properties: {
          market: { type: Type.STRING, description: 'Исход | Тотал голов | Обе забьют | Карточки | Фолы | Угловые | Фора | Двойной шанс' },
          selection: { type: Type.STRING, description: 'Ставка человекочитаемо: П1, ТМ 3.5, ЖК ТБ 4.5 и т.д.' },
          confidence: { type: Type.INTEGER },
          value: { type: Type.STRING, description: 'есть | нет | спорно — есть ли перевес над линией' },
          reason: { type: Type.STRING, description: 'Почему, 1-2 предложения со ссылкой на конкретные цифры' },
        },
        required: ['market', 'selection', 'confidence', 'reason'],
      },
    },
    risks: { type: Type.ARRAY, description: '1-3 риска', items: { type: Type.STRING } },
  },
  required: ['verdict', 'confidence', 'analysis', 'picks'],
} as const;

export interface AiPrediction {
  verdict: string; confidence: number; expected_score?: string; analysis: string;
  picks: { market: string; selection: string; confidence: number; value?: string; reason: string }[];
  risks?: string[];
  model?: string; created_at?: string; cached?: boolean;
}

const TTL_MIN = Number(process.env.AI_CACHE_MINUTES || 180);

export function cachedPrediction(fixtureId: number): AiPrediction | null {
  const row = one<{ payload: string; model: string; created_at: string }>(
    `SELECT payload, model, created_at FROM ai_predictions
      WHERE fixture_id=@id AND created_at > datetime('now', @ttl)
      ORDER BY created_at DESC LIMIT 1`,
    { id: fixtureId, ttl: `-${TTL_MIN} minutes` },
  );
  if (!row) return null;
  try {
    return { ...JSON.parse(row.payload), model: row.model, created_at: row.created_at, cached: true };
  } catch {
    return null;
  }
}

export async function analyzeFixture(fixtureId: number, force = false): Promise<AiPrediction> {
  if (!force) {
    const c = cachedPrediction(fixtureId);
    if (c) return c;
  }
  const ctx = buildFixtureContext(fixtureId);
  if (!ctx) throw new Error('Матч не найден');
  if (!geminiEnabled()) throw new Error('GEMINI_API_KEY не задан — добавь ключ в .env.local');

  const res = await ai().models.generateContent({
    model: MODEL,
    contents: `${ctx.text}\n\nСделай разбор матча и дай рекомендации по рынкам.`,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA as any,
      temperature: 0.4,
      maxOutputTokens: 2600,
    },
  });

  const raw = res.text ?? '';
  let parsed: AiPrediction;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Gemini вернул неразбираемый ответ');
    parsed = JSON.parse(m[0]);
  }

  run(
    `INSERT INTO ai_predictions(fixture_id,model,verdict,confidence,payload)
     VALUES(@fixture_id,@model,@verdict,@confidence,@payload)`,
    {
      fixture_id: fixtureId, model: MODEL, verdict: parsed.verdict ?? '',
      confidence: parsed.confidence ?? 0, payload: JSON.stringify(parsed),
    },
  );
  return { ...parsed, model: MODEL, created_at: new Date().toISOString() };
}

/** Top picks of the day, built from the strongest convergence fixtures. */
export async function dailyDigest(limit = 6): Promise<{ fixture_id: number; prediction: AiPrediction }[]> {
  const fixtures = all<{ fixture_id: number }>(
    `SELECT i.fixture_id, MAX(i.score) AS top
       FROM insights i JOIN fixtures f ON f.id=i.fixture_id
      WHERE f.status='NS' AND datetime(f.kickoff) BETWEEN datetime('now') AND datetime('now','+36 hours')
      GROUP BY i.fixture_id ORDER BY top DESC LIMIT @limit`,
    { limit },
  );
  const out: { fixture_id: number; prediction: AiPrediction }[] = [];
  for (const f of fixtures) {
    try {
      out.push({ fixture_id: f.fixture_id, prediction: await analyzeFixture(f.fixture_id) });
    } catch { /* keep going — one bad fixture must not kill the digest */ }
  }
  return out;
}
