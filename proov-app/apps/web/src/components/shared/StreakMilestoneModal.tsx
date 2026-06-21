'use client';
import { useState, useEffect } from 'react';
import { generateStreakCard, shareToTwitter, downloadCard } from '@/lib/shareCard';
import { ConfettiBurst } from './ConfettiBurst';

interface Props {
  streak: number;
  username: string;
  categories: string[];
  onClose: () => void;
}

const MESSAGES: Record<number, { title: string; body: string }> = {
  7:   { title: 'One week down',      body: 'Seven days of showing up. The habit is taking root.' },
  14:  { title: 'Two weeks strong',    body: 'Most people quit by now. You didn\'t.' },
  21:  { title: 'Three weeks',         body: 'They say it takes 21 days to build a habit. You just did.' },
  30:  { title: 'One month',           body: 'Thirty days. That\'s not luck — that\'s discipline.' },
  60:  { title: 'Two months',          body: 'Sixty days of consistency. You\'re built different.' },
  90:  { title: 'Ninety days',         body: 'A full quarter of showing up every single day. Legendary.' },
  120: { title: 'Four months',         body: 'Most apps get deleted in a week. You\'re still here, still grinding.' },
};

function getMsg(streak: number) {
  if (MESSAGES[streak]) return MESSAGES[streak];
  if (streak >= 90) return { title: `${streak} days`, body: 'You\'re in rare territory. Keep going.' };
  if (streak >= 30) return { title: `${streak} days`, body: 'Consistency is your superpower.' };
  return { title: `${streak} days`, body: 'Every day counts. You\'re proving it.' };
}

export function StreakMilestoneModal({ streak, username, categories, onClose }: Props) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);
  const [entered, setEntered] = useState(false);

  const isMajor = streak >= 30;
  const msg = getMsg(streak);

  useEffect(() => {
    generateStreakCard({ username, streak, categories })
      .then(url => { setCardUrl(url); setGenerating(false); })
      .catch(() => setGenerating(false));
    requestAnimationFrame(() => setEntered(true));
  }, [username, streak, categories]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      background: isMajor ? 'rgba(0,0,0,.85)' : 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.25rem',
    }}>
      <ConfettiBurst active={showConfetti} onDone={() => setShowConfetti(false)} />

      <div style={{
        maxWidth: isMajor ? 400 : 360, width: '100%',
        background: isMajor
          ? 'linear-gradient(145deg, var(--bg2), var(--card-bg))'
          : 'var(--bg2)',
        border: isMajor ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 24, padding: isMajor ? '2rem 1.75rem' : '1.75rem',
        textAlign: 'center',
        boxShadow: isMajor ? '0 0 60px rgba(var(--accent-rgb, 99,102,241), 0.2)' : undefined,
        transform: entered ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
        opacity: entered ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease',
      }}>
        {/* Big streak number */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
          {isMajor && (
            <div style={{
              position: 'absolute', inset: -20, borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-bg), transparent 70%)',
              animation: 'milestone-glow 2s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <style>{`@keyframes milestone-glow{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}`}</style>
          <div style={{
            fontSize: isMajor ? 64 : 48, fontWeight: 900, lineHeight: 1,
            color: 'var(--accent-text)', position: 'relative',
            letterSpacing: -3,
          }}>
            {streak}
          </div>
        </div>

        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontWeight: 600 }}>
          day streak 🔥
        </div>

        <h3 style={{
          fontSize: isMajor ? 22 : 18, fontWeight: 800, color: 'var(--text)',
          marginBottom: 6, letterSpacing: -0.5,
        }}>
          {msg.title}
        </h3>
        <p style={{
          fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
          marginBottom: 20, maxWidth: 280, margin: '0 auto 20px',
          fontStyle: 'italic',
        }}>
          {msg.body}
        </p>

        {/* Share card preview */}
        {generating ? (
          <div style={{
            height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', fontSize: 12, marginBottom: 16,
          }}>
            Generating card...
          </div>
        ) : cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardUrl} style={{ width: '100%', borderRadius: 14, marginBottom: 16 }} alt="streak card" />
        ) : null}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => shareToTwitter(streak, username)}
            style={{
              width: '100%', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid var(--border2)', background: 'transparent',
              color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            𝕏 Share to X
          </button>
          {cardUrl && (
            <button
              onClick={() => downloadCard(cardUrl, `proov-streak-${streak}.png`)}
              style={{
                width: '100%', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid var(--border2)', background: 'transparent',
                color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              ↓ Save image
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              boxShadow: '0 4px 16px var(--btn-primary-shadow)',
            }}
          >
            Keep grinding →
          </button>
        </div>
      </div>
    </div>
  );
}
