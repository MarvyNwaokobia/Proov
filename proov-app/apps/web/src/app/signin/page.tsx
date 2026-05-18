'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useDisconnect } from 'wagmi';
import { hasWeb3AuthClientId } from '@/lib/wagmi-config';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connecting, setConnecting] = useState<'social' | 'wallet' | null>(null);

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

  return (
    <>
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
      </div>
      <div className="top-bar" />

      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1.25rem', position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:'1.5rem', textAlign:'center' }}>
          <div style={{ width:42,height:42,borderRadius:11,background:'linear-gradient(135deg,var(--accent),var(--accent2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:18,color:'#fff',margin:'0 auto 12px' }}>P</div>
          <h1 style={{ fontSize:22,fontWeight:700,color:'var(--text)',letterSpacing:'-.5px',marginBottom:4 }}>Welcome back</h1>
          <p style={{ fontSize:13,color:'var(--text2)' }}>Pick up where you left off</p>
        </div>

        <div className="auth-card">
          {!hasWeb3AuthClientId && (
            <div style={{ background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:10,padding:'10px 14px',marginBottom:'1rem',fontSize:12,color:'var(--accent-text)' }}>
              ⚠ Add NEXT_PUBLIC_WEB3AUTH_CLIENT_ID to .env.local
            </div>
          )}

          <button className="social-btn" onClick={handleSocial} disabled={!hasWeb3AuthClientId || isPending}>
            {connecting === 'social' && isPending ? '⏳ Connecting…' : '✉ Continue with Email or Social'}
          </button>

          <div className="auth-divider">or use wallet</div>

          <button className="social-btn" onClick={handleWallet} disabled={isPending}>
            {connecting === 'wallet' && isPending ? '⏳ Connecting…' : '🦊 Continue with Wallet'}
          </button>

          <div style={{ marginTop:'1rem', textAlign:'center' }}>
            <button
              onClick={() => { disconnect(); setConnecting(null); }}
              style={{ background:'none',border:'none',fontSize:11,color:'var(--text3)',cursor:'pointer' }}
            >
              Having trouble? Try a different method →
            </button>
          </div>
        </div>

        <p style={{ marginTop:'1.25rem',fontSize:12,color:'var(--text3)',textAlign:'center' }}>
          No account?{' '}
          <Link href="/signup" style={{ color:'var(--accent)',textDecoration:'none',fontWeight:600 }}>Join free →</Link>
        </p>
      </div>
    </>
  );
}
