'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPostLoginRoute, resolveIdentity } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { getWeb3Auth, initWeb3Auth, getLastAdapterError } from '@/lib/wagmi-config';
import { WALLET_ADAPTERS, ADAPTER_STATUS } from '@web3auth/base';

import { IconMail, IconHash, IconDeviceMobile, IconMessage, IconMailOpened, IconCheck, IconWallet, type Icon as TablerIcon } from '@tabler/icons-react';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type AltMethod = 'magic' | 'code' | 'sms';

// Appends the underlying error message (if any) so users/devs can see *why*
// sign-in didn't complete instead of just that it didn't.
function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  return msg ? ` (${msg})` : '';
}

export default function SignUpPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending, error: connectError, reset } = useConnect();

  const [connecting, setConnecting] = useState(() =>
    typeof window !== 'undefined' && !!sessionStorage.getItem('proov_oauth_pending')
  );
  // True while we're still checking for an in-progress OAuth redirect on mount.
  // Keeps the connecting overlay up so the sign-up form never flashes underneath it.
  const [authChecking, setAuthChecking] = useState(() =>
    typeof window !== 'undefined' && !!sessionStorage.getItem('proov_oauth_pending')
  );
  const [phase, setPhase] = useState<'connecting' | 'profile' | 'welcome-back' | 'new-user'>('connecting');
  const [slowWarning, setSlowWarning] = useState(false);
  const [authError, setAuthError] = useState('');
  const [altMethod, setAltMethod] = useState<AltMethod>('magic');
  const [input, setInput] = useState('');
  const [sent, setSent] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const walletConnectRef = useRef(false);

  // Don't drop the connecting overlay until the OAuth-redirect check on mount
  // has finished — otherwise isPending/isConnected are still false on first
  // render and this would flash the sign-up form before initWeb3Auth() resolves.
  useEffect(() => {
    if (authChecking) return;
    if (!isPending && !isConnected) setConnecting(false);
  }, [isPending, isConnected, authChecking]);

  // Mount: handle OAuth callback or pre-warm Web3Auth. Skip entirely for MiniPay.
  useEffect(() => {
    if (isMiniPay()) return;

    reset();

    const params = new URLSearchParams(window.location.search);
    if (window.location.hash.startsWith('#error=') || params.has('error')) {
      const msg = params.get('error_description') || 'Sign-in was cancelled.';
      setAuthError(msg.replace(/\+/g, ' '));
      window.history.replaceState(null, '', window.location.pathname);
      sessionStorage.removeItem('proov_oauth_pending');
      setConnecting(false);
      setAuthChecking(false);
      return;
    }

    const wasOAuthPending = !!sessionStorage.getItem('proov_oauth_pending');
    localStorage.removeItem('wagmi.store');

    initWeb3Auth().then(() => {
      sessionStorage.removeItem('proov_oauth_pending');
      const w = getWeb3Auth();
      if (!w.connected) {
        setConnecting(false);
        setAuthChecking(false);
        if (wasOAuthPending) {
          const err = getLastAdapterError();
          console.error('[signup] OAuth redirect did not complete', err);
          setAuthError(`Sign-in didn't complete${describeError(err)}. Please try again.`);
        }
        return;
      }
      setConnecting(true);
      const c = connectors.find(c => c.id === 'web3auth-aa') ?? connectors[0];
      if (c) connect({ connector: c });
      else setConnecting(false);
      setAuthChecking(false);
    }).catch((err) => {
      sessionStorage.removeItem('proov_oauth_pending');
      setConnecting(false);
      setAuthChecking(false);
      if (wasOAuthPending) {
        console.error('[signup] initWeb3Auth failed', err);
        setAuthError(`Sign-in didn't complete${describeError(err)}. Please try again.`);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A connect() attempt (post-redirect or otherwise) rejected — drop the
  // overlay and tell the user instead of silently falling back to the form.
  useEffect(() => {
    if (connectError && !isConnected) {
      setConnecting(false);
      console.error('[signup] connect() failed', connectError);
      setAuthError(`Sign-in didn't complete${describeError(connectError)}. Please try again.`);
    }
  }, [connectError, isConnected]);

  // Slow warning at 10s, hard reset at 20s
  useEffect(() => {
    if (!connecting && !isPending) { setSlowWarning(false); return; }
    if (isConnected) return;
    const warn = setTimeout(() => setSlowWarning(true), 10_000);
    const bail = setTimeout(() => {
      reset();
      setConnecting(false);
      setAuthChecking(false);
      setSlowWarning(false);
      setAuthError("Sign-in didn't complete. Please try again.");
    }, 20_000);
    return () => { clearTimeout(warn); clearTimeout(bail); };
  }, [connecting, isPending, isConnected, reset]);

  // MiniPay: resolve identity first, then connect wagmi, then navigate
  useEffect(() => {
    if (!isMiniPay()) return;
    setConnecting(true);
    connectMiniPay().then(async addr => {
      if (!addr) { setConnecting(false); return; }
      await resolveIdentity(addr, '', 'wallet', 'injected');
      const c = connectors.find(c => c.id === 'injected') ?? connectors[0];
      if (c) connect({ connector: c });
      router.push(await getPostLoginRoute());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
    if (isMiniPay()) return;
    let cancelled = false;
    setConnecting(true);
    setPhase('profile');
    const resolve = async () => {
      let route = '/onboarding';
      let returningUser = false;
      try {
        if (walletConnectRef.current) {
          // External wallet — skip Web3Auth, resolve as injected
          const identity = await resolveIdentity(connectedAddress, '', 'wallet', 'injected');
          if (identity.username) {
            localStorage.setItem('proov_tutorial_done', '1');
            returningUser = true;
            route = '/dashboard';
          } else {
            route = await getPostLoginRoute();
          }
        } else {
          route = await Promise.race([
            (async () => {
              const { getWeb3Auth } = await import('@/lib/wagmi-config');
              const info = await getWeb3Auth().getUserInfo().catch(() => null);
              if ((info as any)?.email) localStorage.setItem('proov_email', (info as any).email);
              const emailVal = localStorage.getItem('proov_email') || '';
              const identity = await resolveIdentity(connectedAddress, emailVal, 'google', 'web3auth');
              if (identity.username) {
                localStorage.setItem('proov_tutorial_done', '1');
                returningUser = true;
                return '/dashboard';
              }
              return '/onboarding';
            })(),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
          ]);
        }
      } catch {
        const username = localStorage.getItem('proov_username');
        const onboardingDone = localStorage.getItem('proov_onboarding_done');
        returningUser = !!(username && onboardingDone);
        route = returningUser ? '/dashboard' : '/onboarding';
      }
      if (cancelled) return;
      setPhase(returningUser ? 'welcome-back' : 'new-user');
      setTimeout(() => { if (!cancelled) router.push(route); }, 600);
    };
    resolve();
    return () => { cancelled = true; };
  }, [isConnected, connectedAddress, router]);

  const triggerConnect = async (loginProvider = 'google') => {
    setConnecting(true);
    setAuthError('');
    sessionStorage.setItem('proov_oauth_pending', '1');
    const web3auth = getWeb3Auth();
    try {
      await initWeb3Auth();
      // connectTo() fires adapter.connect() without awaiting or catching it.
      // If the adapter is already CONNECTING (e.g. a previous attempt is
      // still in flight after "Taking too long? Try again"), that call
      // throws "Already connecting" as an unhandled rejection and the
      // connectTo() promise never settles — the page would hang forever
      // with no feedback. Bail out early with a clear message instead.
      const authAdapter = (web3auth as any).walletAdapters?.[WALLET_ADAPTERS.AUTH];
      if (authAdapter?.status === ADAPTER_STATUS.CONNECTING) {
        throw new Error('A previous sign-in attempt is still in progress — please wait or refresh the page');
      }
      await (web3auth as any).connectTo(WALLET_ADAPTERS.AUTH, {
        loginProvider,
        redirectUrl: window.location.origin + window.location.pathname,
      });
    } catch (err) {
      sessionStorage.removeItem('proov_oauth_pending');
      setConnecting(false);
      console.error('[signup] connectTo failed', err);
      setAuthError(`Sign-in didn't complete${describeError(err)}. Please try again.`);
      return;
    }
    const c = connectors.find(c => c.id === 'web3auth-aa') ?? connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

  const connectWithWallet = (connectorId: string) => {
    setAuthError('');
    walletConnectRef.current = true;
    const c = connectors.find(c => c.id === connectorId);
    if (c) {
      setShowWalletPicker(false);
      setConnecting(true);
      connect({ connector: c });
    } else {
      setAuthError('Wallet not available. Please install it and try again.');
    }
  };

  const walletOptions = connectors
    .filter(c => c.id !== 'web3auth-aa' && c.id !== 'mock')
    .map(c => ({ id: c.id, name: c.name }));

  const handleSend = () => {
    if (!input.trim()) return;
    if (altMethod === 'sms') triggerConnect('sms_passwordless');
    else triggerConnect('email_passwordless');
    setSent(true);
  };

  const switchMethod = (m: AltMethod) => { setAltMethod(m); setInput(''); setSent(false); };

  const tabs: { id: AltMethod; label: string; Icon: TablerIcon }[] = [
    { id: 'magic', label: 'Magic link', Icon: IconMail         },
    { id: 'code',  label: 'Email code', Icon: IconHash         },
    { id: 'sms',   label: 'SMS',        Icon: IconDeviceMobile },
  ];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, transition: 'all .15s',
    background: active ? 'var(--card-bg)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text3)',
    fontWeight: active ? 700 : 500,
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  });

  const placeholder = altMethod === 'sms' ? '+1 (555) 000-0000' : 'your@email.com';
  const inputType  = altMethod === 'sms' ? 'tel' : 'email';
  const sendLabel  = altMethod === 'magic' ? 'Send magic link' : altMethod === 'code' ? 'Send code' : 'Send SMS code';
  const SentIcon   = altMethod === 'sms' ? IconMessage : IconMailOpened;
  const sentTitle  = altMethod === 'sms' ? 'Check your messages' : altMethod === 'magic' ? 'Check your inbox' : 'Check your inbox';
  const sentDesc   = altMethod === 'sms'
    ? `We sent a code to ${input}`
    : altMethod === 'magic'
    ? `We sent a sign-in link to ${input} — click it to continue`
    : `We sent a 6-digit code to ${input}`;

  return (
    <>
      {(connecting || isPending) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <img src="/logo.png" style={{ width: 60, height: 60, objectFit: 'contain' }} alt="Proov" />
          {phase === 'welcome-back' || phase === 'new-user' ? (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCheck size={20} stroke={2.5} color="var(--accent-text)" />
            </div>
          ) : (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border2)', borderTopColor: 'var(--accent)' }} />
          )}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {phase === 'connecting' && 'Setting up your account…'}
              {phase === 'profile' && 'Loading your profile…'}
              {phase === 'welcome-back' && 'Welcome back!'}
              {phase === 'new-user' && "You're connected to your account!"}
            </p>
            {phase === 'connecting' && (
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>This takes a moment on first sign-in</p>
            )}
            {slowWarning && phase === 'connecting' && (
              <button
                onClick={() => {
                  reset();
                  setConnecting(false);
                  setAuthChecking(false);
                  setSlowWarning(false);
                  setAuthError("Sign-in didn't complete. Please try again.");
                }}
                style={{ marginTop: 12, background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                Taking too long? Try again
              </button>
            )}
          </div>
        </div>
      )}

      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <img src="/logo.png" style={{ width: 48, height: 48, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} alt="Proov" />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome to Proov</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Your discipline. Onchain.</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Sign in / Join free tabs */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 18 }}>
            <button onClick={() => router.push('/signin')} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: 'transparent', color: 'var(--text3)', fontWeight: 500 }}>
              Sign in
            </button>
            <button style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
              Join free
            </button>
          </div>

          {/* OAuth error banner */}
          {authError && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#f43f5e', lineHeight: 1.4 }}>{authError}</span>
              <button onClick={() => setAuthError('')} style={{ background: 'none', border: 'none', fontSize: 14, color: '#f43f5e', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>
          )}

          {/* Google */}
          <button
            onClick={() => triggerConnect('google')}
            disabled={isPending}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}>
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Connect Wallet */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setShowWalletPicker(v => !v)}
              disabled={isPending}
              style={{ width: '100%', padding: '13px 16px', borderRadius: 13, border: `1.5px solid ${showWalletPicker ? 'var(--accent-border)' : 'var(--border)'}`, background: showWalletPicker ? 'var(--accent-bg)' : 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .15s' }}>
              <IconWallet size={20} stroke={1.8} />
              Connect Wallet
              <span style={{ fontSize: 10, opacity: 0.5, display: 'inline-block', transform: showWalletPicker ? 'rotate(180deg)' : 'none', transition: 'transform .2s', marginLeft: 'auto' }}>▾</span>
            </button>
            <div style={{ overflow: 'hidden', maxHeight: showWalletPicker ? 300 : 0, transition: 'max-height .25s ease' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
                {walletOptions.map(w => (
                  <button
                    key={w.id}
                    onClick={() => connectWithWallet(w.id)}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 11,
                      border: '1px solid var(--border)', background: 'var(--bg2)',
                      color: 'var(--text)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Magic link / Code / SMS tabs */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3, gap: 3, marginBottom: 12 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => switchMethod(t.id)} style={tabStyle(altMethod === t.id)}>
                <t.Icon size={11} stroke={2} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Input + action */}
          {!sent ? (
            <>
              <input
                type={inputType}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={placeholder}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isPending}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: input.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: input.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 16 }}>
                {sendLabel}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ marginBottom: 8 }}><SentIcon size={32} stroke={1.5} color="var(--accent-text)" /></div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{sentTitle}</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>{sentDesc}</p>
              <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Try again
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              By joining you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Privacy</a>
            </p>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Already have an account? </span>
            <Link href="/signin" style={{ color: 'var(--accent-text)', fontWeight: 700, textDecoration: 'none', borderBottom: '1.5px solid var(--accent-text)', paddingBottom: 1 }}>Sign in →</Link>
          </div>

        </div>
      </div>
    </>
  );
}
