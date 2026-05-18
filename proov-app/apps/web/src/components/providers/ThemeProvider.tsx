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

function applyVariant(variant: ThemeVariant) {
  const root = document.documentElement;
  Object.entries(variant).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.background = variant['--bg'];
  document.body.style.background = variant['--bg'];
  document.body.style.color = variant['--text'];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('bloom');
  const [mode, setModeState] = useState<ColorMode>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('proov_theme') as ThemeId) || 'bloom';
    const savedMode = (localStorage.getItem('proov_mode') as ColorMode) || 'system';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    setThemeIdState(THEMES[savedTheme] ? savedTheme : 'bloom');
    setModeState(savedMode);
    setMounted(true);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyVariant(resolveThemeVariant(themeId, mode, systemDark));
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
