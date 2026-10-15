type P = { className?: string };
const s = (p: P) => ({ className: p.className ?? 'h-5 w-5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' });

export const IconHome = (p: P) => (<svg {...s(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5h5v5" /></svg>);
export const IconCalendar = (p: P) => (<svg {...s(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>);
export const IconNews = (p: P) => (<svg {...s(p)}><rect x="3" y="4" width="14" height="16" rx="2" /><path d="M17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-2M6.5 8h7M6.5 12h7M6.5 16h4" /></svg>);
export const IconTools = (p: P) => (<svg {...s(p)}><path d="M14.7 6.3a4 4 0 0 0 5 5L15 16l-3 3-4-4 3-3 3.7-5.7z" /><path d="M7 21l-3-3" /></svg>);
export const IconUser = (p: P) => (<svg {...s(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 19a6 6 0 0 1 11 0" /></svg>);
export const IconSearch = (p: P) => (<svg {...s(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconTarget = (p: P) => (<svg {...s(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>);
export const IconCalc = (p: P) => (<svg {...s(p)}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0" /></svg>);
export const IconWhistle = (p: P) => (<svg {...s(p)}><path d="M14.7 6.3a4 4 0 0 0 5 5L15 16l-3 3-4-4 3-3 3.7-5.7z" /><path d="M7 21l-3-3" /></svg>);
export const IconMoney = (p: P) => (<svg {...s(p)}><circle cx="8" cy="12" r="4.5" /><circle cx="16" cy="12" r="4.5" /><path d="M8 10v4M16 10v4" /></svg>);
export const IconTrend = (p: P) => (<svg {...s(p)}><path d="M3 8l5 6 4-3 4 5 5-9" /></svg>);
export const IconClock = (p: P) => (<svg {...s(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconStar = (p: P & { filled?: boolean }) => (
  <svg {...s(p)} fill={p.filled ? 'currentColor' : 'none'}>
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9L12 3.6z" />
  </svg>
);
export const IconSpark = (p: P) => (<svg {...s(p)}><path d="M12 3v4M12 17v4M4.9 7.5l2.8 2.8M16.3 13.7l2.8 2.8M3 12h4M17 12h4M4.9 16.5l2.8-2.8M16.3 10.3l2.8-2.8" /></svg>);
export const IconChevron = (p: P) => (<svg {...s(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconArrow = (p: P) => (<svg {...s(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconRefresh = (p: P) => (<svg {...s(p)}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4h-4" /></svg>);
export const IconGear = (p: P) => (<svg {...s(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 14a7.9 7.9 0 0 0 .1-2l2-1.4-2-3.4-2.3.9a8 8 0 0 0-1.7-1L15 4.6h-4l-.5 2.5a8 8 0 0 0-1.7 1l-2.3-.9-2 3.4L6.5 12a7.9 7.9 0 0 0 0 2l-2 1.4 2 3.4 2.3-.9a8 8 0 0 0 1.7 1l.5 2.5h4l.5-2.5a8 8 0 0 0 1.7-1l2.3.9 2-3.4-2.1-1.4z" /></svg>);
export const IconLogout = (p: P) => (<svg {...s(p)}><path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" /><path d="M10 12h10M17 8l3 4-3 4" /></svg>);
export const IconShield = (p: P) => (<svg {...s(p)}><path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconBell = (p: P) => (<svg {...s(p)}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>);
export const IconMoon = (p: P) => (<svg {...s(p)}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>);
export const IconSun = (p: P) => (<svg {...s(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>);
export const IconPlus = (p: P) => (<svg {...s(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconWallet = (p: P) => (<svg {...s(p)}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16.5 14.5h.01" /><path d="M17 6V4.5a1.5 1.5 0 0 0-1.9-1.44L5 5.5" /></svg>);
