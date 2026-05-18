'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useDisconnect } from 'wagmi';
import { hasWeb3AuthClientId } from '@/lib/wagmi-config';
import Link from 'next/link';

type EmailFlow = 'idle' | 'sent' | 'otp';

export default function SignInPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connecting, setConnecting] = useState<'social' | 'wallet' | null>(null);

  // Email flow state
  const [email, setEmail] = useState('');
  const [emailFlow, setEmailFlow] = useState<EmailFlow>('idle');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isConnected) router.replace('/dashboard');
  }, [isConnected, router]);

  useEffect(() => {
    if (!isPending) setConnecting(null);
  }, [isPending]);

  // Countdown for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSocial = () => {
    const c = connectors[0];
    if (c) { setConnecting('social'); connect({ connector: c }); }
  };

  const handleWallet = () => {
    const c = connectors[1] ?? connectors[0];
    if (c) { setConnecting('wallet'); connect({ connector: c }); }
  };

  const handleSendMagicLink = () => {
    if (!email.trim()) return;
    // Web3Auth handles the actual email send via its modal
    // Triggering social connector (Web3Auth) will open its email flow
    handleSocial();
    setEmailFlow('sent');
  };

  const handleSendOTP = () => {
    if (!email.trim()) return;
    setEmailFlow('otp');
    setResendTimer(30);
    // Note: Web3Auth currently supports magic link only.
    // OTP would require a custom backend. Showing UI with info message.
  };

  const handleOTPChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <>
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
      </div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: '#fff', margin: '0 auto 12px' }}>P</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Pick up where you left off</p>
        </div>

        <div className="auth-card">
          {!hasWeb3AuthClientId && (
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', fontSize: 12, color: 'var(--accent-text)' }}>
              ⚠ Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local
            </div>
          )}

          {/* Social buttons */}
          <button className="social-btn" onClick={handleSocial} disabled={!hasWeb3AuthClientId || isPending}>
            {connecting === 'social' && isPending ? '⏳ Connecting…' : '✉ Continue with Google or Twitter'}
          </button>

          <div className="auth-divider">or sign in with email</div>

          {/* Email flow */}
          {emailFlow === 'idle' && (
            <div>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendMagicLink(); }}
                style={{ marginBottom: 8 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>We&apos;ll send you a sign-in link</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSendMagicLink}
                  disabled={!email.trim() || isPending}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: email.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: email.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  Send magic link
                </button>
                <button
                  onClick={handleSendOTP}
                  disabled={!email.trim()}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  Send code
                </button>
              </div>
            </div>
          )}

          {emailFlow === 'sent' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📨</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Check your email</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
                We sent a sign-in link to <strong>{email}</strong>
              </p>
              <button onClick={() => setEmailFlow('idle')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Use a different email
              </button>
            </div>
          )}

          {emailFlow === 'otp' && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Enter the 6-digit code</p>
              <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 14 }}>Sent to {email}</p>

              {/* OTP boxes */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOTPChange(i, e.target.value)}
                    onPaste={i === 0 ? handleOTPPaste : undefined}
                    style={{
                      width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
                      padding: '0', borderRadius: 10,
                      border: `2px solid ${digit ? 'var(--accent)' : 'var(--border2)'}`,
                      background: 'var(--input-bg)', color: 'var(--text)',
                    }}
                  />
                ))}
              </div>

              {/* Note: Web3Auth email connector uses magic links, not OTP codes */}
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: 'var(--accent-text)', lineHeight: 1.5 }}>
                ℹ Email code requires additional setup. Use Google or Twitter for instant access, or use the magic link option.
              </div>

              <button
                onClick={handleSocial}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
              >
                Continue with Google instead →
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setEmailFlow('idle')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Back
                </button>
                <button
                  onClick={() => { setResendTimer(30); }}
                  disabled={resendTimer > 0}
                  style={{ background: 'none', border: 'none', color: resendTimer > 0 ? 'var(--text3)' : 'var(--accent-text)', fontSize: 11, cursor: resendTimer > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          <div className="auth-divider">or use wallet</div>

          <button className="social-btn" onClick={handleWallet} disabled={isPending}>
            {connecting === 'wallet' && isPending ? '⏳ Connecting…' : '🦊 Continue with Wallet'}
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button onClick={() => { disconnect(); setConnecting(null); setEmailFlow('idle'); }}
              style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>
              Having trouble? Try a different method →
            </button>
          </div>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Join free →</Link>
        </p>
      </div>
    </>
  );
}
