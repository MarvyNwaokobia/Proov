'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useTheme } from '@/components/providers/ThemeProvider';
import Link from 'next/link';
import type { ColorMode } from '@/lib/themes';
import { getPostLoginRoute } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { findAddressByUsername } from '@/lib/username';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function SignInPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { mode, setMode } = useTheme();

  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    if (isMiniPay()) {
      connectMiniPay().then(addr => {
        if (addr) {
          localStorage.setItem('proov_authenticated', 'true');
          localStorage.setItem('proov_address', addr);
          router.push(getPostLoginRoute());
        }
      });
    }
  }, [router]);

  useEffect(() => {
    if (isConnected) {
      localStorage.setItem('proov_authenticated', 'true');
      router.push(getPostLoginRoute());
    }
  }, [isConnected, router]);

  const triggerConnect = () => {
    const c = connectors[0];
    if (c) connect({ connector: c });
  };

  const handleUsernameSignIn = () => {
    const clean = usernameInput.replace(/^@/, '').trim();
    if (!clean) return;
    const address = findAddressByUsername(clean);
    if (!address) { setUsernameError('Username not found — check spelling or sign up'); return; }
    localStorage.setItem('proov_authenticated', 'true');
    localStorage.setItem('proov_address', address);
    router.push('/dashboard');
  };

  const MODES: { value: ColorMode; label: string }[] = [
    { value: 'light',  label: '☀️ Light' },
    { value: 'dark',   label: '🌙 Dark'  },
    { value: 'system', label: '⚙️ Auto'  },
  ];

  const socialBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 11, borderRadius: 12, border: '1px solid var(--border2)',
    background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', transition: 'background .15s',
  };

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        {/* Logo */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 auto 10px' }}>P</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Pick up where you left off</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mode switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '1.25rem' }}>
            {MODES.map(m => (
              <button key={m.value} onClick={() => setMode(m.value)} style={{
                padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${mode === m.value ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === m.value ? 'var(--accent-bg)' : 'transparent',
                color: mode === m.value ? 'var(--accent-text)' : 'var(--text3)',
                transition: 'all .15s',
              }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem' }}>

            {/* Username sign-in */}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Sign in with username</p>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: 'var(--accent)', zIndex: 1 }}>@</span>
              <input
                type="text"
                placeholder="yourname"
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleUsernameSignIn()}
                style={{ paddingLeft: 28 }}
              />
            </div>
            {usernameError && (
              <p style={{ fontSize: 11, color: '#f43f5e', marginBottom: 8 }}>{usernameError}</p>
            )}
            <button
              onClick={handleUsernameSignIn}
              disabled={!usernameInput.trim()}
              style={{
                width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                background: usernameInput.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                color: usernameInput.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
                fontSize: 13, fontWeight: 600,
                cursor: usernameInput.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', marginBottom: 16, transition: 'all .15s',
              }}
            >
              Sign in →
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or continue with
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Social */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <GoogleIcon />
                Continue with Google
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <XIcon />
                Continue with Twitter
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={{ ...socialBtnStyle, color: 'var(--text2)', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                🌐 More social options
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            No account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
              Join free →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
