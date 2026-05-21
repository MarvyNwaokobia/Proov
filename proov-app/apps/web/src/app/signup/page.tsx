'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import Link from 'next/link';
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

const WalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M16 12h.01"/>
    <path d="M2 10h20"/>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showMoreSocial, setShowMoreSocial] = useState(false);

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
    const emailVal = localStorage.getItem('proov_email') || '';
    resolveIdentity(connectedAddress, emailVal, 'google', 'web3auth');

    import('@/lib/supabase').then(({ getUsernameForAddress }) =>
      getUsernameForAddress(connectedAddress)
    ).then(existingUsername => {
      if (existingUsername) {
        localStorage.setItem('proov_username', existingUsername);
        localStorage.setItem('proov_tutorial_done', '1');
        router.push('/dashboard');
      } else {
        router.push(getPostLoginRoute());
      }
    }).catch(() => {
      router.push(getPostLoginRoute());
    });
  }, [isConnected, connectedAddress, router]);

  const triggerConnect = async () => {
    await clearWeb3AuthSession();
    try {
      const { getWeb3Auth } = await import('@/lib/wagmi-config');
      await getWeb3Auth().logout({ cleanup: true });
    } catch {}
    const c = connectors[0];
    if (c) connect({ connector: c });
  };

  const finishWalletLogin = async (address: string) => {
    const { getUsernameForAddress } = await import('@/lib/supabase');
    const existingUsername = await getUsernameForAddress(address);
    localStorage.setItem('proov_authenticated', 'true');
    localStorage.setItem('proov_address', address);
    if (existingUsername) {
      localStorage.setItem('proov_username', existingUsername);
      localStorage.setItem('proov_onboarding_done', '1');
      localStorage.setItem('proov_tutorial_done', '1');
      router.push('/dashboard');
    } else {
      localStorage.setItem('proov_is_new_user', 'true');
      router.push('/username-setup');
    }
  };

  const handleSpecificWallet = async (wallet: 'metamask' | 'valora' | 'coinbase' | 'walletconnect') => {
    setLoading(true);
    setError('');
    try {
      let address = '';

      if (wallet === 'metamask') {
        const eth = (window as any).ethereum;
        if (eth && eth.isMetaMask) {
          const accounts = await eth.request({ method: 'eth_requestAccounts' });
          address = accounts[0];
        } else if (eth && eth.providers) {
          const mm = eth.providers.find((p: any) => p.isMetaMask);
          if (mm) {
            const accounts = await mm.request({ method: 'eth_requestAccounts' });
            address = accounts[0];
          } else {
            window.open('https://metamask.io/download/', '_blank');
            setError('MetaMask not installed. Install it and try again.');
            setLoading(false);
            return;
          }
        } else {
          window.open('https://metamask.io/download/', '_blank');
          setError('MetaMask not installed. Install it and try again.');
          setLoading(false);
          return;
        }
      }

      else if (wallet === 'coinbase') {
        const eth = (window as any).ethereum;
        if (eth && eth.isCoinbaseWallet) {
          const accounts = await eth.request({ method: 'eth_requestAccounts' });
          address = accounts[0];
        } else if (eth && eth.providers) {
          const cb = eth.providers.find((p: any) => p.isCoinbaseWallet);
          if (cb) {
            const accounts = await cb.request({ method: 'eth_requestAccounts' });
            address = accounts[0];
          } else {
            const accounts = await eth.request({ method: 'eth_requestAccounts' });
            address = accounts[0];
          }
        } else if (eth) {
          const accounts = await eth.request({ method: 'eth_requestAccounts' });
          address = accounts[0];
        } else {
          window.open('https://www.coinbase.com/wallet/downloads', '_blank');
          setError('Coinbase Wallet not found.');
          setLoading(false);
          return;
        }
      }

      else if (wallet === 'valora') {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = 'celo://wallet';
          setTimeout(() => {
            const c = connectors[1] ?? connectors[0];
            if (c) connect({ connector: c });
            setLoading(false);
          }, 2000);
          return;
        } else {
          const c = connectors[1] ?? connectors[0];
          if (c) connect({ connector: c });
          setLoading(false);
          return;
        }
      }

      else if (wallet === 'walletconnect') {
        const c = connectors[1] ?? connectors[0];
        if (c) connect({ connector: c });
        setLoading(false);
        return;
      }

      if (!address) {
        setError('Could not get wallet address. Try again.');
        setLoading(false);
        return;
      }

      await finishWalletLogin(address);

    } catch (e: any) {
      if (e?.code === 4001) { setError(''); } else { setError(e?.message || 'Wallet connection failed.'); }
    } finally {
      setLoading(false);
    }
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

  const tabRowStyle: React.CSSProperties = {
    display: 'flex',
    background: 'var(--bg2)',
    borderRadius: 10,
    padding: 3,
    marginBottom: '1.25rem',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    padding: '7px 0',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    borderRadius: 8,
    color: active ? 'var(--text)' : 'var(--text3)',
    background: active ? 'var(--card-bg)' : 'transparent',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
    transition: 'all 0.15s ease',
    border: 'none',
    fontFamily: 'inherit',
  });

  const socialCardStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  };

  const socialBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border2)',
    background: 'var(--card-bg)',
    color: 'var(--text)',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 7,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
    boxSizing: 'border-box' as const,
  };

  const moreToggleStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg3)',
    color: 'var(--text2)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  };

  const chipRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  };

  const chipStyle: React.CSSProperties = {
    flex: 1,
    padding: '7px 6px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card-bg)',
    fontSize: 11,
    color: 'var(--text2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const walletBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: '1.5px solid var(--accent)',
    background: 'transparent',
    color: 'var(--accent-text)',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    transition: 'all 0.15s ease',
    marginBottom: 10,
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
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.25rem 3rem', position: 'relative', zIndex: 1, background: 'var(--bg)' }}>

        {/* Logo */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 auto 10px' }}>P</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome to Proov</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Take accountability for your habits</p>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Tab switcher */}
          <div style={tabRowStyle}>
            <button style={tabStyle(false)} onClick={() => router.push('/signin')}>Sign in</button>
            <button style={tabStyle(true)}>Join free</button>
          </div>

          {/* Social card */}
          <div style={socialCardStyle}>
            {error && <p style={{ fontSize: 12, color: '#f43f5e', marginBottom: 8 }}>{error}</p>}

            <button
              style={socialBtnStyle}
              onClick={triggerConnect}
              disabled={isPending}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}
            >
              <GoogleIcon />
              Join with Google
            </button>

            <button
              style={socialBtnStyle}
              onClick={triggerConnect}
              disabled={isPending}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}
            >
              <XIcon />
              Join with Twitter
            </button>

            <button
              style={moreToggleStyle}
              onClick={() => setShowMoreSocial(v => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              More social options
              <span style={{ marginLeft: 'auto', fontSize: 11 }}>{showMoreSocial ? '↑' : '↓'}</span>
            </button>

            {showMoreSocial && (
              <div style={chipRowStyle}>
                <button style={chipStyle} onClick={triggerConnect}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
                <button style={chipStyle} onClick={triggerConnect}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  Discord
                </button>
                <button style={chipStyle} onClick={triggerConnect}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                  Reddit
                </button>
              </div>
            )}
          </div>

          {/* Email section */}
          {!codeSent ? (
            <div style={{ marginBottom: 10 }}>
              {emailMethod === 'number' ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{ marginBottom: 8, width: '100%', boxSizing: 'border-box' }}
                />
              ) : (
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ marginBottom: 8, width: '100%', boxSizing: 'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
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
                  marginBottom: 10,
                }}
              >
                {isPending ? 'Connecting...' : emailMethod === 'link' ? 'Send magic link' : emailMethod === 'code' ? 'Send code' : 'Send SMS code'}
              </button>
            </div>
          ) : emailMethod === 'link' ? (
            <div style={{ textAlign: 'center', padding: '1rem 0', marginBottom: 10 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Check your inbox</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>We sent a link to {email}</p>
              <button onClick={() => setCodeSent(false)} style={{ marginTop: 14, background: 'none', border: 'none', fontSize: 12, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Try a different method
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
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

          {/* Wallet button */}
          <button
            style={walletBtnStyle}
            onClick={() => setShowWalletPicker(true)}
            disabled={loading || isPending}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <WalletIcon />
            Continue with Wallet
          </button>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
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

      {/* Wallet picker bottom sheet */}
      {showWalletPicker && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowWalletPicker(false)}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '24px 24px 0 0',
              padding: 'calc(1.5rem + env(safe-area-inset-bottom)) 1.25rem 1.5rem',
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.25s cubic-bezier(.34,1.56,.64,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 1.25rem' }} />

            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Connect a wallet</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem' }}>Choose your wallet to continue</div>

            {[
              { id: 'metamask' as const,     label: 'MetaMask',        icon: <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" width={28} height={28} alt="MetaMask" style={{ borderRadius: 6 }} /> },
              { id: 'valora' as const,        label: 'Valora',          icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#35D07F,#FBCC5C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>V</div> },
              { id: 'coinbase' as const,      label: 'Coinbase Wallet', icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>CB</div> },
              { id: 'walletconnect' as const, label: 'Other wallets',   icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: '#3B99FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>WC</div> },
            ].map(wallet => (
              <button
                key={wallet.id}
                onClick={() => { setShowWalletPicker(false); handleSpecificWallet(wallet.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '13px 14px',
                  borderRadius: 14, border: '1px solid var(--border)',
                  background: 'var(--card-bg)', color: 'var(--text)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit', marginBottom: 8,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg3)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.transform = '';
                }}
              >
                {wallet.icon}
                <span>{wallet.label}</span>
              </button>
            ))}

            <button
              onClick={() => setShowWalletPicker(false)}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 14, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text3)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', marginTop: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
