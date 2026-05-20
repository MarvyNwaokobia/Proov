'use client';
import { useState, useEffect } from 'react';
import { IconArrowRight, IconX } from '@tabler/icons-react';

interface WalkthroughStep {
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom';
}

const STEPS: WalkthroughStep[] = [
  {
    targetId: 'wt-streak-card',
    title: 'Your streak',
    description: 'Every day you complete a habit, this grows. Miss a day and it resets. Protect it.',
    position: 'bottom',
  },
  {
    targetId: 'wt-habits-grid',
    title: 'Your habits',
    description: 'Tap the checkbox when you finish a habit for the day. Simple.',
    position: 'bottom',
  },
  {
    targetId: 'wt-add-habit',
    title: 'Add a habit',
    description: 'Start here. Create your first habit and give yourself something to show up for.',
    position: 'top',
  },
  {
    targetId: 'wt-nav-grind',
    title: 'Grind Timer',
    description: 'Working on something? Start a timer. It logs your session and counts toward your streak.',
    position: 'top',
  },
  {
    targetId: 'wt-nav-circle',
    title: 'Your circle',
    description: 'Add people who will hold you to it. They see your habits. You see theirs.',
    position: 'top',
  },
  {
    targetId: 'wt-leaderboard',
    title: 'Leaderboard',
    description: 'Your rank is earned by showing up daily. The longer your streak, the higher you climb.',
    position: 'top',
  },
];

interface WalkthroughProps {
  onComplete: () => void;
}

export function Walkthrough({ onComplete }: WalkthroughProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => {
      const el = document.getElementById(current.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
          setVisible(true);
        }, 350);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step, current.targetId]);

  const handleNext = () => {
    setVisible(false);
    setTimeout(() => {
      if (isLast) {
        handleComplete();
      } else {
        setStep(s => s + 1);
      }
    }, 150);
  };

  const handleComplete = () => {
    localStorage.setItem('proov_tutorial_done', '1');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('proov_tutorial_done', '1');
    onComplete();
  };

  if (!targetRect) return null;

  const PAD = 8;
  const spotX = targetRect.left - PAD;
  const spotY = targetRect.top - PAD;
  const spotW = targetRect.width + PAD * 2;
  const spotH = targetRect.height + PAD * 2;

  const winW = typeof window !== 'undefined' ? window.innerWidth : 400;
  const TOOLTIP_W = 280;
  const TOOLTIP_H = 150;
  const centerX = spotX + spotW / 2;

  const tooltipStyle: React.CSSProperties = current.position === 'bottom'
    ? {
        top: spotY + spotH + 16,
        left: Math.min(Math.max(centerX - TOOLTIP_W / 2, 16), winW - TOOLTIP_W - 16),
      }
    : {
        top: Math.max(spotY - TOOLTIP_H - 16, 16),
        left: Math.min(Math.max(centerX - TOOLTIP_W / 2, 16), winW - TOOLTIP_W - 16),
      };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>

      {/* Dark overlay with spotlight cutout */}
      <svg
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'all',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        onClick={handleSkip}
      >
        <defs>
          <mask id="wt-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={spotX} y={spotY} width={spotW} height={spotH} rx={12} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#wt-spotlight-mask)" />
      </svg>

      {/* Spotlight glow ring */}
      <div style={{
        position: 'absolute',
        left: spotX, top: spotY,
        width: spotW, height: spotH,
        borderRadius: 12,
        border: '2px solid var(--accent)',
        boxShadow: '0 0 0 4px var(--accent-bg), 0 0 24px var(--accent)',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }} />

      {/* Tooltip card */}
      <div
        style={{
          position: 'absolute',
          ...tooltipStyle,
          width: TOOLTIP_W,
          background: 'var(--card-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: 16,
          padding: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,.3)',
          pointerEvents: 'all',
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? 0 : 8}px)`,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          zIndex: 9001,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress dots + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                width: i === step ? 16 : 4,
                background: i <= step ? 'var(--accent)' : 'var(--border2)',
                transition: 'all 0.2s ease',
              }} />
            ))}
          </div>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}
          >
            <IconX size={14} stroke={2} />
          </button>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontFamily: 'inherit' }}>
          {current.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: '0.875rem', fontFamily: 'inherit' }}>
          {current.description}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', fontFamily: 'inherit', padding: 0 }}
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {isLast ? 'Done' : 'Next'}
            {!isLast && <IconArrowRight size={13} stroke={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}
