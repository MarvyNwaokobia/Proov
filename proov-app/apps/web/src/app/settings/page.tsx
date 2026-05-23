'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDisconnect } from 'wagmi';
import Link from 'next/link';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { validateUsername, isUsernameTaken, registerUsername } from '@/lib/username';
import { setIdentityUsername } from '@/lib/auth';
import { updateUsername as updateSupabaseUsername } from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';
import {
  IconTrophy,
  IconChevronRight,
  IconLogout,
  IconBolt,
} from '@tabler/icons-react';

export default function SettingsPage() {
  const router = useRouter();
  const { disconnect } = useDisconnect();

  const proovTx = useProovTx();
  const [username, setUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameHintColor, setUsernameHintColor] = useState('var(--text3)');
  const [address, setAddress] = useState('');
  const [userRank] = useState<number>(14);
  const [savedToast, setSavedToast] = useState(false);
  // copied state removed (wallet section removed)
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
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
    if (username) {
      setShowUsernameConfirm(true);
    } else {
      confirmedSaveUsername();
    }
  };

  const confirmedSaveUsername = async () => {
    const clean = newUsername.replace(/^@/, '').toLowerCase();
    setShowUsernameConfirm(false);

    try {
      const result = await updateSupabaseUsername(address, clean);
      if (!result.success) {
        setUsernameHint(result.error || 'Could not save');
        setUsernameHintColor('#f43f5e');
        return;
      }
    } catch {
      console.warn('Supabase unavailable — saving locally only');
    }

    // Always update localStorage
    registerUsername(clean, address);
    localStorage.setItem('proov_username', clean);
    setIdentityUsername(address, clean);

    proovTx.editUsername(clean);
    setUsername(clean);
    setEditingUsername(false);
    setNewUsername('');
    setUsernameHint('');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleSignOut = async () => {
    // Always attempt Web3Auth logout — don't check .connected which may lag
    try {
      const { getWeb3Auth } = await import('@/lib/wagmi-config');
      await getWeb3Auth().logout({ cleanup: true });
    } catch {}
    // Disconnect wagmi
    disconnect();
    // Clear our app auth flags
    localStorage.removeItem('proov_authenticated');
    localStorage.removeItem('proov_address');
    localStorage.removeItem('proov_email');
    // Wipe ALL Web3Auth / OpenLogin session storage (localStorage + sessionStorage + IndexedDB)
    const { clearWeb3AuthSession } = await import('@/lib/clearSession');
    await clearWeb3AuthSession();
    window.location.href = '/';
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
          <IconTrophy size={28} stroke={1.5} color="var(--accent-text)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Leaderboard</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>You&apos;re #{userRank} globally</div>
          </div>
          <IconChevronRight size={16} stroke={2} color="var(--text3)" />
        </Link>

        {/* Profile */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Profile</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0 }}>
              {(username || 'P').slice(0, 1).toUpperCase()}
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
                      Save username
                    </button>
                    <button onClick={() => { setEditingUsername(false); setNewUsername(''); setUsernameHint(''); }}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    {username ? `@${username}` : 'Set your name'}
                  </div>
                  <button onClick={() => { setEditingUsername(true); setNewUsername(''); }}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 2 }}>
                    {username ? 'Edit username' : 'Pick a username →'}
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
            <IconChevronRight size={16} stroke={2} color="var(--text3)" />
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
            <IconChevronRight size={16} stroke={2} color="var(--text3)" />
          </Link>
        </div>

        {/* Fuel */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Fuel</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconBolt size={18} stroke={2} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Daily fuel</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>Claim your free fuel once a day from the dashboard.</div>
            </div>
          </div>
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', textDecoration: 'none' }}>
            Go to dashboard <IconChevronRight size={13} stroke={2} />
          </Link>
        </div>

        {/* Account */}
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.625rem' }}>Account</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden', marginBottom: '2rem' }}>
          <button onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '0.875rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, color: '#f43f5e', cursor: 'pointer', fontFamily: 'inherit' }}>
            <IconLogout size={16} stroke={2} /> Sign out
          </button>
        </div>
      </div>

      <div className={`toast ${savedToast ? 'show' : ''}`} style={{ background: 'var(--success)' }}>✓ Saved</div>

      {/* Username change confirm modal */}
      {showUsernameConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 1rem 1.5rem' }}
          onClick={() => setShowUsernameConfirm(false)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Change username?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Your username will change from{' '}
              <strong style={{ color: 'var(--text)' }}>@{username}</strong> to{' '}
              <strong style={{ color: 'var(--text)' }}>@{newUsername.replace(/^@/, '')}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowUsernameConfirm(false)}
                style={{ padding: 11, borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={confirmedSaveUsername}
                style={{ padding: 11, borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
