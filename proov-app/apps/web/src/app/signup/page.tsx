'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { hasWeb3AuthClientId } from '@/lib/wagmi-config';
import Link from 'next/link';

type EmailMethod = 'magic' | 'code';

export default function SignUpPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailMethod, setEmailMethod] = useState<EmailMethod>('magic');
  const [sent, setSent] = useState(false);

  useEffect(() => { if (isConnected) router.replace('/dashboard'); }, [isConnected, router]);
  useEffect(() => { if (!isPending) setConnecting(null); }, [isPending]);

  const connect0 = (label: string) => {
    const c = connectors[0];
    if (c) { setConnecting(label); connect({ connector: c }); }
  };
  const connectWallet = () => {
    const c = connectors[1] ?? connectors[0];
    if (c) { setConnecting('wallet'); connect({ connector: c }); }
  };

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>
        <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),var(--accent2,var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff', margin: '0 auto 10px' }}>P</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Start your streak</h1>
          <p style={{ fontSize: 12, color: 'var(--text2)' }}>Free forever. No card needed.</p>
        </div>
        <div className="auth-card" style={{ maxWidth: 380, width: '100%' }}>
          {!hasWeb3AuthClientId && (
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '8px 12px', marginBottom: '0.875rem', fontSize: 11, color: 'var(--accent-text)' }}>
              ⚠ Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local
            </div>
          )}
          <button className="social-btn" onClick={() => connect0('google')} disabled={isPending}>
            {connecting === 'google' && isPending ? '⏳…' : '🔵 Join with Google'}
          </button>
          <button className="social-btn" onClick={() => connect0('twitter')} disabled={isPending}>
            {connecting === 'twitter' && isPending ? '⏳…' : '𝕏 Join with Twitter'}
          </button>
          <button className="social-btn" onClick={() => connect0('social')} disabled={!hasWeb3AuthClientId || isPending}>
            {connecting === 'social' && isPending ? '⏳…' : '✉ Join with social'}
          </button>
          <div className="auth-divider">or with email</div>
          {!sent ? (
            <>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: '0.875rem' }}>
                {([{ id: 'magic' as const, emoji: '✉️', label: 'Magic link' }, { id: 'code' as const, emoji: '🔢', label: 'Code' }] as const).map(m => (
                  <button key={m.id} onClick={() => setEmailMethod(m.id)} style={{ padding: '8px', borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', border: `1px solid ${emailMethod === m.id ? 'var(--accent)' : 'var(--border)'}`, background: emailMethod === m.id ? 'var(--accent-bg)' : 'var(--bg3)', color: emailMethod === m.id ? 'var(--accent-text)' : 'var(--text3)' }}>{m.emoji} {m.label}</button>
                ))}
              </div>
              <button onClick={() => { connect0('email'); setSent(true); }} disabled={!email.trim() || isPending} style={{ width: '100%', padding: 11, borderRadius: 12, border: 'none', marginBottom: 8, background: email.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: email.trim() ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: email.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {emailMethod === 'magic' ? 'Send magic link' : 'Send 6-digit code'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📨</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Check your inbox</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>Sent a link to <strong>{email}</strong></p>
              <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Use a different email</button>
            </div>
          )}
          <div className="auth-divider">or use wallet</div>
          <button className="social-btn" onClick={connectWallet} disabled={isPending}>
            {connecting === 'wallet' && isPending ? '⏳ Connecting…' : '🦊 Continue with Wallet'}
          </button>
          <p style={{ marginTop: '1rem', fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>By joining you agree to our Terms and Privacy</p>
        </div>
        <p style={{ marginTop: '1.25rem', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}>Sign in →</Link>
        </p>
      </div>
    </>
  );
}
