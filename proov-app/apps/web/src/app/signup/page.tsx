'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPostLoginRoute, resolveIdentity } from '@/lib/auth';
import { isMiniPay, connectMiniPay } from '@/lib/minipay';
import { clearWeb3AuthSession } from '@/lib/clearSession';

type EmailMethod = 'link' | 'code' | 'number';

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

export default function SignUpPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailMethod, setEmailMethod] = useState<EmailMethod>('link');
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [showMoreSocial, setShowMoreSocial] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Reset overlay if user cancels the Web3Auth popup
  useEffect(() => {
    if (!isPending) setConnecting(false);
  }, [isPending]);

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
        getUsernameForAddress(connectedAddress)
      );
    }).then(existingUsername => {
      if (existingUsername) {
        localStorage.setItem('proov_username', existingUsername as string);
        localStorage.setItem('proov_tutorial_done', '1');
        router.push('/dashboard');
      } else {
        router.push(getPostLoginRoute());
      }
    }).catch(() => {
      router.push(getPostLoginRoute());
    });
  }, [isConnected, connectedAddress, router]);

  const triggerConnect = async (loginProvider = 'google') => {
    setConnecting(true);
    await clearWeb3AuthSession();
    const { getWeb3Auth } = await import('@/lib/wagmi-config');
    const web3auth = getWeb3Auth();
    try { await web3auth.logout({ cleanup: true }); } catch {}
    try {
      // Init adapter if needed, then connect directly to the provider — skips Web3Auth modal
      if ((web3auth as any).status === 'not_ready') await (web3auth as any).initModal();
      const { WALLET_ADAPTERS } = await import('@web3auth/base');
      await (web3auth as any).connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });
    } catch {
      // connectTo failed — fall back to full modal
    }
    // Sync wagmi: connector.connect() sees web3auth is already connected and skips re-auth
    const c = connectors[0];
    if (c) connect({ connector: c });
    else setConnecting(false);
  };

  const inputValue = emailMethod === 'number' ? phone : email;
  const hasInput = inputValue.trim().length > 0;

  const handleSendEmail = () => {
    if (!hasInput) return;
    triggerConnect();
    setCodeSent(true);
  };

  const handleOtpChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`signup-otp-${idx + 1}`)?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      document.getElementById('signup-otp-5')?.focus();
    }
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
              Setting up your wallet
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome to Proov</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Take accountability for your habits</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'var(--bg2)',
            borderRadius: 12, padding: 4, gap: 4, marginBottom: 18,
          }}>
            <button
              onClick={() => router.push('/signin')}
              style={{
                flex: 1, textAlign: 'center', padding: '9px 0',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, transition: 'all 0.2s',
                background: 'transparent',
                color: 'var(--text3)',
                fontWeight: 500,
                boxShadow: 'none',
              }}>
              Sign in
            </button>
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
              Join free
            </button>
          </div>

          {/* Social card */}
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 16, padding: 12, marginBottom: 12,
          }}>
            {error && <p style={{ fontSize: 12, color: '#f43f5e', marginBottom: 8 }}>{error}</p>}

            <button
              onClick={() => triggerConnect('google')}
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
              Join with Google
            </button>

            <button
              onClick={() => triggerConnect('google')}
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
              Join with Twitter
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

          {/* Email section */}
          {!codeSent ? (
            <div style={{ marginBottom: 12 }}>
              {emailMethod === 'number' ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{
                    width: '100%', padding: '11px 14px',
                    borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg2)', color: 'var(--text)', fontSize: 13,
                    marginBottom: 8, boxSizing: 'border-box' as const,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              ) : (
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                  style={{
                    width: '100%', padding: '11px 14px',
                    borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg2)', color: 'var(--text)', fontSize: 13,
                    marginBottom: 8, boxSizing: 'border-box' as const,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                {(['link', 'code', 'number'] as EmailMethod[]).map(m => (
                  <button key={m} onClick={() => setEmailMethod(m)} style={{
                    padding: '7px 4px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${emailMethod === m ? 'var(--accent)' : 'var(--border)'}`,
                    background: emailMethod === m ? 'var(--accent-bg)' : 'transparent',
                    color: emailMethod === m ? 'var(--accent-text)' : 'var(--text3)',
                    transition: 'all .15s',
                  }}>
                    {m === 'link' ? '✉️ Link' : m === 'code' ? '🔢 Code' : '📱 Number'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSendEmail}
                disabled={isPending || !hasInput}
                style={{
                  width: '100%', padding: 12, borderRadius: 12, border: 'none',
                  background: hasInput ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                  color: hasInput ? 'var(--btn-primary-text)' : 'var(--text3)',
                  fontSize: 14, fontWeight: 600,
                  cursor: hasInput ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all .15s',
                  marginBottom: 0,
                }}
              >
                {isPending ? 'Connecting...' : emailMethod === 'link' ? 'Send magic link' : emailMethod === 'code' ? 'Send code' : 'Send SMS code'}
              </button>
            </div>
          ) : emailMethod === 'link' ? (
            <div style={{ textAlign: 'center', padding: '1rem 0', marginBottom: 12 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Check your inbox</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>We sent a link to {email}</p>
              <button onClick={() => setCodeSent(false)} style={{ marginTop: 14, background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Try a different method
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                Enter the code sent to {emailMethod === 'number' ? phone : email}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1rem' }} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`signup-otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(e.target.value, i)}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !digit && i > 0) {
                        document.getElementById(`signup-otp-${i - 1}`)?.focus();
                      }
                    }}
                    style={{
                      width: 44, height: 52, textAlign: 'center', fontSize: 22,
                      fontWeight: 700, padding: 0, borderRadius: 10,
                      border: `2px solid ${digit ? 'var(--accent)' : 'var(--border2)'}`,
                      background: 'var(--input-bg)', color: 'var(--text)',
                    }}
                  />
                ))}
              </div>
              <button onClick={() => setCodeSent(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Resend code
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              By joining you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Privacy</a>
            </p>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Already have an account? </span>
            <Link href="/signin" style={footerLinkStyle}>Sign in →</Link>
          </div>

        </div>
      </div>

    </>
  );
}
