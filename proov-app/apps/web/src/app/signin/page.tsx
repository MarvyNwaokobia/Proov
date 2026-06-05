'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPostLoginRoute, resolveIdentity } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { getWeb3Auth } from '@/lib/wagmi-config';
import { ADAPTER_STATUS, WALLET_ADAPTERS } from '@web3auth/base';

import { IconMail, IconHash, IconDeviceMobile, IconMessage, IconMailOpened, type Icon as TablerIcon } from '@tabler/icons-react';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type AltMethod = 'magic' | 'code' | 'sms';

export default function SignInPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [notice, setNotice] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [altMethod, setAltMethod] = useState<AltMethod>('magic');
  const [input, setInput] = useState('');
  const [sent, setSent] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSearching, setUsernameSearching] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [showUsername, setShowUsername] = useState(false);

  // Only clear the loading screen if wagmi finished AND we did NOT get a connection
  // (i.e. the connect call failed). If isConnected=true, the navigation effect below
  // keeps the screen up until it finishes and navigates.
  useEffect(() => { if (!isPending && !isConnected) setConnecting(false); }, [isPending, isConnected]);

  useEffect(() => {
    const msg = localStorage.getItem('proov_auth_notice');
    if (msg) { setNotice(msg); localStorage.removeItem('proov_auth_notice'); }
  }, []);

  // On mount: either complete a redirect-mode OAuth callback or reset stale session state.
  // In redirect mode Web3Auth returns to this page with ?code=... — calling logout() here
  // would wipe that just-completed session, so we skip it when a callback is detected.
  // MiniPay: skip entirely — the injected provider manages its own state.
  useEffect(() => {
    if (isMiniPay()) return;

    const isCallback = new URLSearchParams(window.location.search).has('code') ||
      window.location.hash.includes('access_token=');

    if (!isCallback) localStorage.removeItem('wagmi.store');

    const w = getWeb3Auth();
    if (isCallback) {
      (w as any).initModal().then(() => {
        if (w.connected) {
          const c = connectors[0];
          if (c) connect({ connector: c });
        }
      }).catch(() => {});
    } else {
      w.logout({ cleanup: true }).catch(() => {}).then(() =>
        (w as any).initModal().catch(() => {})
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMiniPay()) return;
    setConnecting(true);
    // Connect wagmi to the injected MiniPay provider (sets up useAccount/useWriteContract)
    const c = connectors[0];
    if (c) connect({ connector: c });
    // Also resolve identity directly so localStorage is primed before navigation
    connectMiniPay().then(async addr => {
      if (addr) { await resolveIdentity(addr, '', 'wallet', 'injected'); router.push(await getPostLoginRoute()); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
    // MiniPay: identity was already resolved in the MiniPay connect effect — just navigate
    if (isMiniPay()) return;
    let cancelled = false;
    const resolve = async () => {
      let route = '/onboarding';
      try {
        route = await Promise.race([
          (async () => {
            const { getWeb3Auth } = await import('@/lib/wagmi-config');
            const info = await getWeb3Auth().getUserInfo().catch(() => null);
            if ((info as any)?.email) localStorage.setItem('proov_email', (info as any).email);
            const emailVal = localStorage.getItem('proov_email') || '';
            const identity = await resolveIdentity(connectedAddress, emailVal, 'google', 'web3auth');
            if (identity.username) { localStorage.setItem('proov_tutorial_done', '1'); return '/dashboard'; }
            return '/onboarding';
          })(),
          // 8-second timeout: fall back to whatever is already in localStorage
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
      } catch {
        const username = localStorage.getItem('proov_username');
        const onboardingDone = localStorage.getItem('proov_onboarding_done');
        route = (username && onboardingDone) ? '/dashboard' : '/onboarding';
      }
      if (!cancelled) router.push(route);
    };
    resolve();
    return () => { cancelled = true; };
  }, [isConnected, connectedAddress, router]);

  const triggerConnect = async (loginProvider = 'google') => {
    setConnecting(true);
    const web3auth = getWeb3Auth();
    try {
      if (web3auth.status === ADAPTER_STATUS.NOT_READY) await (web3auth as any).initModal();
      await web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });
    } catch {
      setConnecting(false);
      return;
    }
    const c = connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

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
      if (!address) { setUsernameError(`@${clean} not found`); return; }
      localStorage.setItem('proov_authenticated', 'true');
      localStorage.setItem('proov_address', address);
      localStorage.setItem('proov_username', clean);
      localStorage.setItem('proov_onboarding_done', '1');
      localStorage.setItem('proov_tutorial_done', '1');
      router.push('/dashboard');
    } catch {
      setUsernameError('Could not sign in. Try Google instead.');
    } finally {
      setUsernameSearching(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    if (altMethod === 'sms') triggerConnect('sms_passwordless');
    else triggerConnect('email_passwordless');
    setSent(true);
  };

  const switchMethod = (m: AltMethod) => { setAltMethod(m); setInput(''); setSent(false); };

  const tabs: { id: AltMethod; label: string; Icon: TablerIcon }[] = [
    { id: 'magic', label: 'Magic link', Icon: IconMail          },
    { id: 'code',  label: 'Email code', Icon: IconHash          },
    { id: 'sms',   label: 'SMS',        Icon: IconDeviceMobile  },
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
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border2)', borderTopColor: 'var(--accent)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Signing you in</p>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>This takes a moment on first sign-in</p>
          </div>
        </div>
      )}

      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <img src="/logo.png" style={{ width: 48, height: 48, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} alt="Proov" />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Take accountability for your habits</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Sign in / Join free tabs */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 18 }}>
            <button style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text)', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
              Sign in
            </button>
            <button onClick={() => router.push('/signup')} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: 'transparent', color: 'var(--text3)', fontWeight: 500 }}>
              Join free
            </button>
          </div>

          {notice && (
            <div style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 10, padding: '9px 12px', fontSize: 11, color: '#f43f5e', marginBottom: 14, lineHeight: 1.5 }}>
              {notice}
            </div>
          )}

          {/* Username login — above Google */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => { setShowUsername(v => !v); setUsernameError(''); setUsernameInput(''); }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 11, border: `1px solid ${showUsername ? 'var(--accent-border)' : 'var(--border)'}`, background: showUsername ? 'var(--accent-bg)' : 'var(--bg2)', color: showUsername ? 'var(--accent-text)' : 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .15s' }}>
              <span>Sign in with @username</span>
              <span style={{ fontSize: 10, opacity: 0.6, display: 'inline-block', transform: showUsername ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            <div style={{ overflow: 'hidden', maxHeight: showUsername ? 120 : 0, transition: 'max-height .25s ease', marginTop: showUsername ? 8 : 0 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border2)', borderRadius: 11, padding: '0 12px' }}>
                  <span style={{ color: 'var(--accent-text)', fontWeight: 800, fontSize: 15, marginRight: 4 }}>@</span>
                  <input
                    type="text"
                    placeholder="yourname"
                    value={usernameInput}
                    onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleUsernameLookup()}
                    style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, padding: '10px 0', outline: 'none', fontFamily: 'inherit' }}
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={handleUsernameLookup}
                  disabled={usernameSearching || !usernameInput.trim()}
                  style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: usernameInput.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: usernameInput.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 13, fontWeight: 700, cursor: usernameInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {usernameSearching ? '…' : 'Go'}
                </button>
              </div>
              {usernameError && <p style={{ fontSize: 12, color: '#f43f5e', marginTop: 6, padding: '0 4px' }}>{usernameError}</p>}
            </div>
          </div>

          {/* Google */}
          <button
            onClick={() => triggerConnect('google')}
            disabled={isPending}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}>
            <GoogleIcon />
            Continue with Google
          </button>

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

          {/* Input + send */}
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

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>No account? </span>
            <Link href="/signup" style={{ color: 'var(--accent-text)', fontWeight: 700, textDecoration: 'none', borderBottom: '1.5px solid var(--accent-text)', paddingBottom: 1 }}>Join free →</Link>
          </div>

        </div>
      </div>
    </>
  );
}
