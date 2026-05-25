'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { saveHabit, setOnboardingComplete } from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';

const EMOJI_OPTIONS = ['💪', '🧘', '📚', '🏃', '💧', '🍎', '🎯', '🌅', '✍️', '🎵'];

type Step = 'welcome' | 'habit' | 'approval';

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const proovTx = useProovTx();

  const [step, setStep] = useState<Step>('welcome');
  const [habitName, setHabitName] = useState('');
  const [habitEmoji, setHabitEmoji] = useState('💪');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const s = searchParams.get('step');
    if (s === 'habit') setStep('habit');
    else if (s === 'approval') setStep('approval');
  }, [searchParams]);

  const addr = address || (typeof window !== 'undefined' ? localStorage.getItem('proov_address') || '' : '');

  const handleWelcomeContinue = () => {
    const username = typeof window !== 'undefined' ? localStorage.getItem('proov_username') : null;
    if (username) setStep('habit');
    else router.push('/username-setup');
  };

  const handleHabitNext = async () => {
    const name = habitName.trim();
    if (name && addr) {
      setSaving(true);
      try {
        const habit = await saveHabit({
          user_address: addr.toLowerCase(),
          name,
          emoji: habitEmoji,
          category: 'general',
          type: 'checkbox',
          duration_minutes: 0,
          schedule: 'daily',
          visibility: 'circle',
          visible_to: [],
          active: true,
        });
        if (habit) proovTx.createHabit(name, 'general', false, 0);
      } catch {}
      setSaving(false);
    }
    setStep('approval');
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('proov_username') || '' : '';
      if (username) proovTx.setUsername(username);
      if (addr) await setOnboardingComplete(addr);
      if (typeof window !== 'undefined') {
        localStorage.setItem('proov_onboarding_done', '1');
      }
    } catch {}
    router.push('/dashboard');
  };

  const steps: Step[] = ['welcome', 'habit', 'approval'];
  const stepIndex = steps.indexOf(step);

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

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '2.5rem' }}>
            {steps.map((s, i) => (
              <div key={s} style={{
                height: 4, borderRadius: 2,
                width: s === step ? 20 : 6,
                background: i <= stepIndex ? 'var(--accent)' : 'var(--border2)',
                transition: 'all .2s ease',
              }} />
            ))}
          </div>

          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ fontSize: 60, marginBottom: 18 }}>👋</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 12 }}>
                  Welcome to Proov
                </h1>
                <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 300, margin: '0 auto' }}>
                  Build habits. Stay accountable. Record your progress on-chain — so it lasts forever.
                </p>
              </div>
              <button onClick={handleWelcomeContinue} className="btn-primary"
                style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Get started →
              </button>
            </>
          )}

          {/* Step 2: Add first habit */}
          {step === 'habit' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🎯</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 8 }}>
                  Add your first habit
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                  What&apos;s one habit you want to build? You can add more later.
                </p>
              </div>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setHabitEmoji(e)} style={{
                      width: 40, height: 40, borderRadius: 10, fontSize: 20,
                      border: `2px solid ${habitEmoji === e ? 'var(--accent)' : 'var(--border)'}`,
                      background: habitEmoji === e ? 'var(--accent-bg)' : 'var(--bg2)',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>{e}</button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Drink 2L of water daily"
                  value={habitName}
                  onChange={e => setHabitName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleHabitNext()}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: '1.5px solid var(--border2)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <button onClick={handleHabitNext} disabled={saving} className="btn-primary"
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: habitName.trim() ? 10 : 0 }}>
                {saving ? 'Saving...' : habitName.trim() ? 'Add habit →' : 'Skip for now →'}
              </button>

              {habitName.trim() && (
                <button onClick={() => setStep('approval')}
                  style={{ display: 'block', width: '100%', padding: 10, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Skip for now →
                </button>
              )}
            </>
          )}

          {/* Step 3: Blockchain approval */}
          {step === 'approval' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>
                  One last thing
                </h2>
                <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Proov records your habits automatically on the blockchain. Tap below to allow this.
                </p>
              </div>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⛓️</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Why blockchain?</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                      Your streaks and completions are stored on Celo — public, permanent, and tamper-proof. No one can fake your progress.
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleApprove} disabled={approving} className="btn-primary"
                style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {approving ? 'Setting up...' : 'Allow Proov to record my habits'}
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
