'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { hasWeb3AuthClientId } from '@/lib/wagmi-config';
import { useTheme } from '@/components/providers/ThemeProvider';
import Link from 'next/link';
import type { ColorMode } from '@/lib/themes';

type EmailMethod = 'magic' | 'code' | 'number';
type SigninStep = 'main' | 'magic-sent' | 'otp' | 'number-info';

export default function SignInPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { mode, setMode } = useTheme();

  const [connecting, setConnecting] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailMethod, setEmailMethod] = useState<EmailMethod>('magic');
  const [step, setStep] = useState<SigninStep>('main');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [focused, setFocused] = useState(0);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (isConnected) router.replace('/dashboard'); }, [isConnected, router]);
  useEffect(() => { if (!isPending) setConnecting(null); }, [isPending]);
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const connect0 = (label: string) => {
    const c = connectors[0];
    if (c) { setConnecting(label); connect({ connector: c }); }
  };
  const connectWallet = () => {
    const c = connectors[1] ?? connectors[0];
    if (c) { setConnecting('wallet'); connect({ connector: c }); }
  };

  const handleEmailAction = () => {
    if (!email.trim()) return;
    if (emailMethod === 'magic') { connect0('magic'); setStep('magic-sent'); }
    else if (emailMethod === 'code') { setStep('otp'); setResendTimer(30); }
    else { setStep('number-info'); }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) { otpRefs.current[i + 1]?.focus(); setFocused(i + 1); }
    if (next.every(d => d) && v) connect0('otp');
  };
  const handleOtpKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) { otpRefs.current[i - 1]?.focus(); setFocused(i - 1); }
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
    if (digits.length === 6) connect0('otp');
  };

  const MODES: { value: ColorMode; label: string; emoji: string }[] = [
    { value: 'light',  label: 'Light', emoji: '☀️' },
    { value: 'dark',   label: 'Dark',  emoji: '🌙' },
    { value: 'system', label: 'Auto',  emoji: '⚙️' },
  ];

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),var(--accent2,var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff', margin: '0 auto 10px' }}>P</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Welcome back</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>Pick up where you left off</p>
        </div>

        <div className="auth-card" style={{ maxWidth: 380, width: '100%' }}>
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: '1rem' }}>
            {MODES.map(m => (
              <button key={m.value} onClick={() => setMode(m.value)} style={{
                padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${mode === m.value ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === m.value ? 'var(--accent-bg)' : 'transparent',
                color: mode === m.value ? 'var(--accent-text)' : 'var(--text3)', transition: 'all .15s',
              }}>{m.emoji} {m.label}</button>
            ))}
          </div>

          {!hasWeb3AuthClientId && (
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '8px 12px', marginBottom: '0.875rem', fontSize: 11, color: 'var(--accent-text)' }}>
              ⚠ Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local
            </div>
          )}

          {step === 'main' && <>
            <button className="social-btn" onClick={() => connect0('google')} disabled={isPending}>
              {connecting === 'google' && isPending ? '⏳…' : '🔵 Continue with Google'}
            </button>
            <button className="social-btn" onClick={() => connect0('twitter')} disabled={isPending}>
              {connecting === 'twitter' && isPending ? '⏳…' : '𝕏 Continue with Twitter'}
            </button>
            <button className="social-btn" onClick={() => connect0('social')} disabled={!hasWeb3AuthClientId || isPending}>
              {connecting === 'social' && isPending ? '⏳…' : '✉ Continue with social'}
            </button>
            <div className="auth-divider">or with email</div>
            <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailAction()} style={{ marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: '0.875rem' }}>
              {([{ id: 'magic' as const, emoji: '✉️', label: 'Magic link' }, { id: 'code' as const, emoji: '🔢', label: 'Code' }, { id: 'number' as const, emoji: '📱', label: 'Number' }]).map(m => (
                <button key={m.id} onClick={() => setEmailMethod(m.id)} style={{
                  padding: '8px 4px', borderRadius: 10, fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                  border: `1px solid ${emailMethod === m.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: emailMethod === m.id ? 'var(--accent-bg)' : 'var(--bg3)',
                  color: emailMethod === m.id ? 'var(--accent-text)' : 'var(--text3)',
                }}>{m.emoji}<br />{m.label}</button>
              ))}
            </div>
            <button onClick={handleEmailAction} disabled={!email.trim() || isPending} style={{
              width: '100%', padding: 11, borderRadius: 12, border: 'none', marginBottom: 8,
              background: email.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
              color: email.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
              fontSize: 13, fontWeight: 600, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              {emailMethod === 'magic' ? 'Send magic link' : emailMethod === 'code' ? 'Send 6-digit code' : 'Use phone number'}
            </button>
            <div className="auth-divider">or use wallet</div>
            <button className="social-btn" onClick={connectWallet} disabled={isPending}>
              {connecting === 'wallet' && isPending ? '⏳ Connecting…' : '🦊 Continue with Wallet'}
            </button>
            <div style={{ marginTop: '0.875rem', textAlign: 'center' }}>
              <button onClick={() => { disconnect(); setConnecting(null); }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Having trouble? Try a different method →
              </button>
            </div>
          </>}

          {step === 'magic-sent' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📨</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Check your inbox</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>We sent a sign-in link to <strong>{email}</strong></p>
              <button onClick={() => setStep('main')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Try a different method</button>
            </div>
          )}

          {step === 'otp' && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Enter the 6-digit code</p>
              <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: '1rem' }}>Sent to {email}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1rem' }}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpChange(e, i)} onKeyDown={e => handleOtpKey(e, i)}
                    onPaste={i === 0 ? handleOtpPaste : undefined} onFocus={() => setFocused(i)}
                    style={{ width: 44, height: 52, padding: 0, textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 10, border: `2px solid ${focused === i ? 'var(--accent)' : digit ? 'var(--accent-border)' : 'var(--border2)'}`, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit' }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginBottom: 10, lineHeight: 1.5 }}>
                ℹ Email code requires additional backend setup. Use Google or magic link for instant access.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setStep('main')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button onClick={() => setResendTimer(30)} disabled={resendTimer > 0} style={{ background: 'none', border: 'none', fontSize: 12, color: resendTimer > 0 ? 'var(--text3)' : 'var(--accent-text)', cursor: resendTimer > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {step === 'number-info' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📱</div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Cross-device sign-in</p>
              <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1rem' }}>
                Uses Google's cross-device authentication. Sign in with Google first, then approve future sign-ins from your phone.
              </p>
              <button onClick={() => connect0('google')} style={{ width: '100%', padding: 11, borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>Continue with Google</button>
              <button onClick={() => setStep('main')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
            </div>
          )}
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}>Join free →</Link>
        </p>
      </div>
    </>
  );
}
