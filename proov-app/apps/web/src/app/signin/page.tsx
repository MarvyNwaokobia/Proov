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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type AltMethod = 'email' | 'sms';

export default function SignInPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [notice, setNotice] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [altMethod, setAltMethod] = useState<AltMethod>('email');
  const [input, setInput] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isPending) setConnecting(false);
  }, [isPending]);

  useEffect(() => {
    const msg = localStorage.getItem('proov_auth_notice');
    if (msg) { setNotice(msg); localStorage.removeItem('proov_auth_notice'); }
  }, []);

  useEffect(() => {
    if (isMiniPay()) {
      connectMiniPay().then(addr => {
        if (addr) { resolveIdentity(addr, '', 'wallet', 'injected'); router.push(getPostLoginRoute()); }
      });
    }
  }, [router]);

  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
    import('@/lib/wagmi-config').then(({ getWeb3Auth }) =>
      getWeb3Auth().getUserInfo().catch(() => null)
    ).then(info => {
      if ((info as any)?.email) localStorage.setItem('proov_email', (info as any).email);
      const emailVal = localStorage.getItem('proov_email') || '';
      resolveIdentity(connectedAddress, emailVal, 'google', 'web3auth');
      return import('@/lib/supabase').then(({ getUsernameForAddress }) =>
        getUsernameForAddress(connectedAddress).then(existing => {
          if (existing) {
            localStorage.setItem('proov_username', existing as string);
            localStorage.setItem('proov_tutorial_done', '1');
            localStorage.setItem('proov_onboarding_done', '1');
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        })
      );
    }).catch(() => router.push(getPostLoginRoute()));
  }, [isConnected, connectedAddress, router]);

  const triggerConnect = async (loginProvider = 'google') => {
    setConnecting(true);
    await clearWeb3AuthSession();
    const { getWeb3Auth } = await import('@/lib/wagmi-config');
    const web3auth = getWeb3Auth();
    try { await web3auth.logout({ cleanup: true }); } catch {}
    try {
      if ((web3auth as any).status === 'not_ready') await (web3auth as any).initModal();
      const { WALLET_ADAPTERS } = await import('@web3auth/base');
      await (web3auth as any).connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });
    } catch {}
    const c = connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

  const handleAltSend = () => {
    if (!input.trim()) return;
    triggerConnect(altMethod === 'email' ? 'email_passwordless' : 'sms_passwordless');
    setSent(true);
  };

  const switchMethod = (m: AltMethod) => {
    setAltMethod(m);
    setInput('');
    setSent(false);
  };

  const btnActive = { background: 'var(--card-bg)', color: 'var(--text)', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' } as const;
  const btnInactive = { background: 'transparent', color: 'var(--text3)', fontWeight: 500, boxShadow: 'none' } as const;

  return (
    <>
      {(connecting || isPending) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>P</span>
          </div>
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
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>P</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Take accountability for your habits</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Tab switcher — Sign in / Join free */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 18 }}>
            <button style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, ...btnActive }}>
              Sign in
            </button>
            <button onClick={() => router.push('/signup')} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, ...btnInactive }}>
              Join free
            </button>
          </div>

          {/* Session notice */}
          {notice && (
            <div style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 10, padding: '9px 12px', fontSize: 11, color: '#f43f5e', marginBottom: 14, lineHeight: 1.5 }}>
              {notice}
            </div>
          )}

          {/* Google */}
          <button
            onClick={() => triggerConnect('google')}
            disabled={isPending}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 13, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-bg)'; }}>
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Email / SMS toggle */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3, gap: 3, marginBottom: 10 }}>
            {(['email', 'sms'] as AltMethod[]).map(m => (
              <button key={m} onClick={() => switchMethod(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, transition: 'all .15s', ...(altMethod === m ? btnActive : btnInactive) }}>
                {m === 'email' ? '✉️ Email' : '📱 SMS'}
              </button>
            ))}
          </div>

          {/* Input + send */}
          {!sent ? (
            <>
              <input
                type={altMethod === 'email' ? 'email' : 'tel'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAltSend()}
                placeholder={altMethod === 'email' ? 'your@email.com' : '+1 (555) 000-0000'}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleAltSend}
                disabled={!input.trim() || isPending}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: input.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: input.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 16 }}>
                {altMethod === 'email' ? 'Send magic link' : 'Send code'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{altMethod === 'email' ? '📬' : '💬'}</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {altMethod === 'email' ? 'Check your inbox' : 'Check your messages'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
                {altMethod === 'email' ? `We sent a link to ${input}` : `We sent a code to ${input}`}
              </p>
              <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Try again
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>No account? </span>
            <Link href="/signup" style={{ color: 'var(--accent-text)', fontWeight: 700, textDecoration: 'none', borderBottom: '1.5px solid var(--accent-text)', paddingBottom: 1 }}>Join free →</Link>
          </div>

        </div>
      </div>
    </>
  );
}
