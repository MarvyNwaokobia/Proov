'use client';
import { useState, useEffect } from 'react';
import { generateStreakCard, shareToTwitter, downloadCard } from '@/lib/shareCard';
import { motion } from 'framer-motion';

interface Props {
  streak: number;
  username: string;
  categories: string[];
  onClose: () => void;
}

export function StreakMilestoneModal({ streak, username, categories, onClose }: Props) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    generateStreakCard({ username, streak, categories })
      .then(url => { setCardUrl(url); setGenerating(false); })
      .catch(() => setGenerating(false));
  }, [username, streak, categories]);

  const btn = (label: string, onClick: () => void, primary = false) => (
    <button
      onClick={onClick}
      style={{
        padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
        border: primary ? 'none' : '1px solid var(--border2)',
        background: primary ? 'var(--accent)' : 'transparent',
        color: primary ? '#fff' : 'var(--text)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9997, padding: '1.25rem',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: .95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          maxWidth: 360, width: '100%',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '1.75rem', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {streak} days strong
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>
          Share your streak and inspire someone
        </p>

        {generating ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Generating card...
          </div>
        ) : cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardUrl} style={{ width: '100%', borderRadius: 12, marginBottom: '1.25rem' }} alt="streak card" />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {btn('𝕏 Share to X / Twitter', () => shareToTwitter(streak, username))}
          {cardUrl && btn('↓ Save image', () => downloadCard(cardUrl, `proov-streak-${streak}.png`))}
          {btn('Keep grinding →', onClose, true)}
        </div>
      </motion.div>
    </div>
  );
}
