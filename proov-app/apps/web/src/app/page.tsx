'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { RippleButton } from '@/components/shared/RippleButton';

const THEME_VARS: Record<string, Record<string, string>> = {
  bloom:    {'--bg':'#f0fdf4','--bg2':'rgba(0,0,0,.03)','--bg3':'rgba(0,0,0,.06)','--border':'rgba(16,185,129,.12)','--border2':'rgba(16,185,129,.25)','--text':'#052e16','--text2':'rgba(5,46,22,.55)','--text3':'rgba(5,46,22,.3)','--accent':'#059669','--accent2':'#047857','--accent-bg':'rgba(5,150,105,.1)','--accent-border':'rgba(5,150,105,.25)','--accent-text':'#065f46','--pink':'#ec4899','--pink-bg':'rgba(236,72,153,.08)','--pink-border':'rgba(236,72,153,.2)','--pink-text':'#be185d','--amber':'#d97706','--input-bg':'rgba(5,150,105,.05)','--input-border':'rgba(5,150,105,.2)'},
  midnight: {'--bg':'#09090f','--bg2':'rgba(255,255,255,.04)','--bg3':'rgba(255,255,255,.08)','--border':'rgba(255,255,255,.08)','--border2':'rgba(255,255,255,.15)','--text':'#ffffff','--text2':'rgba(255,255,255,.55)','--text3':'rgba(255,255,255,.25)','--accent':'#6366f1','--accent2':'#8b5cf6','--accent-bg':'rgba(99,102,241,.12)','--accent-border':'rgba(99,102,241,.25)','--accent-text':'#a5b4fc','--pink':'#ec4899','--pink-bg':'rgba(236,72,153,.08)','--pink-border':'rgba(236,72,153,.2)','--pink-text':'#f9a8d4','--amber':'#f59e0b','--input-bg':'rgba(255,255,255,.05)','--input-border':'rgba(255,255,255,.12)'},
  sakura:   {'--bg':'#1a0812','--bg2':'rgba(255,255,255,.05)','--bg3':'rgba(255,255,255,.09)','--border':'rgba(244,63,94,.12)','--border2':'rgba(244,63,94,.25)','--text':'#fff0f5','--text2':'rgba(255,240,245,.55)','--text3':'rgba(255,240,245,.25)','--accent':'#f43f5e','--accent2':'#e11d48','--accent-bg':'rgba(244,63,94,.12)','--accent-border':'rgba(244,63,94,.3)','--accent-text':'#fda4af','--pink':'#f43f5e','--pink-bg':'rgba(244,63,94,.1)','--pink-border':'rgba(244,63,94,.25)','--pink-text':'#fda4af','--amber':'#f59e0b','--input-bg':'rgba(244,63,94,.06)','--input-border':'rgba(244,63,94,.2)'},
  aurora:   {'--bg':'#0d0221','--bg2':'rgba(139,92,246,.06)','--bg3':'rgba(139,92,246,.1)','--border':'rgba(139,92,246,.12)','--border2':'rgba(139,92,246,.25)','--text':'#f5f3ff','--text2':'rgba(245,243,255,.55)','--text3':'rgba(245,243,255,.25)','--accent':'#7c3aed','--accent2':'#6d28d9','--accent-bg':'rgba(124,58,237,.12)','--accent-border':'rgba(124,58,237,.3)','--accent-text':'#c4b5fd','--pink':'#ec4899','--pink-bg':'rgba(236,72,153,.08)','--pink-border':'rgba(236,72,153,.2)','--pink-text':'#f9a8d4','--amber':'#f59e0b','--input-bg':'rgba(139,92,246,.06)','--input-border':'rgba(139,92,246,.2)'},
  golden:   {'--bg':'#fffbeb','--bg2':'rgba(0,0,0,.03)','--bg3':'rgba(0,0,0,.06)','--border':'rgba(217,119,6,.12)','--border2':'rgba(217,119,6,.25)','--text':'#431407','--text2':'rgba(67,20,7,.55)','--text3':'rgba(67,20,7,.3)','--accent':'#d97706','--accent2':'#b45309','--accent-bg':'rgba(217,119,6,.1)','--accent-border':'rgba(217,119,6,.25)','--accent-text':'#92400e','--pink':'#ec4899','--pink-bg':'rgba(236,72,153,.08)','--pink-border':'rgba(236,72,153,.2)','--pink-text':'#be185d','--amber':'#d97706','--input-bg':'rgba(217,119,6,.05)','--input-border':'rgba(217,119,6,.2)'},
  auto:     {'--bg':'#09090f','--bg2':'rgba(255,255,255,.04)','--bg3':'rgba(255,255,255,.08)','--border':'rgba(255,255,255,.08)','--border2':'rgba(255,255,255,.15)','--text':'#ffffff','--text2':'rgba(255,255,255,.55)','--text3':'rgba(255,255,255,.25)','--accent':'#6366f1','--accent2':'#8b5cf6','--accent-bg':'rgba(99,102,241,.12)','--accent-border':'rgba(99,102,241,.25)','--accent-text':'#a5b4fc','--pink':'#ec4899','--pink-bg':'rgba(236,72,153,.08)','--pink-border':'rgba(236,72,153,.2)','--pink-text':'#f9a8d4','--amber':'#f59e0b','--input-bg':'rgba(255,255,255,.05)','--input-border':'rgba(255,255,255,.12)'},
};

