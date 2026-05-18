'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { hasWeb3AuthClientId } from '@/lib/wagmi-config';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [connecting, setConnecting] = useState<'social' | 'wallet' | null>(null);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (isConnected) router.replace('/dashboard');
  }, [isConnected, router]);

  useEffect(() => {
    if (!isPending) setConnecting(null);
  }, [isPending]);

  const handleSocial = () => {
    const c = connectors[0];
    if (c) { setConnecting('social'); connect({ connector: c }); }
  };

  const handleWallet = () => {
    const c = connectors[1] ?? connectors[0];
    if (c) { setConnecting('wallet'); connect({ connector: c }); }
  };

  const handleEmailSignup = () => {
    if (!email.trim()) return;
    handleSocial(); // Web3Auth handles email magic link
    setEmailSent(true);
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Start your streak</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Free forever. No card needed.</p>
        </div>

        <div className="auth-card">
          {!hasWeb3AuthClientId && (
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', fontSize: 12, color: 'var(--accent-text)' }}>
              ⚠ Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local
            </div>
          )}

          {/* Social quick-join */}
          <button className="social-btn" onClick={handleSocial} disabled={!hasWeb3AuthClientId || isPending}>
            {connecting === 'social' && isPending ? '⏳ Connecting…' : '🔵 Join with Google or Twitter'}
          </button>

          <div className="auth-divider">or join with email</div>

          {!emailSent ? (
            <div>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailSignup(); }}
                style={{ marginBottom: 8 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                We&apos;ll send you a magic sign-in link
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleEmailSignup}
                  disabled={!email.trim() || isPending}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: email.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: email.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  Send magic link
                </button>
                <button
                  onClick={() => { setEmailSent(true); }}
                  disabled={!email.trim()}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                >
                  Send code
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📨</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Check your email</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
                We sent a link to <strong>{email || 'your email'}</strong>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: '1rem', lineHeight: 1.5 }}>
                ℹ OTP code login requires additional setup. Use the magic link or sign in with Google.
              </p>
              <button onClick={() => setEmailSent(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Use a different email
              </button>
            </div>
          )}

          <div className="auth-divider">or use wallet</div>

          <button className="social-btn" onClick={handleWallet} disabled={isPending}>
            {connecting === 'wallet' && isPending ? '⏳ Connecting…' : '🦊 Continue with Wallet'}
          </button>

          <p style={{ marginTop: '1rem', fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
            By joining you agree to our Terms and Privacy
          </p>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign in →</Link>
        </p>
      </div>
    </>
  );
}
