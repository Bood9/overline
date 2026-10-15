'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Toggle } from '@/components/ui';
import { IconGear, IconMoon, IconSun, IconClock, IconLogout, IconPlus, IconBell, IconSpark, IconNews, IconShield } from '@/components/Icons';

const TZS = ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Almaty', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'UTC'];

type Settings = { theme: 'dark' | 'light'; tz: string; notifyStart: boolean; notifyAi: boolean; notifyNews: boolean; favorites: string[] };
const DEFAULTS: Settings = { theme: 'dark', tz: 'Europe/Moscow', notifyStart: true, notifyAi: true, notifyNews: false, favorites: [] };

export default function ProfilePage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [health, setHealth] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('overline:settings');
      if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* private mode */ }
    setReady(true);
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem('overline:settings', JSON.stringify(s)); } catch { /* ignore */ }
    document.documentElement.dataset.theme = s.theme;
  }, [s, ready]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  return (
    <div className="mx-auto max-w-[900px]">
      <header className="mb-6 border-b border-line pb-5">
        <h1 className="text-[26px] font-bold">Профиль</h1>
        <p className="mt-0.5 text-[13px] text-mute">Оформление, уведомления и состояние источников данных</p>
      </header>

      <div className="panel mb-6 flex items-center gap-4 p-5">
        <div className="display flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand-3 to-brand-2 text-[17px] font-bold text-white">OL</div>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold">Аналитик</div>
          <div className="text-[12px] text-mute">Все разделы открыты · {s.tz}</div>
        </div>
        <span className="rounded border border-teal/40 bg-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal">
          полный доступ
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute"><IconGear className="h-4 w-4" /></span>
      </div>

      <Section label="Настройки профиля" title="Оформление">
        <Row icon={s.theme === 'dark' ? <IconMoon className="h-4 w-4" /> : <IconSun className="h-4 w-4" />}
          title="Тема" sub={s.theme === 'dark' ? 'Текущая тёмная тема' : 'Текущая светлая тема'}>
          <div className="flex gap-1 rounded-lg border border-line bg-panel-2 p-1">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} onClick={() => set('theme', t)}
                className={clsx('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition',
                  s.theme === t ? 'bg-brand text-white' : 'text-mute hover:text-slate-200')}>
                {t === 'dark' ? <IconMoon className="h-3.5 w-3.5" /> : <IconSun className="h-3.5 w-3.5" />}
                {t === 'dark' ? 'Тёмная' : 'Светлая'}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section label="Настройка уведомлений" title="Уведомления">
        <Row icon={<IconClock className="h-4 w-4" />} title="Начало матча" sub="За 30 минут до свистка">
          <Toggle on={s.notifyStart} onChange={(v) => set('notifyStart', v)} />
        </Row>
        <Row icon={<IconSpark className="h-4 w-4" />} title="Новый прогноз ИИ" sub="Для отслеживаемых матчей">
          <Toggle on={s.notifyAi} onChange={(v) => set('notifyAi', v)} />
        </Row>
        <Row icon={<IconNews className="h-4 w-4" />} title="Главные новости" sub="Только важное, раз в день">
          <Toggle on={s.notifyNews} onChange={(v) => set('notifyNews', v)} />
        </Row>
      </Section>

      <Section label="Время" title="Часовой пояс">
        <Row icon={<IconClock className="h-4 w-4" />} title="Время матчей" sub="Как показывать время начала">
          <select value={s.tz} onChange={(e) => set('tz', e.target.value)}
            className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] font-semibold outline-none">
            {TZS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Row>
      </Section>

      <Section label="Диагностика" title="Источники данных">
        {health ? (
          <>
            <Row icon={<IconShield className="h-4 w-4" />} title="ESPN — матчи, счёт, статистика" sub={`${health.data.fixtures} матчей · ${health.data.odds} коэффициентов`}>
              <Badge ok />
            </Row>
            <Row icon={<IconSpark className="h-4 w-4" />} title="Gemini" sub={health.providers.gemini ? 'Ключ активен' : 'GEMINI_API_KEY не задан'}>
              <Badge ok={health.providers.gemini} />
            </Row>
            <Row icon={<IconNews className="h-4 w-4" />} title="RSS новости" sub={`${health.data.news} материалов`}>
              <Badge ok={health.data.news > 0} />
            </Row>
            <Row
              icon={<IconBell className="h-4 w-4" />}
              title="API-Football · xG"
              sub={health.providers.apiFootball.enabled
                ? `осталось ${health.providers.apiFootball.left} запросов сегодня · xG есть у ${health.data.xg.fixturesWithXg} матчей и ${health.data.xg.teamsWithXg} команд`
                : 'ключ не задан — xG не собирается, модель считает по голам'}
            >
              <Badge ok={health.providers.apiFootball.enabled} optional />
            </Row>
            <Row
              icon={<IconShield className="h-4 w-4" />}
              title="Smarkets · биржа"
              sub={`${(health.data.sports ?? []).map((s: any) => `${s.sport}: ${s.n}`).join(' · ') || 'нет данных'}`}
            >
              <Badge ok />
            </Row>
            <Row icon={<IconBell className="h-4 w-4" />} title="The Odds API" sub={health.providers.oddsApi.enabled ? `осталось ${health.providers.oddsApi.left} кредитов` : 'ключ не задан (не обязателен)'}>
              <Badge ok={health.providers.oddsApi.enabled} optional />
            </Row>
          </>
        ) : (
          <div className="px-4 py-5 text-[13px] text-mute">Загрузка…</div>
        )}
      </Section>

      <div className="panel mt-4 p-1.5">
        <button
          data-testid="logout"
          onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[13.5px] font-semibold text-slate-200 hover:bg-white/5"
        >
          <IconLogout className="h-4 w-4" /> Выйти
        </button>
        <button
          onClick={() => { try { localStorage.removeItem('overline:settings'); } catch {} setS(DEFAULTS); }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[13.5px] font-semibold text-danger hover:bg-danger/10"
        >
          <IconLogout className="h-4 w-4" /> Сбросить настройки
        </button>
      </div>
    </div>
  );
}

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">{label}</div>
      <h2 className="mb-3 text-[18px] font-bold">{title}</h2>
      <div className="panel divide-y divide-line/60">{children}</div>
    </section>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{title}</div>
        <div className="truncate text-[11.5px] text-mute-2">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function Badge({ ok, optional }: { ok?: boolean; optional?: boolean }) {
  return (
    <span className={clsx('rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
      ok ? 'border-teal/40 bg-teal/10 text-teal' : optional ? 'border-line bg-white/5 text-mute-2' : 'border-warn/40 bg-warn/10 text-warn')}>
      {ok ? 'активен' : optional ? 'выключен' : 'нет ключа'}
    </span>
  );
}
