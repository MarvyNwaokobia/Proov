'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  {
    emoji: '👋',
    title: 'Good to have you here',
    description: 'This is your dashboard. Everything you need to show up daily lives right here.',
  },
  {
    emoji: '🔥',
    title: 'Build your streak',
    description: 'Complete all your habits every day to grow your streak. Miss a day and it resets — your circle sees everything.',
  },
  {
    emoji: '✅',
    title: "Log today's habits",
    description: 'Tap checkbox habits to mark them done, or start the Grind Timer for timed ones. Hit all of them to keep your streak alive.',
  },
  {
    emoji: '🤝',
    title: 'Your circle',
    description: 'Invite people who will hold you accountable. You can cheer each other on and witness habit completions onchain.',
  },
  {
    emoji: '⚡',
    title: 'Claim your fuel',
    description: 'Grab free CELO daily to power your activity in the app. Come back every day to refuel.',
  },
  {
    emoji: '🏆',
    title: 'Earn your rank',
    description: 'Show up daily and climb the leaderboard. Your rank is earned, not bought.',
  },
];

interface WalkthroughProps {
  onComplete: () => void;
}

export function Walkthrough({ onComplete }: WalkthroughProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleComplete = useCallback(() => {
    localStorage.setItem('proov_walkthrough_done', '1');
    localStorage.setItem('proov_tutorial_done', '1');
    localStorage.removeItem('proov_is_new_user');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (isLast) handleComplete();
    else setStep(s => s + 1);
  }, [isLast, handleComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '1.25rem',
      }}
      onClick={handleComplete}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--modal-surface)',
          border: '1.5px solid var(--border2)',
          borderRadius: 22,
          padding: '1.75rem 1.5rem',
          maxWidth: 340,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                borderRadius: 2,
                flex: 1,
                maxWidth: 32,
                background: i <= step ? 'var(--accent)' : 'var(--border2)',
                transition: 'background 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.18 }}
          >
            <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>
              {current.emoji}
            </div>
            <h3 style={{
              fontSize: 19,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 10,
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}>
              {current.title}
            </h3>
            <p style={{
              fontSize: 14,
              color: 'var(--text2)',
              lineHeight: 1.7,
              marginBottom: '1.75rem',
            }}>
              {current.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Step counter */}
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '1rem' }}>
          {step + 1} of {STEPS.length}
        </p>

        {/* Buttons */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            border: 'none',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: 10,
            boxShadow: '0 4px 14px var(--btn-primary-shadow)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.target as HTMLButtonElement).style.opacity = '0.88')}
          onMouseLeave={e => ((e.target as HTMLButtonElement).style.opacity = '1')}
        >
          {isLast ? "Let's go 🚀" : 'Next →'}
        </button>
        <button
          onClick={handleComplete}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 12,
            color: 'var(--text3)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '4px 8px',
          }}
        >
          Skip tour
        </button>
      </motion.div>
    </div>
  );
}
