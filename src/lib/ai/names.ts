/**
 * Optional polish pass: ask Gemini for the canonical Russian spelling of clubs
 * the dictionary doesn't know. Result is written back to teams.name_ru, so this
 * runs once per new club and never on a request path.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { all, run, logIngest } from '@/lib/db';
import { teamRu, TEAM_RU } from '@/lib/util/ru';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

export async function normalizeTeamNames(limit = 120): Promise<{ updated: number; skipped: number }> {
  if (!process.env.GEMINI_API_KEY) return { updated: 0, skipped: 0 };
  const known = new Set(Object.keys(TEAM_RU));
  const rows = all<{ id: number; name: string; name_ru: string | null; country: string | null }>(
    `SELECT t.id, t.name, t.name_ru, t.country FROM teams t
      WHERE t.name NOT LIKE '%[а-яё]%'
      ORDER BY (SELECT COUNT(*) FROM fixtures f WHERE f.home_id=t.id OR f.away_id=t.id) DESC
      LIMIT @limit`,
    { limit },
  ).filter((t) => !known.has(t.name) && t.name_ru === teamRu(t.name));

  if (!rows.length) return { updated: 0, skipped: 0 };
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const t0 = Date.now();
  let updated = 0;

  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: `Дай общепринятые русские названия футбольных клубов.\n${chunk
          .map((c) => `${c.id}: ${c.name}${c.country ? ` (${c.country})` : ''}`)
          .join('\n')}`,
        config: {
          systemInstruction:
            'Ты справочник футбольных клубов. Для каждого клуба верни русское название так, как его пишут российские спортивные СМИ. ' +
            'Без кавычек, без города-уточнения в скобках, если он не нужен для различения. Если не уверен — верни аккуратную транслитерацию.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { id: { type: Type.INTEGER }, ru: { type: Type.STRING } },
              required: ['id', 'ru'],
            },
          } as any,
          temperature: 0.1,
        },
      });
      const list = JSON.parse(res.text ?? '[]') as { id: number; ru: string }[];
      for (const item of list) {
        if (!item?.ru || !/[а-яё]/i.test(item.ru)) continue;
        run(`UPDATE teams SET name_ru=@ru WHERE id=@id`, { ru: item.ru.trim(), id: item.id });
        updated++;
      }
    } catch {
      /* one bad chunk must not kill the pass */
    }
  }
  logIngest('names', 'ok', `${rows.length} candidates`, updated, Date.now() - t0);
  return { updated, skipped: rows.length - updated };
}
