'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { IconFlame, IconBrain, IconUsers, IconTrophy, type Icon as TablerIcon } from '@tabler/icons-react';

const FEATURES: { Icon: TablerIcon; title: string; desc: string }[] = [
  { Icon: IconBrain,  title: 'Verified progress',     desc: 'Log what you did. We check it.' },
  { Icon: IconUsers,  title: 'Your people witness it', desc: 'They see everything.' },
  { Icon: IconTrophy, title: 'Leaderboard',            desc: 'Every day counts.' },
  { Icon: IconFlame,  title: 'Real progress',          desc: 'Earned, not claimed.' },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // OAuth redirects land here when Web3Auth's redirect URL points to the root.
    // Forward the callback or error to /signin so it can be handled properly.
    const hasCode  = new URLSearchParams(window.location.search).has('code');
    const hasError = window.location.hash.startsWith('#error=') ||
                     new URLSearchParams(window.location.search).has('error');
    const hasToken = window.location.hash.includes('access_token=');

    if (hasCode || hasError || hasToken) {
      router.replace('/signin' + window.location.search + window.location.hash);
      return;
    }

    const isAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (isAuth) router.replace('/dashboard');
  }, [router]);

  return (
    <>
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <div className="top-bar" />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1 }}>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/logo.png" className="logo-float" width={34} height={34} alt="Proov" priority style={{ objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', letterSpacing: '-.3px' }}>Proov</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/signin" style={{ padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Sign in
            </Link>
            <Link href="/signup" style={{ padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', boxShadow: '0 3px 10px var(--btn-primary-shadow)' }}>
              Join free
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ padding: '2.5rem 0 1.75rem', textAlign: 'center' }}>
          <div className="hero-animate-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '4px 13px', fontSize: 11, color: 'var(--accent-text)', marginBottom: '1.25rem', letterSpacing: '.3px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Track habits. Stay accountable
          </div>

          <h1 className="hero-h hero-animate-2" style={{ textAlign: 'center', marginBottom: '0.875rem' }}>
            Do the work.<br />
            <em>Own the proof.</em>
          </h1>

          <p className="hero-animate-3" style={{ fontSize: 15, color: 'var(--text2)', margin: '0 auto 1.75rem', lineHeight: 1.7, maxWidth: 380 }}>
            Your progress is real.
          </p>

          <div className="hero-animate-4" style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 15 }}>
              Start today →
            </Link>
            <button
              className="btn-ghost"
              style={{ fontSize: 14 }}
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See how it works
            </button>
          </div>

          <div className="hero-animate-5" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}>
            <div style={{ display: 'flex' }}>
              {(['var(--accent)', 'var(--pink)', 'var(--success,#10b981)', 'var(--amber)'] as const).map((c, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid var(--bg)', marginLeft: i > 0 ? -5 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                  {['A','T','S','J'][i]}
                </div>
              ))}
            </div>
            <span style={{ color: '#f59e0b' }}>★★★★★</span>
            <span>Join thousands building better habits</span>
          </div>
        </div>

        {/* Feature cards */}
        <div id="how-it-works" className="feat-grid" style={{ marginBottom: '1.25rem' }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="card"
              style={{ borderRadius: 14, padding: '.875rem' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ marginBottom: 7 }}><f.Icon size={24} stroke={1.6} color="var(--accent-text)" /></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA band */}
        <div className="cta-section" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 18, padding: '1.5rem', textAlign: 'center', margin: '1.25rem 0' }}>
          <div style={{ marginBottom: 8 }}><IconFlame size={32} stroke={1.8} color="var(--accent-text)" /></div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.3px' }}>
            Start today
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Free.
          </p>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '13px 32px', fontSize: 15 }}>
            Start today →
          </Link>
        </div>

        <footer style={{ textAlign: 'center', padding: '1.25rem 0', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', marginTop: '1rem' }}>
          Free to join · proov.app
        </footer>
      </div>
    </>
  );
}
