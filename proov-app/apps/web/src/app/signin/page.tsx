'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPostLoginRoute, resolveIdentity } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { clearWeb3AuthSession } from '@/lib/clearSession';

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
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [showUsernameLogin, setShowUsernameLogin] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSearching, setUsernameSearching] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const [showMoreSocial, setShowMoreSocial] = useState(false);

  // Reset overlay if user cancels the Web3Auth popup
  useEffect(() => {
    if (!isPending) setConnecting(false);
  }, [isPending]);

  useEffect(() => {
    const authNotice = localStorage.getItem('proov_auth_notice');
    if (authNotice) {
      setError(authNotice);
      localStorage.removeItem('proov_auth_notice');
    }
  }, []);

  useEffect(() => {
    if (isMiniPay()) {
      connectMiniPay().then(addr => {
        if (addr) {
          resolveIdentity(addr, '', 'wallet', 'injected');
          router.push(getPostLoginRoute());
        }
      });
    }
  }, [router]);

  useEffect(() => {
    if (!isConnected || !connectedAddress) return;

    import('@/lib/wagmi-config').then(({ getWeb3Auth }) =>
      getWeb3Auth().getUserInfo().catch(() => null)
    ).then(info => {
      if ((info as any)?.email) {
        localStorage.setItem('proov_email', (info as any).email);
      }
      const emailVal = localStorage.getItem('proov_email') || '';
      resolveIdentity(connectedAddress, emailVal, 'google', 'web3auth');

      return import('@/lib/supabase').then(({ getUsernameForAddress }) =>
        getUsernameForAddress(connectedAddress).then((existingUsername) => {
          if (existingUsername) {
            // Returning user — restore session and go straight to dashboard
            localStorage.setItem('proov_username', existingUsername as string);
            localStorage.setItem('proov_tutorial_done', '1');
            localStorage.setItem('proov_onboarding_done', '1');
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        })
      );
    }).catch(() => {
      router.push(getPostLoginRoute());
    });
  }, [isConnected, connectedAddress, router]);

  const handleUsernameLookup = async () => {
    const clean = usernameInput.replace(/^@/, '').toLowerCase().trim();
    if (!clean) return;
    setUsernameSearching(true);
    setUsernameError('');

    try {
      const { getAddressForUsername } = await import('@/lib/supabase');
      let address = await getAddressForUsername(clean);

      if (!address) {
        const { findAddressByUsername } = await import('@/lib/username');
        address = findAddressByUsername(clean) || null;
      }

      if (!address) {
        setUsernameError(`@${clean} not found. Check the spelling or`);
        return;
      }

      localStorage.setItem('proov_authenticated', 'true');
      localStorage.setItem('proov_address', address);
      localStorage.setItem('proov_username', clean);
      localStorage.setItem('proov_onboarding_done', '1');
      localStorage.setItem('proov_tutorial_done', '1');
      router.push('/dashboard');

    } catch {
      setUsernameError('Could not sign in right now. Try Google instead.');
    } finally {
      setUsernameSearching(false);
    }
  };

  const triggerConnect = async () => {
    setConnecting(true);
    await clearWeb3AuthSession();
    try {
      const { getWeb3Auth } = await import('@/lib/wagmi-config');
      await getWeb3Auth().logout({ cleanup: true });
    } catch {}
    const c = connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

  const footerLinkStyle: React.CSSProperties = {
    color: 'var(--accent-text)',
    fontWeight: 700,
    textDecoration: 'none',
    borderBottom: '1.5px solid var(--accent-text)',
    paddingBottom: 1,
  };

  return (
    <>
      {/* Loading overlay — shown while Web3Auth OAuth + AA provider init are running */}
      {(connecting || isPending) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'var(--btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>P</span>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--border2)',
              borderTopColor: 'var(--accent)',
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Signing you in
            </p>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              This takes a moment on first sign-in
            </p>
          </div>
        </div>
      )}

      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        {/* Logo */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: 'var(--btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>P</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Take accountability for your habits</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'var(--bg2)',
            borderRadius: 12, padding: 4, gap: 4, marginBottom: 18,
          }}>
            <button
              style={{
                flex: 1, textAlign: 'center', padding: '9px 0',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, transition: 'all 0.2s',
                background: 'var(--card-bg)',
                color: 'var(--text)',
                fontWeight: 700,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}>
              Sign in
            </button>
            <button
              onClick={() => router.push('/signup')}
              style={{
                flex: 1, textAlign: 'center', padding: '9px 0',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, transition: 'all 0.2s',
                background: 'transparent',
                color: 'var(--text3)',
                fontWeight: 500,
                boxShadow: 'none',
              }}>
              Join free
            </button>
          </div>

          {/* Username toggle */}
          <button
            onClick={() => { setShowUsernameLogin(v => !v); setUsernameError(''); setUsernameInput(''); }}
            style={{
              width: '100%', padding: '11px 14px',
              borderRadius: 12,
              border: `1px solid ${showUsernameLogin ? 'var(--accent-border)' : 'var(--border)'}`,
              background: showUsernameLogin ? 'var(--accent-bg)' : 'var(--bg2)',
              color: showUsernameLogin ? 'var(--accent-text)' : 'var(--text2)',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              marginBottom: 10,
            }}>
            <span>Sign in with @username</span>
            <span style={{
              fontSize: 11, opacity: 0.6,
              display: 'inline-block',
              transform: showUsernameLogin ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}>▾</span>
          </button>

          {/* Smooth expand */}
          <div style={{
            overflow: 'hidden',
            maxHeight: showUsernameLogin ? 110 : 0,
            transition: 'max-height 0.25s ease',
            marginBottom: showUsernameLogin ? 10 : 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center',
                background: 'var(--card-bg)',
                border: '1px solid var(--border2)',
                borderRadius: 11, padding: '0 12px',
              }}>
                <span style={{
                  color: 'var(--accent-text)',
                  fontWeight: 800, fontSize: 16, marginRight: 4,
                }}>@</span>
                <input
                  type="text"
                  placeholder="yourname"
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleUsernameLookup()}
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600,
                    padding: '10px 0', outline: 'none', fontFamily: 'inherit',
                  }}
                  autoComplete="off"
                />
              </div>
              <button
                onClick={handleUsernameLookup}
                disabled={usernameSearching || !usernameInput.trim()}
                style={{
                  padding: '10px 16px', borderRadius: 11, border: 'none',
                  background: usernameInput.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                  color: usernameInput.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
                  fontSize: 13, fontWeight: 700,
                  cursor: usernameInput.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                  transition: 'all 0.15s ease',
                }}>
                {usernameSearching ? '...' : 'Sign in'}
              </button>
            </div>
            {usernameError && (
              <p style={{
                fontSize: 12, color: '#f43f5e',
                marginTop: 6, lineHeight: 1.5, padding: '0 4px',
              }}>
                {usernameError}{' '}
                <a href="/signup" style={{ color: '#f43f5e', fontWeight: 700 }}>
                  Sign up free
                </a>
              </p>
            )}
          </div>

          {/* Social card */}
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 16, padding: 12, marginBottom: 12,
          }}>
            {error && <p style={{ fontSize: 12, color: '#f43f5e', marginBottom: 8 }}>{error}</p>}

            <button
              onClick={triggerConnect}
              disabled={isPending}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 11,
                border: '1px solid var(--border)', background: 'var(--card-bg)',
                color: 'var(--text)', fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 11,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
                transition: 'background 0.15s', boxSizing: 'border-box' as const,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}>
              <GoogleIcon />
              Continue with Google
            </button>

            <button
              onClick={triggerConnect}
              disabled={isPending}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 11,
                border: '1px solid var(--border)', background: 'var(--card-bg)',
                color: 'var(--text)', fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 11,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 0,
                transition: 'background 0.15s', boxSizing: 'border-box' as const,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}>
              <XIcon />
              Continue with Twitter
            </button>

            <button
              onClick={() => setShowMoreSocial(v => !v)}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 11,
                border: 'none', background: 'transparent',
                color: 'var(--text3)', fontSize: 12,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
              More options
              <span style={{
                fontSize: 10,
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                transform: showMoreSocial ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>▾</span>
            </button>

            {showMoreSocial && (
              <div style={{
                display: 'flex', gap: 7,
                padding: '7px 3px 2px',
                justifyContent: 'center',
                flexWrap: 'wrap' as const,
              }}>
                {[
                  { label: 'Facebook', color: '#1877F2' },
                  { label: 'Discord', color: '#5865F2' },
                  { label: 'Reddit', color: '#FF4500' },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => triggerConnect()}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text2)', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = s.color;
                      (e.currentTarget as HTMLElement).style.color = s.color;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text2)';
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>No account? </span>
            <Link href="/signup" style={footerLinkStyle}>Join free →</Link>
          </div>

        </div>
      </div>

    </>
  );
}
