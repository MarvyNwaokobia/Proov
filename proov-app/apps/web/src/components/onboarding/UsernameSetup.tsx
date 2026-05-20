'use client';
import { useState, useEffect, useRef } from 'react';
import { isUsernameAvailable, registerUsername as registerSupabaseUsername } from '@/lib/supabase';
import { validateUsername } from '@/lib/username';

interface Props {
  address: string;
  onComplete: (username: string) => void;
}

function suggestUsernames(address: string): string[] {
  // Generate suggestions from address
  const base = address.slice(2, 8).toLowerCase();
  return [`@${base}`, `@${base}_grind`, `@${base}proov`];
}

export function UsernameSetup({ address, onComplete }: Props) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestions = suggestUsernames(address);

  useEffect(() => {
    const clean = value.replace(/^@/, '').trim();
    if (!clean) { setStatus('idle'); setHint(''); return; }

    const { valid, message } = validateUsername(clean);
    if (!valid) { setStatus('invalid'); setHint(message); return; }

    setStatus('checking'); setHint('Checking...');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const avail = await isUsernameAvailable(clean);
      if (avail) { setStatus('available'); setHint('✓ Available'); }
      else { setStatus('taken'); setHint('✗ Already taken — try another'); }
    }, 500);
  }, [value]);

  const handleSubmit = async () => {
    const clean = value.replace(/^@/, '').trim();
    if (status !== 'available') return;
    setLoading(true);
    try {
      await registerSupabaseUsername(address, clean);
      onComplete(clean);
    } catch {
      setStatus('taken');
      setHint('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const hintColor = status === 'available' ? 'var(--success-text)' : status === 'taken' || status === 'invalid' ? '#f43f5e' : 'var(--text3)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', zIndex: 9999 }}>
      <span style={{ fontSize: 40, display: 'block', textAlign: 'center', marginBottom: 12 }}>✍️</span>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 4, letterSpacing: '-.3px' }}>
        What do we call you?
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Your name on the leaderboard, in your circle, everywhere.
      </p>

      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Input with @ prefix */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>@</span>
          <input
            autoFocus
            value={value.replace(/^@/, '')}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="yourname"
            maxLength={20}
            style={{ paddingLeft: 28, fontSize: 15, fontWeight: 600, border: `2px solid ${status === 'available' ? 'var(--success)' : status === 'taken' || status === 'invalid' ? '#f43f5e' : 'var(--accent)'}`, background: 'var(--card-bg)', color: 'var(--text)' }}
          />
        </div>

        {hint && <p style={{ fontSize: 11, color: hintColor, marginBottom: 10 }}>{hint}</p>}
        <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: '1rem' }}>3–20 characters · letters, numbers, underscores</p>

        {/* Suggestions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => setValue(s.replace('@', ''))} style={{
              padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent-text)',
            }}>{s}</button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || status !== 'available'}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: status === 'available' ? 'var(--btn-primary-bg)' : 'var(--bg3)',
            color: status === 'available' ? 'var(--btn-primary-text)' : 'var(--text3)',
            fontSize: 14, fontWeight: 600, cursor: status === 'available' ? 'pointer' : 'default',
            fontFamily: 'inherit', marginBottom: 10, opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Saving...' : "Let's go →"}
        </button>

        <button
          onClick={() => onComplete(`anon_${address.slice(2, 8)}`)}
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
