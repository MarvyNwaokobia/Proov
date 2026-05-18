'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useTheme } from '@/components/providers/ThemeProvider';
import Link from 'next/link';
import type { ColorMode } from '@/lib/themes';

type EmailMethod = 'link' | 'code';

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
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { mode, setMode } = useTheme();

  const [email, setEmail] = useState('');
  const [emailMethod, setEmailMethod] = useState<EmailMethod>('link');
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  useEffect(() => { if (isConnected) router.replace('/dashboard'); }, [isConnected, router]);

  const triggerConnect = () => {
    const c = connectors[0];
    if (c) connect({ connector: c });
  };

  const handleSendEmail = () => {
    if (!email.trim()) return;
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Start your streak</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Free forever. No card needed.</p>
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

            {/* Social */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <GoogleIcon />
                Join with Google
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <XIcon />
                Join with Twitter
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={{ ...socialBtnStyle, color: 'var(--text2)', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                🌐 More social options
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0.875rem 0', fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or with email
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {!codeSent ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ marginBottom: 10 }}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {(['link', 'code'] as EmailMethod[]).map(m => (
                    <button key={m} onClick={() => setEmailMethod(m)} style={{
                      padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${emailMethod === m ? 'var(--accent)' : 'var(--border)'}`,
                      background: emailMethod === m ? 'var(--accent-bg)' : 'transparent',
                      color: emailMethod === m ? 'var(--accent-text)' : 'var(--text3)',
                      transition: 'all .15s',
                    }}>
                      {m === 'link' ? '✉️ Magic link' : '🔢 6-digit code'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={isPending || !email.trim()}
                  style={{
                    width: '100%', padding: 12, borderRadius: 12, border: 'none',
                    background: email.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                    color: email.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
                    fontSize: 14, fontWeight: 600,
                    cursor: email.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >
                  {isPending ? 'Connecting...' : emailMethod === 'link' ? 'Send magic link' : 'Send code'}
                </button>
              </>
            ) : emailMethod === 'link' ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Check your inbox</p>
                <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>We sent a link to {email}</p>
                <button onClick={() => setCodeSent(false)} style={{ marginTop: 14, background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Try a different method
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>Enter the 6-digit code sent to {email}</p>
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

            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: '1rem' }}>
              By joining you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--accent-text)' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: 'var(--accent-text)' }}>Privacy</a>
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            Already have an account?{' '}
            <Link href="/signin" style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
