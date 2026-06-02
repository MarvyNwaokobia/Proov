'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPostLoginRoute, resolveIdentity } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { clearWeb3AuthSession } from '@/lib/clearSession';
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

export default function SignUpPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [connecting, setConnecting] = useState(false);
  const [altMethod, setAltMethod] = useState<AltMethod>('magic');
  const [input, setInput] = useState('');
  const [sent, setSent] = useState(false);

  // Only clear the loading screen if wagmi finished AND we did NOT get a connection.
  useEffect(() => { if (!isPending && !isConnected) setConnecting(false); }, [isPending, isConnected]);

  // Pre-clear any stale session on mount so connectTo fires immediately on click.
  // New users have no existing session — browser blocks popups opened after async delays.
  useEffect(() => {
    clearWeb3AuthSession().then(() => {
      import('@/lib/wagmi-config').then(({ getWeb3Auth }) => {
        try { getWeb3Auth().logout({ cleanup: true }).catch(() => {}); } catch {}
      });
    });
  }, []);

  useEffect(() => {
    if (isMiniPay()) {
      connectMiniPay().then(async addr => {
        if (addr) { await resolveIdentity(addr, '', 'wallet', 'injected'); router.push(await getPostLoginRoute()); }
      });
    }
  }, [router]);

  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
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
    // Cleanup already ran on mount — call connectTo immediately to avoid popup blocker.
    const { getWeb3Auth } = await import('@/lib/wagmi-config');
    const web3auth = getWeb3Auth();
    try {
      // Always re-init the auth adapter before connectTo — this resets any stale
      // post-logout state and ensures a clean direct-to-Google flow every time.
      await (web3auth as any).initModal();
      const { WALLET_ADAPTERS } = await import('@web3auth/base');
      await (web3auth as any).connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });
    } catch {
      setConnecting(false);
      return;
    }
    const c = connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

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
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.png" style={{ width: 40, height: 40, objectFit: 'contain' }} alt="Proov" />
          </div>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border2)', borderTopColor: 'var(--accent)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Setting up your account</p>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>This takes a moment on first sign-in</p>
          </div>
        </div>
      )}

      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', overflow: 'hidden' }}>
            <img src="/logo.png" style={{ width: 32, height: 32, objectFit: 'contain' }} alt="Proov" />
          </div>
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
