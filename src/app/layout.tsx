import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import TopNav from '@/components/TopNav';

const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-grotesk' });

export const metadata: Metadata = {
  title: 'Overline — аналитика футбольных матчей',
  description: 'Линия, движение денег, статистика арбитров и ИИ-разбор матчей',
};
export const viewport: Viewport = { themeColor: '#0a0c13', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="px-4 pb-24 md:px-8 md:pb-10">
          <TopNav />
          <main className="mx-auto max-w-[1560px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