function applyTheme(t: string) {
  const vars = THEME_VARS[t] || THEME_VARS.bloom;
  const r = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => r.style.setProperty(k, v));
  r.setAttribute('data-theme', t);
  localStorage.setItem('proov_theme', t);
  document.body.style.background = vars['--bg'];
}

const FEATURES = [
  { emoji: '🧠', title: 'AI verifies you',   desc: 'Describe it. Vague gets rejected.' },
  { emoji: '🤝', title: 'Your circle sees',  desc: 'Every streak. Every break.' },
  { emoji: '🏆', title: 'Global rank',        desc: 'Show up or fall behind.' },
  { emoji: '🔥', title: 'Streaks that last',  desc: "Can't be faked. Can't be bought." },
];

const AVATAR_COLORS = ['var(--accent)', 'var(--pink)', 'var(--success,#10b981)', 'var(--amber)'] as const;
const AVATAR_LETTERS = ['A', 'T', 'S', 'J'];

export default function LandingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) router.replace('/dashboard');
  }, [isConnected, router]);

  useEffect(() => {
    const saved = localStorage.getItem('proov_theme') || 'bloom';
    applyTheme(saved);
  }, []);

  return (
    <>
      {/* Background blobs */}
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>

      {/* Gradient top bar */}
      <div className="top-bar" />

      <div className="wrap" style={{ paddingTop: 3 }}>

        {/* Nav */}
        <nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="logo-float"
              style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff' }}
            >P</div>
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>Proov</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ padding: '7px 15px', fontSize: 13 }} onClick={() => router.push('/signin')}>Sign in</button>
            <RippleButton style={{ padding: '7px 15px', fontSize: 13 }} onClick={() => router.push('/signup')}>Join free</RippleButton>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ padding: '2.5rem 0 1.5rem', textAlign: 'center' }}>
          <div
            className="hero-animate-1"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '4px 13px', fontSize: 11, color: 'var(--accent-text)', marginBottom: '1.25rem', letterSpacing: '.3px' }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Proof of habit · Free to join
          </div>

          <h1 className="hero-h hero-animate-2" style={{ textAlign: 'center' }}>
            Do the work.<br />
            <em>Own the proof.</em>
          </h1>

          <p
            className="hero-animate-3"
            style={{ fontSize: 15, color: 'var(--text2)', margin: '0 auto 1.75rem', lineHeight: 1.7, maxWidth: 380 }}
          >
            No excuses. No screenshots.<br />Just streaks that can&apos;t be faked.
          </p>

          <div className="hero-animate-4" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
            <RippleButton onClick={() => router.push('/signup')}>Start today →</RippleButton>
            <button
              className="btn-ghost"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See how it works
            </button>
          </div>

          <div
            className="hero-animate-5"
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}
          >
            <div style={{ display: 'flex' }}>
              {AVATAR_COLORS.map((c, i) => (
                <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid var(--bg)', marginLeft: i > 0 ? -5 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                  {AVATAR_LETTERS[i]}
                </div>
              ))}
            </div>
            {/* Fix 8 — gold stars */}
            <span style={{ color: '#f59e0b', letterSpacing: -1 }}>★★★★★</span>
            <span>1,200+ grinding daily</span>
          </div>
        </div>

        {/* Feature cards — Fix 2: id for scroll target */}
        <div id="how-it-works" className="feat-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ borderRadius: 14, padding: '.875rem' }}>
              <div style={{ fontSize: 22, marginBottom: 7 }}>{f.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Fix 1 — CTA section replaces circle/leaderboard/theme picker */}
        <div
          className="cta-section"
          style={{ margin: '2rem 0', padding: '1.75rem', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, textAlign: 'center' }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.3px' }}>
            Your streak starts today
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Free forever. No card. Takes 30 seconds.
          </p>
          <RippleButton style={{ padding: '13px 32px', fontSize: 15 }} onClick={() => router.push('/signup')}>
            Start today →
          </RippleButton>
        </div>

        <footer style={{ textAlign: 'center', padding: '1.25rem 0', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
          Free to join · proov.app
        </footer>
      </div>
    </>
  );
}
