'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDisconnect } from 'wagmi';
import Link from 'next/link';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { validateUsername, isUsernameTaken, registerUsername } from '@/lib/username';

export default function SettingsPage() {
  const router = useRouter();
  const { disconnect } = useDisconnect();

  const [username, setUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameHintColor, setUsernameHintColor] = useState('var(--text3)');
  const [address, setAddress] = useState('');
  const [userRank] = useState<number>(14);
  const [savedToast, setSavedToast] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const addr = localStorage.getItem('proov_address') || '';
    setAddress(addr);
    if (addr) {
      const raw = localStorage.getItem(`proov_username_${addr.toLowerCase()}`);
      if (raw) { try { setUsername(JSON.parse(raw).username || ''); } catch {} }
    }
    const fallback = localStorage.getItem('proov_username');
    if (fallback && !username) setUsername(fallback);
  }, []);

  const checkNewUsername = (val: string) => {
    setNewUsername(val);
    const clean = val.replace(/^@/, '');
    if (!clean) { setUsernameHint(''); return; }
    const { valid, message } = validateUsername(clean);
    if (!valid) { setUsernameHint(message); setUsernameHintColor('#f43f5e'); return; }
    if (isUsernameTaken(clean, address)) { setUsernameHint('Already taken'); setUsernameHintColor('#f43f5e'); return; }
    setUsernameHint('✓ Available');
    setUsernameHintColor('var(--accent)');
  };

  const saveUsername = () => {
    const clean = newUsername.replace(/^@/, '');
    const ok = registerUsername(clean, address);
    if (!ok) { setUsernameHint('Already taken'); setUsernameHintColor('#f43f5e'); return; }
    setUsername(clean);
    setEditingUsername(false);
    setNewUsername('');
    setUsernameHint('');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleSignOut = () => {
    disconnect();
    localStorage.removeItem('proov_authenticated');
    localStorage.removeItem('proov_address');
    localStorage.removeItem('proov_email');
    router.push('/');
  };

  if (!mounted) return null;

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div className="page-wrap" style={{ paddingTop: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: '1.5rem' }}>Settings</h1>

        {/* Leaderboard shortcut */}
        <Link href="/leaderboard"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 16, textDecoration: 'none', marginBottom: '1.5rem', transition: 'transform .15s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = '')}>
          <span style={{ fontSize: 32 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Leaderboard</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>You&apos;re #{userRank} globally</div>
          </div>
          <span style={{ color: 'var(--accent-text)', fontSize: 18 }}>›</span>
        </Link>

        {/* Profile */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Profile</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0 }}>
              {(username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingUsername ? (
                <div>
                  <div style={{ position: 'relative', marginBottom: 4 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>@</span>
                    <input type="text" value={newUsername} onChange={e => checkNewUsername(e.target.value)} autoFocus placeholder={username}
                      style={{ paddingLeft: 24, fontSize: 14, fontWeight: 600, padding: '7px 7px 7px 24px' }} />
                  </div>
                  {usernameHint && <p style={{ fontSize: 10, color: usernameHintColor, marginBottom: 6 }}>{usernameHint}</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveUsername} disabled={usernameHint !== '✓ Available'}
                      style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: usernameHint === '✓ Available' ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: usernameHint === '✓ Available' ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save
                    </button>
                    <button onClick={() => { setEditingUsername(false); setNewUsername(''); setUsernameHint(''); }}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>@{username || 'set a username'}</div>
                  <button onClick={() => { setEditingUsername(true); setNewUsername(''); }}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 2 }}>
                    Edit username
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Appearance */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Appearance</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '1rem', marginBottom: '1.25rem' }}>
          <ThemeToggle />
        </div>

        {/* Habits */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Habits</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <Link href="/habits" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Manage habits</span>
            <span style={{ color: 'var(--accent-text)', fontSize: 14 }}>›</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Default privacy</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Private</span>
          </div>
        </div>

        {/* Circle */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Circle</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <Link href="/circle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', textDecoration: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Manage your circle</span>
            <span style={{ color: 'var(--accent-text)', fontSize: 14 }}>›</span>
          </Link>
        </div>

        {/* Account */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Account</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '2rem' }}>
          <button onClick={handleSignOut}
            style={{ display: 'block', width: '100%', padding: '0.875rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, color: '#f43f5e', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      <div className={`toast ${savedToast ? 'show' : ''}`} style={{ background: 'var(--success)' }}>✓ Saved</div>
    </>
  );
}
