import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx>({ mode: 'system', resolved: 'dark', setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('govibe-theme');
    return (stored as ThemeMode) || 'system';
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [resolved]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('govibe-theme', m);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: '라이트', icon: '☀️' },
    { value: 'dark', label: '다크', icon: '🌙' },
    { value: 'system', label: '시스템', icon: '💻' },
  ];

  return (
    <div className={`inline-flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden ${className}`}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => setMode(o.value)}
          className={`px-2.5 py-1 text-xs transition-colors ${
            mode === o.value
              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
          title={o.label}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
