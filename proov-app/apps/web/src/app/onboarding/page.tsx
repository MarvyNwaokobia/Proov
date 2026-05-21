'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const THEMES = [
  { id: 'bloom',    label: 'Bloom',       emoji: '🌿', desc: 'Fresh and clean',    bg: '#f0fdf4', accent: '#059669' },
  { id: 'midnight', label: 'Midnight',    emoji: '🌑', desc: 'Dark and focused',   bg: '#09090f', accent: '#6366f1' },
  { id: 'sakura',   label: 'Sakura',      emoji: '🌸', desc: 'Soft and energetic', bg: '#fff1f2', accent: '#f43f5e' },
  { id: 'aurora',   label: 'Aurora',      emoji: '✨', desc: 'Bold and creative',  bg: '#0d0221', accent: '#7c3aed' },
  { id: 'golden',   label: 'Golden Hour', emoji: '☀️', desc: 'Warm and ambitious', bg: '#fffbeb', accent: '#d97706' },
];

const MODES = [
  { id: 'light',  label: 'Light', emoji: '☀️', desc: 'Always light' },
  { id: 'dark',   label: 'Dark',  emoji: '🌙', desc: 'Always dark' },
  { id: 'system', label: 'Auto',  emoji: '⚙️', desc: 'Follows your device' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState('bloom');
  const [selectedMode, setSelectedMode] = useState('light');
  const [step, setStep] = useState<'theme' | 'mode'>('theme');

  const applyPreview = (themeId: string, mode: string) => {
    localStorage.setItem('proov_theme', themeId);
    localStorage.setItem('proov_mode', mode);
    window.dispatchEvent(new StorageEvent('storage', { key: 'proov_theme', newValue: themeId }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'proov_mode', newValue: mode }));
  };

  const handleThemeSelect = (id: string) => {
    setSelectedTheme(id);
    applyPreview(id, selectedMode);
  };

  const handleModeSelect = (id: string) => {
    setSelectedMode(id);
    applyPreview(selectedTheme, id);
  };

  const finish = () => {
    localStorage.setItem('proov_theme', selectedTheme);
    localStorage.setItem('proov_mode', selectedMode);
    localStorage.setItem('proov_onboarding_done', '1');
    router.push('/dashboard');
  };

  const handleContinue = () => {
    if (step === 'theme') {
      setStep('mode');
    } else {
      finish();
    }
  };

  return (
    <>
      <div className="blobs"><div className="blob b1"/><div className="blob b2"/></div>
      <div className="top-bar"/>
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1.25rem', position: 'relative', zIndex: 1,
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>
              {step === 'theme' ? '🎨' : '✨'}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 6 }}>
              {step === 'theme' ? 'Pick your vibe' : 'Light or dark?'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
              {step === 'theme'
                ? 'Choose a look that feels like you. You can change it anytime.'
                : 'How do you like your apps?'}
            </p>
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '1.5rem' }}>
            {(['theme', 'mode'] as const).map((s, i) => (
              <div key={s} style={{
                height: 4, borderRadius: 2,
                width: s === step ? 20 : 6,
                background: s === step || (step === 'mode' && i === 0) ? 'var(--accent)' : 'var(--border2)',
                transition: 'all .2s ease',
              }} />
            ))}
          </div>

          {/* Theme options */}
          {step === 'theme' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
              {THEMES.map(theme => (
                <button key={theme.id} onClick={() => handleThemeSelect(theme.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                  fontFamily: 'inherit', width: '100%', textAlign: 'left',
                  border: `2px solid ${selectedTheme === theme.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedTheme === theme.id ? 'var(--accent-bg)' : 'var(--card-bg)',
                  transition: 'all 0.2s cubic-bezier(.34,1.56,.64,1)',
                  transform: selectedTheme === theme.id ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: selectedTheme === theme.id ? '0 4px 16px var(--btn-primary-shadow)' : 'none',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: theme.bg, border: '3px solid ' + theme.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {theme.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{theme.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{theme.desc}</div>
                  </div>
                  {selectedTheme === theme.id && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Mode options */}
          {step === 'mode' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
              {MODES.map(mode => (
                <button key={mode.id} onClick={() => handleModeSelect(mode.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                  fontFamily: 'inherit', width: '100%', textAlign: 'left',
                  border: `2px solid ${selectedMode === mode.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedMode === mode.id ? 'var(--accent-bg)' : 'var(--card-bg)',
                  transition: 'all 0.2s cubic-bezier(.34,1.56,.64,1)',
                  transform: selectedMode === mode.id ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: selectedMode === mode.id ? '0 4px 16px var(--btn-primary-shadow)' : 'none',
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{mode.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{mode.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{mode.desc}</div>
                  </div>
                  {selectedMode === mode.id && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Continue */}
          <button onClick={handleContinue} className="btn-primary"
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {step === 'theme' ? 'Next →' : 'Looks good →'}
          </button>

          {step === 'theme' && (
            <button onClick={finish}
              style={{ display: 'block', width: '100%', marginTop: 10, padding: 10, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip — use default
            </button>
          )}
        </div>
      </div>
    </>
  );
}
