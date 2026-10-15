import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '@/lib/util/http';
import { run, logIngest } from '@/lib/db';
import crypto from 'node:crypto';

export interface FeedDef { source: string; url: string }

export const FEEDS: FeedDef[] = (process.env.NEWS_FEEDS
  ? JSON.parse(process.env.NEWS_FEEDS)
  : [
      { source: 'Чемпионат', url: 'https://www.championat.com/rss/news/football/' },
      { source: 'Sports.ru', url: 'https://www.sports.ru/rss/rubric.xml?s=208' },
      { source: 'Чемпионат · всё', url: 'https://www.championat.com/rss/news/' },
      { source: 'Sports.ru · главное', url: 'https://www.sports.ru/rss/main.xml' },
    ]) as FeedDef[];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const id = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const strip = (s = '') => String(s).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();

function pickImage(item: any): string | null {
  const c = item['media:content'] ?? item['media:thumbnail'] ?? item.enclosure;
  const node = Array.isArray(c) ? c[0] : c;
  const url = node?.['@_url'] ?? node?.['@_href'];
  if (url) return String(url);
  const html = String(item['content:encoded'] ?? item.description ?? '');
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export async function ingestNews(): Promise<{ items: number; errors: string[] }> {
  const t0 = Date.now();
  let items = 0;
  const errors: string[] = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchWithRetry<string>(feed.url, { as: 'text', retries: 1, timeoutMs: 12000 });
      const doc = parser.parse(xml);
      const list = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
      for (const it of Array.isArray(list) ? list : [list]) {
        const link = String(it.link?.['@_href'] ?? it.link ?? it.guid?.['#text'] ?? it.guid ?? '').trim();
        const title = strip(it.title?.['#text'] ?? it.title);
        if (!link || !title) continue;
        const published = new Date(it.pubDate ?? it.published ?? it.updated ?? Date.now()).toISOString();
        run(
          `INSERT INTO news(id,source,title,url,image,summary,published_at)
           VALUES(@id,@source,@title,@url,@image,@summary,@published_at)
           ON CONFLICT(id) DO UPDATE SET title=@title, image=COALESCE(@image,news.image),
             summary=COALESCE(@summary,news.summary)`,
          {
            id: id(link), source: feed.source, title, url: link,
            image: pickImage(it), summary: strip(it.description ?? it.summary ?? '').slice(0, 600) || null,
            published_at: published,
          },
        );
        items++;
      }
    } catch (e: any) {
      errors.push(`${feed.source}: ${e?.message ?? e}`);
    }
  }
  run(`DELETE FROM news WHERE datetime(published_at) < datetime('now','-14 days')`);
  logIngest('news', errors.length ? 'partial' : 'ok', errors.join('; '), items, Date.now() - t0);
  return { items, errors };
}
