'use client';
import { useTheme } from '@/components/providers/ThemeProvider';
import { THEMES, type ThemeId, type ColorMode } from '@/lib/themes';

const MODES: { value: ColorMode; label: string; emoji: string }[] = [
  { value: 'light',  label: 'Light',  emoji: '☀️' },
  { value: 'dark',   label: 'Dark',   emoji: '🌙' },
  { value: 'system', label: 'Auto',   emoji: '⚙️' },
];

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 13px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-bg)' : 'transparent',
  color: active ? 'var(--accent-text)' : 'var(--text3)',
  transition: 'all .15s',
  transform: active ? 'translateY(-1px)' : 'none',
});

export function ThemeToggle() {
  const { themeId, mode, setThemeId, setMode } = useTheme();

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
        Theme
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {(Object.keys(THEMES) as ThemeId[]).map(id => (
          <button key={id} onClick={() => setThemeId(id)} style={chipStyle(themeId === id)}>
            {THEMES[id].emoji} {THEMES[id].label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
        Mode
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {MODES.map(m => (
          <button key={m.value} onClick={() => setMode(m.value)} style={chipStyle(mode === m.value)}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)' }}>Auto follows your device setting</p>
    </div>
  );
}
