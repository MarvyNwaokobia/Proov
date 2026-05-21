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

export default function SignUpPage() {
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

  const triggerConnect = async () => {
    // Wipe cached session so Google always shows the account picker
    await clearWeb3AuthSession();
    try {
      const { getWeb3Auth } = await import('@/lib/wagmi-config');
      await getWeb3Auth().logout({ cleanup: true });
    } catch {}
    const c = connectors[0];
    if (c) connect({ connector: c });
  };

  const handleSpecificWallet = async (wallet: 'metamask' | 'valora' | 'coinbase' | 'walletconnect') => {
    setLoading(true);
    setError('');
    try {
      // MiniPay auto-connect takes priority regardless of chosen wallet
      const { isMiniPay } = await import('@/lib/minipay');
      if (isMiniPay()) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        const addr = accounts[0];
        localStorage.setItem('proov_authenticated', 'true');
        localStorage.setItem('proov_address', addr);
        router.push(getPostLoginRoute());
        return;
      }

      let address = '';

      if (wallet === 'metamask' || wallet === 'coinbase') {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
          address = accounts[0];
        } else {
          setError('No wallet found. Install MetaMask at metamask.io');
          setLoading(false);
          return;
        }
      } else {
        // Valora / WalletConnect — fall back to wagmi injected connector
        const c = connectors[1] ?? connectors[0];
        if (c) connect({ connector: c });
        setLoading(false);
        return;
      }

      if (!address) { setError('Could not get wallet address. Try again.'); setLoading(false); return; }

      const { getUsernameForAddress } = await import('@/lib/supabase');
      const existing = await getUsernameForAddress(address).catch(() => null);
      localStorage.setItem('proov_authenticated', 'true');
      localStorage.setItem('proov_address', address);
      if (existing) {
        localStorage.setItem('proov_username', existing);
        localStorage.setItem('proov_tutorial_done', '1');
        router.push('/dashboard');
      } else {
        localStorage.setItem('proov_is_new_user', 'true');
        router.push('/username-setup');
      }
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>Start your streak</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Free. No card needed.</p>
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

      {/* Wallet picker modal */}
      {showWalletPicker && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, padding: '0 1rem 1rem' }}
          onClick={() => setShowWalletPicker(false)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Connect a wallet</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' }}>Choose how you want to connect</div>

            {[
              { id: 'metamask' as const,      label: 'MetaMask',        icon: <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" width={28} height={28} alt="MetaMask" /> },
              { id: 'valora' as const,         label: 'Valora',          icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #35D07F, #FBCC5C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>V</div> },
              { id: 'coinbase' as const,       label: 'Coinbase Wallet', icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>CB</div> },
              { id: 'walletconnect' as const,  label: 'Other wallets',   icon: <div style={{ width: 28, height: 28, borderRadius: 8, background: '#3B99FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>WC</div> },
            ].map(({ id, label, icon }) => (
              <button key={id}
                onClick={() => { setShowWalletPicker(false); handleSpecificWallet(id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, transition: 'all .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {icon}{label}
              </button>
            ))}

            <button
              onClick={() => setShowWalletPicker(false)}
              style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
