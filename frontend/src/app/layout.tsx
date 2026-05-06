import type { Metadata } from 'next';
import { ThemeProvider, THEME_VARS } from '@/lib/theme';
import { TopNav } from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Prozorro Analytics — безкоштовна аналітика держзакупівель',
  description: 'Аналіз тендерів Prozorro, перевірка компаній, зв\'язки засновників. Безкоштовно.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
        <style dangerouslySetInnerHTML={{ __html: THEME_VARS }}/>
      </head>
      <body>
        <ThemeProvider>
          <TopNav/>
          <main style={{ minHeight:'calc(100vh - 52px)' }}>
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
