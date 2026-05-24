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

export const THEME_VARS = `
  :root[data-theme="light"] {
    --bg:        #F5F7FA;
    --bg2:       #FFFFFF;
    --bg3:       #EEF2F7;
    --border:    #D1DCE8;
    --border2:   #B0C4D8;
    --text:      #0B1B33;
    --text2:     #1E3A5F;
    --muted:     #4A6080;
    --faint:     #7A95B0;
    --accent:    #0073FF;
    --accent2:   #0058CC;
    --nav-bg:    #0B1B33;
    --nav-text:  #FFFFFF;
    --green:     #10b981;
    --red:       #ef4444;
    --amber:     #f59e0b;
    --purple:    #8b5cf6;
    --tag-bg:    #E8F0FF;
    --tag-text:  #0073FF;
    --sidebar-w: 220px;
  }
  :root[data-theme="dark"] {
    --bg:        #0B1B33;
    --bg2:       #0D2144;
    --bg3:       #102650;
    --border:    #1A3560;
    --border2:   #234070;
    --text:      #FFFFFF;
    --text2:     #C8D8F0;
    --muted:     #8AA8CC;
    --faint:     #5A7A99;
    --accent:    #0073FF;
    --accent2:   #3395FF;
    --nav-bg:    #060E1A;
    --nav-text:  #FFFFFF;
    --green:     #4ade80;
    --red:       #f87171;
    --amber:     #fbbf24;
    --purple:    #a78bfa;
    --tag-bg:    #0D2A55;
    --tag-text:  #5BA3FF;
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
