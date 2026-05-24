export type ThemeId = 'bloom' | 'midnight' | 'sakura' | 'aurora' | 'golden';
export type ColorMode = 'light' | 'dark' | 'system';

export interface ThemeVariant {
  '--bg': string;
  '--bg2': string;
  '--bg3': string;
  '--border': string;
  '--border2': string;
  '--text': string;
  '--text2': string;
  '--text3': string;
  '--accent': string;
  '--accent2': string;
  '--accent-bg': string;
  '--accent-border': string;
  '--accent-text': string;
  '--card-bg': string;
  '--card-border': string;
  '--modal-surface': string;
  '--pink': string;
  '--pink-bg': string;
  '--pink-border': string;
  '--pink-text': string;
  '--amber': string;
  '--input-bg': string;
  '--input-border': string;
  '--nav-bg': string;
  '--btn-primary-bg': string;
  '--btn-primary-text': string;
  '--btn-primary-shadow': string;
  '--streak-color': string;
  '--success': string;
  '--success-bg': string;
  '--success-text': string;
  '--streak-hero-bg': string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  emoji: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

const makeVariant = (v: ThemeVariant) => v;

export const THEMES: Record<ThemeId, Theme> = {
  bloom: {
    id: 'bloom', label: 'Bloom', emoji: '🌿',
    light: makeVariant({
      '--bg': '#f0fdf4', '--bg2': 'rgba(0,0,0,.03)', '--bg3': 'rgba(0,0,0,.06)',
      '--border': 'rgba(16,185,129,.15)', '--border2': 'rgba(16,185,129,.3)',
      '--text': '#052e16', '--text2': 'rgba(5,46,22,.6)', '--text3': 'rgba(5,46,22,.35)',
      '--accent': '#059669', '--accent2': '#047857',
      '--accent-bg': 'rgba(5,150,105,.1)', '--accent-border': 'rgba(5,150,105,.25)', '--accent-text': '#065f46',
      '--card-bg': '#ffffff', '--card-border': 'rgba(16,185,129,.15)',
      '--modal-surface': '#ffffff',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#be185d',
      '--amber': '#d97706', '--input-bg': 'rgba(5,150,105,.05)', '--input-border': 'rgba(5,150,105,.2)',
      '--nav-bg': 'rgba(240,253,244,.9)', '--btn-primary-bg': '#059669', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(5,150,105,.3)',
      '--streak-color': '#d97706', '--success': '#059669', '--success-bg': 'rgba(5,150,105,.1)', '--success-text': '#065f46',
      '--streak-hero-bg': 'linear-gradient(135deg,#059669 0%,#047857 50%,#065f46 100%)',
    }),
    dark: makeVariant({
      '--bg': '#0a1f14', '--bg2': 'rgba(16,185,129,.06)', '--bg3': 'rgba(16,185,129,.1)',
      '--border': 'rgba(16,185,129,.15)', '--border2': 'rgba(16,185,129,.28)',
      '--text': '#d1fae5', '--text2': 'rgba(209,250,229,.6)', '--text3': 'rgba(209,250,229,.3)',
      '--accent': '#10b981', '--accent2': '#059669',
      '--accent-bg': 'rgba(16,185,129,.12)', '--accent-border': 'rgba(16,185,129,.3)', '--accent-text': '#6ee7b7',
      '--card-bg': 'rgba(16,185,129,.07)', '--card-border': 'rgba(16,185,129,.15)',
      '--modal-surface': '#152b1e',
      '--pink': '#f472b6', '--pink-bg': 'rgba(244,114,182,.08)', '--pink-border': 'rgba(244,114,182,.2)', '--pink-text': '#f9a8d4',
      '--amber': '#f59e0b', '--input-bg': 'rgba(16,185,129,.06)', '--input-border': 'rgba(16,185,129,.2)',
      '--nav-bg': 'rgba(10,31,20,.9)', '--btn-primary-bg': '#10b981', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(16,185,129,.4)',
      '--streak-color': '#f59e0b', '--success': '#10b981', '--success-bg': 'rgba(16,185,129,.12)', '--success-text': '#6ee7b7',
      '--streak-hero-bg': 'linear-gradient(135deg,#10b981 0%,#059669 50%,#064e3b 100%)',
    }),
  },
  midnight: {
    id: 'midnight', label: 'Midnight', emoji: '🌑',
    light: makeVariant({
      '--bg': '#f8f7ff', '--bg2': 'rgba(0,0,0,.03)', '--bg3': 'rgba(0,0,0,.06)',
      '--border': 'rgba(99,102,241,.15)', '--border2': 'rgba(99,102,241,.28)',
      '--text': '#1e1b4b', '--text2': 'rgba(30,27,75,.6)', '--text3': 'rgba(30,27,75,.35)',
      '--accent': '#6366f1', '--accent2': '#4f46e5',
      '--accent-bg': 'rgba(99,102,241,.1)', '--accent-border': 'rgba(99,102,241,.25)', '--accent-text': '#4338ca',
      '--card-bg': '#ffffff', '--card-border': 'rgba(99,102,241,.15)',
      '--modal-surface': '#ffffff',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#be185d',
      '--amber': '#d97706', '--input-bg': 'rgba(99,102,241,.05)', '--input-border': 'rgba(99,102,241,.2)',
      '--nav-bg': 'rgba(248,247,255,.9)', '--btn-primary-bg': '#6366f1', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(99,102,241,.3)',
      '--streak-color': '#d97706', '--success': '#059669', '--success-bg': 'rgba(5,150,105,.1)', '--success-text': '#065f46',
      '--streak-hero-bg': 'linear-gradient(135deg,#6366f1 0%,#4f46e5 50%,#3730a3 100%)',
    }),
    dark: makeVariant({
      '--bg': '#09090f', '--bg2': 'rgba(255,255,255,.04)', '--bg3': 'rgba(255,255,255,.08)',
      '--border': 'rgba(255,255,255,.08)', '--border2': 'rgba(255,255,255,.15)',
      '--text': '#ffffff', '--text2': 'rgba(255,255,255,.55)', '--text3': 'rgba(255,255,255,.25)',
      '--accent': '#6366f1', '--accent2': '#8b5cf6',
      '--accent-bg': 'rgba(99,102,241,.12)', '--accent-border': 'rgba(99,102,241,.25)', '--accent-text': '#a5b4fc',
      '--card-bg': 'rgba(255,255,255,.04)', '--card-border': 'rgba(255,255,255,.08)',
      '--modal-surface': '#16162e',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#f9a8d4',
      '--amber': '#f59e0b', '--input-bg': 'rgba(255,255,255,.05)', '--input-border': 'rgba(255,255,255,.12)',
      '--nav-bg': 'rgba(9,9,15,.9)', '--btn-primary-bg': '#6366f1', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(99,102,241,.4)',
      '--streak-color': '#f59e0b', '--success': '#10b981', '--success-bg': 'rgba(16,185,129,.12)', '--success-text': '#6ee7b7',
      '--streak-hero-bg': 'linear-gradient(135deg,#4c1d95 0%,#3730a3 50%,#1e1b4b 100%)',
    }),
  },
  sakura: {
    id: 'sakura', label: 'Sakura', emoji: '🌸',
    light: makeVariant({
      '--bg': '#fff1f2', '--bg2': 'rgba(0,0,0,.03)', '--bg3': 'rgba(0,0,0,.06)',
      '--border': 'rgba(244,63,94,.15)', '--border2': 'rgba(244,63,94,.28)',
      '--text': '#881337', '--text2': 'rgba(136,19,55,.6)', '--text3': 'rgba(136,19,55,.35)',
      '--accent': '#f43f5e', '--accent2': '#e11d48',
      '--accent-bg': 'rgba(244,63,94,.1)', '--accent-border': 'rgba(244,63,94,.25)', '--accent-text': '#9f1239',
      '--card-bg': '#ffffff', '--card-border': 'rgba(244,63,94,.15)',
      '--modal-surface': '#ffffff',
      '--pink': '#f43f5e', '--pink-bg': 'rgba(244,63,94,.08)', '--pink-border': 'rgba(244,63,94,.2)', '--pink-text': '#9f1239',
      '--amber': '#d97706', '--input-bg': 'rgba(244,63,94,.05)', '--input-border': 'rgba(244,63,94,.2)',
      '--nav-bg': 'rgba(255,241,242,.9)', '--btn-primary-bg': '#f43f5e', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(244,63,94,.3)',
      '--streak-color': '#d97706', '--success': '#059669', '--success-bg': 'rgba(5,150,105,.1)', '--success-text': '#065f46',
      '--streak-hero-bg': 'linear-gradient(135deg,#f43f5e 0%,#e11d48 50%,#9f1239 100%)',
    }),
    dark: makeVariant({
      '--bg': '#1a0812', '--bg2': 'rgba(255,255,255,.05)', '--bg3': 'rgba(255,255,255,.09)',
      '--border': 'rgba(244,63,94,.12)', '--border2': 'rgba(244,63,94,.25)',
      '--text': '#fff0f5', '--text2': 'rgba(255,240,245,.55)', '--text3': 'rgba(255,240,245,.25)',
      '--accent': '#f43f5e', '--accent2': '#e11d48',
      '--accent-bg': 'rgba(244,63,94,.12)', '--accent-border': 'rgba(244,63,94,.3)', '--accent-text': '#fda4af',
      '--card-bg': 'rgba(244,63,94,.06)', '--card-border': 'rgba(244,63,94,.12)',
      '--modal-surface': '#2d1122',
      '--pink': '#f43f5e', '--pink-bg': 'rgba(244,63,94,.1)', '--pink-border': 'rgba(244,63,94,.25)', '--pink-text': '#fda4af',
      '--amber': '#f59e0b', '--input-bg': 'rgba(244,63,94,.06)', '--input-border': 'rgba(244,63,94,.2)',
      '--nav-bg': 'rgba(26,8,18,.9)', '--btn-primary-bg': '#f43f5e', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(244,63,94,.4)',
      '--streak-color': '#f59e0b', '--success': '#10b981', '--success-bg': 'rgba(16,185,129,.12)', '--success-text': '#6ee7b7',
      '--streak-hero-bg': 'linear-gradient(135deg,#4a0520 0%,#9f1239 40%,#881337 100%)',
    }),
  },
  aurora: {
    id: 'aurora', label: 'Aurora', emoji: '✨',
    light: makeVariant({
      '--bg': '#f5f3ff', '--bg2': 'rgba(0,0,0,.03)', '--bg3': 'rgba(0,0,0,.06)',
      '--border': 'rgba(124,58,237,.15)', '--border2': 'rgba(124,58,237,.28)',
      '--text': '#2e1065', '--text2': 'rgba(46,16,101,.6)', '--text3': 'rgba(46,16,101,.35)',
      '--accent': '#7c3aed', '--accent2': '#6d28d9',
      '--accent-bg': 'rgba(124,58,237,.1)', '--accent-border': 'rgba(124,58,237,.25)', '--accent-text': '#4c1d95',
      '--card-bg': '#ffffff', '--card-border': 'rgba(124,58,237,.15)',
      '--modal-surface': '#ffffff',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#be185d',
      '--amber': '#d97706', '--input-bg': 'rgba(124,58,237,.05)', '--input-border': 'rgba(124,58,237,.2)',
      '--nav-bg': 'rgba(245,243,255,.9)', '--btn-primary-bg': '#7c3aed', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(124,58,237,.3)',
      '--streak-color': '#d97706', '--success': '#059669', '--success-bg': 'rgba(5,150,105,.1)', '--success-text': '#065f46',
      '--streak-hero-bg': 'linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#4c1d95 100%)',
    }),
    dark: makeVariant({
      '--bg': '#0d0221', '--bg2': 'rgba(139,92,246,.06)', '--bg3': 'rgba(139,92,246,.1)',
      '--border': 'rgba(139,92,246,.12)', '--border2': 'rgba(139,92,246,.25)',
      '--text': '#f5f3ff', '--text2': 'rgba(245,243,255,.55)', '--text3': 'rgba(245,243,255,.25)',
      '--accent': '#7c3aed', '--accent2': '#6d28d9',
      '--accent-bg': 'rgba(124,58,237,.12)', '--accent-border': 'rgba(124,58,237,.3)', '--accent-text': '#c4b5fd',
      '--card-bg': 'rgba(139,92,246,.06)', '--card-border': 'rgba(139,92,246,.12)',
      '--modal-surface': '#1a0a36',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#f9a8d4',
      '--amber': '#f59e0b', '--input-bg': 'rgba(139,92,246,.06)', '--input-border': 'rgba(139,92,246,.2)',
      '--nav-bg': 'rgba(13,2,33,.9)', '--btn-primary-bg': '#7c3aed', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(124,58,237,.4)',
      '--streak-color': '#f59e0b', '--success': '#10b981', '--success-bg': 'rgba(16,185,129,.12)', '--success-text': '#6ee7b7',
      '--streak-hero-bg': 'linear-gradient(135deg,#4c1d95 0%,#3730a3 50%,#1e1b4b 100%)',
    }),
  },
  golden: {
    id: 'golden', label: 'Golden Hour', emoji: '☀️',
    light: makeVariant({
      '--bg': '#fffbeb', '--bg2': 'rgba(0,0,0,.03)', '--bg3': 'rgba(0,0,0,.06)',
      '--border': 'rgba(217,119,6,.15)', '--border2': 'rgba(217,119,6,.28)',
      '--text': '#431407', '--text2': 'rgba(67,20,7,.6)', '--text3': 'rgba(67,20,7,.35)',
      '--accent': '#d97706', '--accent2': '#b45309',
      '--accent-bg': 'rgba(217,119,6,.1)', '--accent-border': 'rgba(217,119,6,.25)', '--accent-text': '#78350f',
      '--card-bg': '#ffffff', '--card-border': 'rgba(217,119,6,.15)',
      '--modal-surface': '#ffffff',
      '--pink': '#ec4899', '--pink-bg': 'rgba(236,72,153,.08)', '--pink-border': 'rgba(236,72,153,.2)', '--pink-text': '#be185d',
      '--amber': '#d97706', '--input-bg': 'rgba(217,119,6,.05)', '--input-border': 'rgba(217,119,6,.2)',
      '--nav-bg': 'rgba(255,251,235,.9)', '--btn-primary-bg': '#d97706', '--btn-primary-text': '#ffffff', '--btn-primary-shadow': 'rgba(217,119,6,.3)',
      '--streak-color': '#d97706', '--success': '#059669', '--success-bg': 'rgba(5,150,105,.1)', '--success-text': '#065f46',
      '--streak-hero-bg': 'linear-gradient(135deg,#d97706 0%,#b45309 50%,#92400e 100%)',
    }),
    dark: makeVariant({
      '--bg': '#1c1008', '--bg2': 'rgba(217,119,6,.06)', '--bg3': 'rgba(217,119,6,.1)',
      '--border': 'rgba(217,119,6,.15)', '--border2': 'rgba(217,119,6,.28)',
      '--text': '#fef3c7', '--text2': 'rgba(254,243,199,.55)', '--text3': 'rgba(254,243,199,.28)',
      '--accent': '#f59e0b', '--accent2': '#d97706',
      '--accent-bg': 'rgba(245,158,11,.12)', '--accent-border': 'rgba(245,158,11,.3)', '--accent-text': '#fcd34d',
      '--card-bg': 'rgba(217,119,6,.07)', '--card-border': 'rgba(217,119,6,.15)',
      '--modal-surface': '#2c1a0c',
      '--pink': '#f472b6', '--pink-bg': 'rgba(244,114,182,.08)', '--pink-border': 'rgba(244,114,182,.2)', '--pink-text': '#f9a8d4',
      '--amber': '#f59e0b', '--input-bg': 'rgba(217,119,6,.06)', '--input-border': 'rgba(217,119,6,.2)',
      '--nav-bg': 'rgba(28,16,8,.9)', '--btn-primary-bg': '#f59e0b', '--btn-primary-text': '#1c1008', '--btn-primary-shadow': 'rgba(245,158,11,.4)',
      '--streak-color': '#f59e0b', '--success': '#10b981', '--success-bg': 'rgba(16,185,129,.12)', '--success-text': '#6ee7b7',
      '--streak-hero-bg': 'linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#92400e 100%)',
    }),
  },
};

export function resolveThemeVariant(
  themeId: ThemeId,
  mode: ColorMode,
  systemDark: boolean
): ThemeVariant {
  const theme = THEMES[themeId];
  if (mode === 'light') return theme.light;
  if (mode === 'dark') return theme.dark;
  return systemDark ? theme.dark : theme.light;
}
