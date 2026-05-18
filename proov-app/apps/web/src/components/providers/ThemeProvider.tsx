'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { THEMES, resolveThemeVariant, type ThemeId, type ColorMode, type ThemeVariant } from '@/lib/themes';

interface ThemeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ColorMode) => void;
  variant: ThemeVariant;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'bloom',
  mode: 'system',
  setThemeId: () => {},
  setMode: () => {},
  variant: THEMES.bloom.light,
});

function applyVariant(variant: ThemeVariant, themeId: string, isDark: boolean) {
  const root = document.documentElement;
  Object.entries(variant).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.background = variant['--bg'];
  document.body.style.background = variant['--bg'];
  document.body.style.color = variant['--text'];
  root.setAttribute('data-theme', themeId);
  root.setAttribute('data-mode', isDark ? 'dark' : 'light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('bloom');
  const [mode, setModeState] = useState<ColorMode>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('proov_theme') as ThemeId) || 'bloom';
    const savedMode = (localStorage.getItem('proov_mode') as ColorMode) || 'light';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    setThemeIdState(THEMES[savedTheme] ? savedTheme : 'bloom');
    setModeState(savedMode);
    setMounted(true);

    const mqHandler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', mqHandler);

    // Pick up theme/mode changes dispatched from auth pages
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'proov_theme') {
        const t = (e.newValue as ThemeId) || 'bloom';
        if (THEMES[t]) setThemeIdState(t);
      }
      if (e.key === 'proov_mode') {
        setModeState((e.newValue as ColorMode) || 'light');
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      mq.removeEventListener('change', mqHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const isDark = mode === 'dark' || (mode === 'system' && systemDark);
    applyVariant(resolveThemeVariant(themeId, mode, systemDark), themeId, isDark);
  }, [themeId, mode, systemDark, mounted]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem('proov_theme', id);
  }, []);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    localStorage.setItem('proov_mode', m);
  }, []);

  const variant = resolveThemeVariant(themeId, mode, systemDark);

  return (
    <ThemeContext.Provider value={{ themeId, mode, setThemeId, setMode, variant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
