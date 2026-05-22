'use client';
import { useState, useEffect, useCallback } from 'react';
import { IconX, IconArrowRight } from '@tabler/icons-react';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  position: 'top' | 'bottom';
}

const STEPS: WalkthroughStep[] = [
  {
    id: 'wt-greeting',
    title: 'Good to have you here 👋',
    description: 'This is your dashboard. Everything you need to show up daily lives right here.',
    position: 'bottom',
  },
  {
    id: 'wt-streak-card',
    title: 'Your streak 🔥',
    description: 'Complete all your habits every day to build your streak. Tap the card to see your detailed history.',
    position: 'bottom',
  },
  {
    id: 'wt-habits-grid',
    title: "Today's habits",
    description: 'Tick checkbox habits or start a timer for timed ones. Complete them all to grow your streak.',
    position: 'top',
  },
  {
    id: 'wt-circle',
    title: 'Your circle 👥',
    description: 'Invite people who will hold you accountable. You can cheer each other on every day.',
    position: 'top',
  },
  {
    id: 'wt-fuel',
    title: 'Claim your fuel ⚡',
    description: 'Claim free CELO daily to power your activity in the app. Come back every day to refuel.',
    position: 'bottom',
  },
  {
    id: 'wt-add-habit',
    title: 'Build your stack',
    description: 'Add habits that matter to you. Mix timed sessions with checkbox habits for a complete routine.',
    position: 'top',
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

interface WalkthroughProps {
  onComplete: () => void;
}

export function Walkthrough({ onComplete }: WalkthroughProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (windowSize.w === 0) return;
    setRect(null);

    const el = document.querySelector(`[data-wt="${current.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, 400);
      return () => clearTimeout(t);
    } else {
      setRect({ top: windowSize.h * 0.3, left: windowSize.w * 0.1, width: windowSize.w * 0.8, height: 80 });
    }
  }, [step, current.id, windowSize.w, windowSize.h]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('proov_walkthrough_done', '1');
    localStorage.setItem('proov_tutorial_done', '1');
    localStorage.removeItem('proov_is_new_user');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleComplete();
    } else {
      setRect(null);
      setTimeout(() => setStep(s => s + 1), 100);
    }
  }, [isLast, handleComplete]);

  if (windowSize.w === 0) return null;

  const PAD = 10;
  const TOOLTIP_W = Math.min(280, windowSize.w - 32);

  const spotX = rect ? rect.left - PAD : 0;
  const spotY = rect ? rect.top - PAD : 0;
  const spotW = rect ? rect.width + PAD * 2 : 0;
  const spotH = rect ? rect.height + PAD * 2 : 0;
  const centerX = rect ? rect.left + rect.width / 2 : windowSize.w / 2;

  const tooltipLeft = Math.min(Math.max(centerX - TOOLTIP_W / 2, 16), windowSize.w - TOOLTIP_W - 16);
  let tooltipTop = 0;
  if (current.position === 'bottom' && rect) {
    tooltipTop = spotY + spotH + 16;
  } else if (rect) {
    tooltipTop = Math.max(spotY - 180, 80);
  } else {
    tooltipTop = windowSize.h / 2 - 60;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }}>

      {/* Dark overlay with spotlight cutout */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'default' }}
        onClick={handleComplete}
      >
        <defs>
          <mask id={`wt-mask-${step}`}>
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={spotX} y={spotY} width={spotW} height={spotH} rx={12} fill="black" />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask={`url(#wt-mask-${step})`}
        />
      </svg>

      {/* Spotlight glow ring */}
      {rect && (
        <div style={{
          position: 'absolute',
          left: spotX, top: spotY,
          width: spotW, height: spotH,
          borderRadius: 12,
          border: '2px solid var(--accent)',
          boxShadow: '0 0 0 4px var(--accent-bg), 0 0 20px var(--accent)',
          pointerEvents: 'none',
          transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
        }} />
      )}

      {/* Tooltip */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_W,
          background: 'var(--card-bg)',
          border: '1.5px solid var(--accent-border)',
          borderRadius: 18,
          padding: '1.1rem',
          boxShadow: '0 12px 40px rgba(0,0,0,.25)',
          zIndex: 9001,
          opacity: rect ? 1 : 0,
          transition: 'opacity 0.25s ease, top 0.35s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {/* Progress dots + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                width: i === step ? 18 : 4,
                background: i <= step ? 'var(--accent)' : 'var(--border2)',
                transition: 'all 0.25s ease',
              }} />
            ))}
          </div>
          <button
            onClick={handleComplete}
            style={{
              background: 'var(--bg2)', border: 'none', borderRadius: '50%',
              width: 24, height: 24, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)',
            }}
          >
            <IconX size={13} stroke={2.5} />
          </button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5, fontFamily: 'inherit' }}>
          {current.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, marginBottom: '1rem', fontFamily: 'inherit' }}>
          {current.description}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{step + 1} of {STEPS.length}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleComplete}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text3)', fontFamily: 'inherit',
                padding: '6px 10px', borderRadius: 8,
              }}
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 3px 10px var(--btn-primary-shadow)',
              }}
            >
              {isLast ? "Let's go 🚀" : 'Next'}
              {!isLast && <IconArrowRight size={14} stroke={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
