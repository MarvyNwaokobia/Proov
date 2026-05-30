'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { validateUsername, isUsernameTaken, registerUsername, generateSuggestions } from '@/lib/username';
import { requestServerFaucet } from '@/lib/fuel';
import { setIdentityUsername } from '@/lib/auth';
import {
  isUsernameAvailable,
  registerUsername as registerSupabaseUsername,
} from '@/lib/supabase';

export default function UsernameSetupPage() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const [hintColor, setHintColor] = useState('var(--text3)');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [address, setAddress] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || 'anon_' + Math.random().toString(36).slice(2, 8);
    setAddress(addr);
    const email = localStorage.getItem('proov_email') || '';
    const base = email.split('@')[0] || 'grinder';
    setSuggestions(generateSuggestions(base));
  }, []);

  const checkUsername = (raw: string) => {
    setValue(raw);
    const clean = raw.replace(/^@/, '');
    if (!clean) { setHint(''); return; }

    const { valid, message } = validateUsername(clean);
    if (!valid) { setHint(message); setHintColor('#f43f5e'); return; }

    setChecking(true);
    setHint('Checking...');
    setHintColor('var(--text3)');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(clean);
        if (available) {
          setHint('✓ Available');
          setHintColor('var(--accent)');
        } else {
          setHint('Already taken — try another');
          setHintColor('#f43f5e');
        }
      } catch {
        // Supabase unavailable — fall back to localStorage
        const takenLocally = isUsernameTaken(clean, address);
        setHint(takenLocally ? 'Already taken — try another' : '✓ Available');
        setHintColor(takenLocally ? '#f43f5e' : 'var(--accent)');
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  const canSubmit = hint === '✓ Available' && !checking;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const clean = value.replace(/^@/, '').toLowerCase();

    try {
      const result = await registerSupabaseUsername(address, clean);
      if (!result.success) {
        setHint(result.error || 'Already taken — try another');
        setHintColor('#f43f5e');
        setLoading(false);
        return;
      }
    } catch {
      console.warn('Supabase unavailable, saving username locally');
    }

    // Always save locally too (offline fallback)
    registerUsername(clean, address);
    localStorage.setItem('proov_username', clean);
    setIdentityUsername(address, clean);

    // Kick off faucet now — gives the user fuel before on-chain calls in onboarding
    if (address) requestServerFaucet(address).catch(() => {});

    localStorage.setItem('proov_is_new_user', 'true');
    router.push('/onboarding');
  };

  const handleSkip = () => {
    const temp = 'user_' + Math.random().toString(36).slice(2, 7);
    registerUsername(temp, address);
    if (address) requestServerFaucet(address).catch(() => {});
    localStorage.setItem('proov_is_new_user', 'true');
    router.push('/onboarding');
  };

  const borderColor = hint === '✓ Available'
    ? 'var(--accent)'
    : (hint && hint !== 'Checking...' && !hint.startsWith('✓'))
      ? '#f43f5e'
      : 'var(--border2)';

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22, padding: '2rem' }}>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✍️</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 6 }}>
                What do we call you?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                How others find you on Proov
              </p>
            </div>

            {/* Input with @ prefix */}
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 700, color: 'var(--accent)', zIndex: 1, lineHeight: 1 }}>@</span>
              <input
                type="text"
                placeholder="yourname"
                value={value}
                onChange={e => checkUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
                autoFocus
                style={{ paddingLeft: 30, fontSize: 18, fontWeight: 700, border: `2px solid ${borderColor}`, transition: 'border .15s' }}
              />
            </div>

            {hint ? (
              <p style={{ fontSize: 11, color: hintColor, marginBottom: '0.5rem', minHeight: 16, transition: 'color .15s' }}>{hint}</p>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '0.5rem' }}>
                3–20 characters · letters, numbers, underscores
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Your username is how people find you and how your progress is tracked.
            </p>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 7, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>Suggestions</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => checkUsername('@' + s)}
                      style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent-text)', transition: 'all .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                      @{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              style={{ width: '100%', padding: 13, borderRadius: 13, border: 'none', background: canSubmit ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: canSubmit ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: canSubmit ? '0 4px 14px var(--btn-primary-shadow)' : 'none', transition: 'all .15s', marginBottom: 10 }}
              onMouseEnter={e => canSubmit && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            >
              {loading ? 'Saving...' : 'Confirm username'}
            </button>

            <button onClick={handleSkip}
              style={{ width: '100%', padding: '10px', borderRadius: 13, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
