'use client';
import { useState } from 'react';
import { validateUsername, registerUsername, isUsernameTaken } from '@/lib/username';
import { motion } from 'framer-motion';

interface Props {
  address: string;
  onComplete: (username: string) => void;
}

export function UsernameSetup({ address, onComplete }: Props) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const [hintOk, setHintOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const check = (input: string) => {
    setValue(input);
    const clean = input.replace(/^@/, '').trim();
    if (!clean) { setHint(''); setHintOk(false); return; }
    const { valid, message } = validateUsername(clean);
    if (!valid) { setHint(message); setHintOk(false); return; }
    if (isUsernameTaken(clean, address)) {
      setHint('Already taken — try another');
      setHintOk(false);
      return;
    }
    setHint('✓ Available');
    setHintOk(true);
  };

  const submit = () => {
    const clean = value.replace(/^@/, '').trim();
    if (!hintOk) return;
    setLoading(true);
    const ok = registerUsername(clean, address);
    if (ok) {
      onComplete(clean);
    } else {
      setHint('Already taken — try another');
      setHintOk(false);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.25rem', zIndex: 9999,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: .96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          maxWidth: 400, width: '100%',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Pick your name
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>How your circle will know you</p>
        </div>

        <input
          type="text"
          placeholder="@yourname"
          value={value}
          onChange={e => check(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
          maxLength={21}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: 10, color: 'var(--text)', fontSize: 14,
            outline: 'none', marginBottom: 6,
            fontFamily: 'inherit',
          }}
        />
        {hint && (
          <p style={{ fontSize: 11, color: hintOk ? 'var(--accent)' : '#f43f5e', marginBottom: '.875rem' }}>
            {hint}
          </p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '1rem' }}>
          3–20 characters · letters, numbers, underscores
        </p>

        <button
          onClick={submit}
          disabled={loading || !hintOk}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: hintOk ? 'var(--accent)' : 'var(--bg3)',
            color: hintOk ? '#fff' : 'var(--text3)',
            fontSize: 14, fontWeight: 600,
            cursor: hintOk ? 'pointer' : 'default',
            transition: 'all .15s', marginBottom: 8, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Saving...' : 'Continue →'}
        </button>
        <button
          onClick={() => onComplete('anon_' + address.slice(2, 8))}
          style={{
            width: '100%', padding: 10, borderRadius: 12,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
