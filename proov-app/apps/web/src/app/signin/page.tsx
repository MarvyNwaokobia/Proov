'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect } from 'wagmi';
import { useTheme } from '@/components/providers/ThemeProvider';
import Link from 'next/link';
import type { ColorMode } from '@/lib/themes';
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

export default function SignInPage() {
  const router = useRouter();
  const { isConnected, address: connectedAddress } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { mode, setMode } = useTheme();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailMethod, setEmailMethod] = useState<EmailMethod>('link');
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  // Username sign-in
  const [showUsernameLogin, setShowUsernameLogin] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSearching, setUsernameSearching] = useState(false);
  const [usernameError, setUsernameError] = useState('');

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

    // Check Supabase for existing profile — returning user skips onboarding
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

  const handleUsernameLookup = async () => {
    const clean = usernameInput.replace(/^@/, '').toLowerCase().trim();
    if (!clean) return;

    setUsernameSearching(true);
    setUsernameError('');

    try {
      const { getAddressForUsername } = await import('@/lib/supabase');
      const address = await getAddressForUsername(clean);

      if (!address) {
        setUsernameError(`@${clean} not found. Check the spelling, or sign up for free.`);
        return;
      }

      // Account found — restore session and go straight to dashboard
      localStorage.setItem('proov_authenticated', 'true');
      localStorage.setItem('proov_address', address);
      localStorage.setItem('proov_username', clean);
      localStorage.setItem('proov_onboarding_done', '1');
      localStorage.setItem('proov_tutorial_done', '1');

      // Go to dashboard immediately — no extra step
      router.push('/dashboard');

    } catch {
      setUsernameError('Could not sign in right now. Try using Google or your wallet instead.');
    } finally {
      setUsernameSearching(false);
    }
  };

  const triggerConnect = async () => {
    // Wipe any cached session so Google always shows the account picker
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
    if (val && idx < 5) document.getElementById(`signin-otp-${idx + 1}`)?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      document.getElementById('signin-otp-5')?.focus();
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
        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 auto 10px' }}>P</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Good to have you back</p>
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

          {/* Username sign-in — collapsible, for returning users */}
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => { setShowUsernameLogin(v => !v); setUsernameError(''); setUsernameInput(''); }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12,
                border: '1px solid var(--border)',
                background: showUsernameLogin ? 'var(--accent-bg)' : 'transparent',
                color: showUsernameLogin ? 'var(--accent-text)' : 'var(--text2)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all .15s',
              }}
            >
              <span>Sign in with username</span>
              <span>{showUsernameLogin ? '↑' : '↓'}</span>
            </button>

            {showUsernameLogin && (
              <div style={{ marginTop: 8, padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>@</span>
                  <input
                    type="text" placeholder="yourname"
                    value={usernameInput}
                    onChange={e => { setUsernameInput(e.target.value); setUsernameError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleUsernameLookup()}
                    style={{ paddingLeft: 28, fontSize: 14, fontWeight: 600 }}
                    autoComplete="off"
                  />
                </div>

                {usernameError && (
                  <p style={{ fontSize: 12, color: '#f43f5e', marginBottom: 8, lineHeight: 1.6 }}>
                    {usernameError.includes('sign up') ? (
                      <>
                        @{usernameInput.replace('@', '')} not found. Check the spelling, or{' '}
                        <Link href="/signup" style={{ color: '#f43f5e', fontWeight: 700 }}>
                          sign up for free
                        </Link>
                        .
                      </>
                    ) : usernameError}
                  </p>
                )}

                <button
                  onClick={handleUsernameLookup}
                  disabled={usernameSearching || !usernameInput.trim()}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                    background: usernameInput.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                    color: usernameInput.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
                    fontSize: 13, fontWeight: 600,
                    cursor: usernameInput.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >
                  {usernameSearching ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            )}
          </div>

          {/* Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem' }}>

            {error && <p style={{ fontSize: 12, color: '#f43f5e', textAlign: 'center', marginBottom: '0.875rem' }}>{error}</p>}

            {/* Social */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <GoogleIcon />
                Continue with Google
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={socialBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <XIcon />
                Continue with Twitter
              </button>
              <button onClick={triggerConnect} disabled={isPending} style={{ ...socialBtnStyle, color: 'var(--text2)', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                🌐 More social options
              </button>
            </div>

            {/* Email divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0.875rem 0', fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or with email
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {!codeSent ? (
              <>
                {emailMethod === 'number' ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    style={{ marginBottom: 10 }}
                  />
                ) : (
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{ marginBottom: 10 }}
                    onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                  />
                )}

                {/* Method buttons — 3 options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
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
                  }}
                >
                  {isPending ? 'Connecting...' : emailMethod === 'link' ? 'Send magic link' : emailMethod === 'code' ? 'Send code' : 'Send SMS code'}
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
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
                  Enter the code sent to {emailMethod === 'number' ? phone : email}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1rem' }} onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`signin-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e.target.value, i)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !digit && i > 0) {
                          document.getElementById(`signin-otp-${i - 1}`)?.focus();
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

            {/* Wallet divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0.875rem 0', fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or use wallet
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Wallet connect */}
            <button onClick={() => setShowWalletPicker(true)} disabled={loading || isPending}
              style={{ ...socialBtnStyle, color: 'var(--text2)', fontSize: 13 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <WalletIcon />
              Continue with Wallet
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            No account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>
              Join free →
            </Link>
          </p>
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
