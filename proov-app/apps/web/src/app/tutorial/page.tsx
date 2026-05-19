'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { emoji: '🔥', title: 'Your streak', body: 'Complete habits every day to grow your streak. Miss a day and it resets. Your circle sees everything.' },
  { emoji: '✅', title: 'Log your habits', body: 'Tick habits done each day — or run the Grind Timer and it counts automatically when time is up.' },
  { emoji: '🤝', title: 'Build your circle', body: 'Invite people you trust. When your streak breaks, they know. That is the point.' },
  { emoji: '🏆', title: 'Earn your rank', body: 'Show up daily and climb the leaderboard. Your rank is earned, not bought.' },
];

export default function TutorialPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => {
    localStorage.setItem('proov_tutorial_done', '1');
    router.push('/dashboard');
  };

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{current.emoji}</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10, letterSpacing: '-.3px' }}>{current.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: '1.75rem' }}>{current.body}</p>

            {/* Step dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '1.75rem' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ height: 6, borderRadius: 3, background: i === step ? 'var(--accent)' : 'var(--border2)', width: i === step ? 20 : 6, transition: 'all .2s' }} />
              ))}
            </div>

            <button
              onClick={() => isLast ? finish() : setStep(s => s + 1)}
              style={{ width: '100%', padding: 13, borderRadius: 13, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px var(--btn-primary-shadow)', marginBottom: 10 }}
            >
              {isLast ? 'Start grinding →' : 'Next'}
            </button>
            <button onClick={finish} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip tutorial
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
