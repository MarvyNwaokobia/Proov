'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { emoji: '🔥', title: 'Your streak',    body: 'Every habit you complete adds to your streak. Miss a day and it resets. Your circle sees everything.' },
  { emoji: '✅', title: 'Log your habits', body: 'Tick habits done each day — or run the Grind Timer and it counts automatically when time is up.' },
  { emoji: '🤝', title: 'Add your circle', body: 'Invite people you trust. When your streak breaks, they know. That is the point.' },
  { emoji: '🏆', title: 'Earn your rank',  body: 'Show up daily and climb the leaderboard. Your rank is earned, not bought.' },
];

interface Props { onDone: () => void; }

export function AppTutorial({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.80)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.25rem',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: .95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '1.75rem',
          maxWidth: 340,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 10000,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: .2 }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>{current.emoji}</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-.3px' }}>
              {current.title}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '1.5rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? 'var(--accent)' : 'var(--border2)',
              transition: 'all .2s',
            }} />
          ))}
        </div>

        <button
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            marginBottom: 8, fontFamily: 'inherit',
          }}
        >
          {isLast ? 'Start grinding →' : 'Next'}
        </button>
        <button
          onClick={onDone}
          style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Skip tutorial
        </button>
      </motion.div>
    </div>
  );
}
