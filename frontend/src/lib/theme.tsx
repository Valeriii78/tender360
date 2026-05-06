'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light', toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) setTheme(saved);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// CSS змінні для обох тем
export const THEME_VARS = `
  :root[data-theme="light"] {
    --bg:        #f7f8fa;
    --bg2:       #ffffff;
    --bg3:       #f0f4f8;
    --border:    #e2e8f0;
    --border2:   #cbd5e1;
    --text:      #0f172a;
    --text2:     #334155;
    --muted:     #64748b;
    --faint:     #94a3b8;
    --accent:    #0ea5e9;
    --accent2:   #0284c7;
    --green:     #10b981;
    --red:       #ef4444;
    --amber:     #f59e0b;
    --purple:    #8b5cf6;
    --tag-bg:    #eff6ff;
    --tag-text:  #1d4ed8;
    --sidebar-w: 220px;
  }
  :root[data-theme="dark"] {
    --bg:        #0c0f14;
    --bg2:       #111827;
    --bg3:       #1a2035;
    --border:    #1e293b;
    --border2:   #334155;
    --text:      #f1f5f9;
    --text2:     #cbd5e1;
    --muted:     #94a3b8;
    --faint:     #64748b;
    --accent:    #38bdf8;
    --accent2:   #0ea5e9;
    --green:     #4ade80;
    --red:       #f87171;
    --amber:     #fbbf24;
    --purple:    #a78bfa;
    --tag-bg:    #1e3a5f;
    --tag-text:  #93c5fd;
    --sidebar-w: 220px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; transition: background-color .2s, color .2s, border-color .2s; }
  body { background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', sans-serif; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  input, select, button { font-family: inherit; outline: none; }
`;
