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
  IconUser,
} from '@tabler/icons-react';

function fmtCountdown(secs: number): string {
  if (secs <= 0) return 'Claimable now';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `Next in ${h}h ${m > 0 ? ` ${m}m` : ''}`;
  return `Next in ${m}m`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { disconnect } = useDisconnect();

  const proovTx = useProovTx();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameHintColor, setUsernameHintColor] = useState('var(--text3)');
  const [address, setAddress] = useState('');
  const [userRank, setUserRank] = useState<number | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  // copied state removed (wallet section removed)
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [celoBalance, setCeloBalance] = useState(0);
  const [canClaimFuel, setCanClaimFuel] = useState(false);
  const [secondsUntilClaim, setSecondsUntilClaim] = useState(0);
  const [claimingFuel, setClaimingFuel] = useState(false);

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
    const rank = parseInt(localStorage.getItem('proov_leaderboard_rank') || '0');
    if (rank > 0) setUserRank(rank);
    const storedEmail = localStorage.getItem('proov_email') || '';
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    const checkFuel = async () => {
      const { checkCanClaim, getUserCeloBalance } = await import('@/lib/fuel');
      const [claimStatus, balance] = await Promise.all([
        checkCanClaim(addr),
        getUserCeloBalance(addr),
      ]);
      setCanClaimFuel(claimStatus.canClaim);
      setSecondsUntilClaim(claimStatus.secondsLeft);
      setCeloBalance(balance);
    };
    checkFuel();
    const interval = setInterval(checkFuel, 60000);
    return () => clearInterval(interval);
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

  const handleClaimFuel = async () => {
    if (!canClaimFuel || claimingFuel) return;
    setClaimingFuel(true);
    const { claimFuel, getUserCeloBalance } = await import('@/lib/fuel');
    const result = await claimFuel();
    if (result.success) {
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
      setCanClaimFuel(false);
      setSecondsUntilClaim(86400);
      const addr = localStorage.getItem('proov_address') || '';
      const newBalance = await getUserCeloBalance(addr);
      setCeloBalance(newBalance);
    }
    setClaimingFuel(false);
  };

  if (!mounted) return null;

  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 8,
  };
  const listRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', padding: '13px 0',
    borderBottom: '1px solid var(--border)', cursor: 'pointer', textDecoration: 'none',
  };

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />

      <div className="page-wrap" style={{ paddingTop: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: '1.5rem' }}>Settings</h1>

        {/* ── My Account ── */}
        <p style={sectionLabel}>My Account</p>

        {/* Profile row */}
        <Link href="/profile" style={listRow}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 14, color: 'var(--btn-primary-text)',
            flexShrink: 0, marginRight: 12,
          }}>
            {(username || 'P').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {username ? `@${username}` : 'Set username'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>View profile</div>
          </div>
          <IconChevronRight size={16} stroke={2} color="var(--text3)" />
        </Link>

        {/* Leaderboard row */}
        <Link href="/leaderboard" style={{ ...listRow, borderBottom: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginRight: 12, color: 'var(--accent-text)',
          }}>
            <IconTrophy size={16} stroke={1.5} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Leaderboard</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {userRank ? `You're ranked #${userRank} globally` : 'See how you rank globally'}
            </div>
          </div>
          <IconChevronRight size={16} stroke={2} color="var(--text3)" />
        </Link>

        {/* ── Account Details ── */}
        <p style={{ ...sectionLabel, marginTop: 16 }}>Account Details</p>

        {/* Username row */}
        <div
          onClick={() => { setEditingUsername(true); setNewUsername(''); setUsernameHint(''); }}
          style={listRow}
        >
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Username</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>
            {username ? `@${username}` : 'Not set'}
          </span>
          <IconChevronRight size={14} stroke={2} color="var(--text3)" />
        </div>

        {/* Inline username edit — expands below the row */}
        {editingUsername && (
          <div style={{ padding: '12px 0 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>@</span>
              <input
                type="text"
                value={newUsername}
                onChange={e => checkNewUsername(e.target.value)}
                autoFocus
                placeholder={username || 'username'}
                style={{ paddingLeft: 26, fontSize: 14, fontWeight: 600 }}
              />
            </div>
            {usernameHint && <p style={{ fontSize: 10, color: usernameHintColor, marginBottom: 8 }}>{usernameHint}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={saveUsername}
                disabled={usernameHint !== '✓ Available'}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: usernameHint === '✓ Available' ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                  color: usernameHint === '✓ Available' ? 'var(--btn-primary-text)' : 'var(--text3)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setEditingUsername(false); setNewUsername(''); setUsernameHint(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Email row */}
        <div style={{ ...listRow, borderBottom: 'none', cursor: 'default' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Email</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>
            {email || '—'}
          </span>
          <IconChevronRight size={14} stroke={2} color="var(--text3)" />
        </div>

        {/* ── Appearance ── */}
        <p style={{ ...sectionLabel, marginTop: 16 }}>Appearance</p>
        <div style={{ marginBottom: 4 }}>
          <ThemeToggle />
        </div>

        {/* ── Fuel ── */}
        <p style={{ ...sectionLabel, marginTop: 16 }}>Fuel</p>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 14, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Balance</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconBolt size={14} stroke={2} color="var(--accent-text)" />
              {Math.floor(celoBalance)} Fuel
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Daily Fuel</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: canClaimFuel ? 'var(--accent-text)' : 'var(--text3)' }}>
              {canClaimFuel ? 'Claimable now' : fmtCountdown(secondsUntilClaim)}
            </span>
          </div>
          <button
            onClick={handleClaimFuel}
            disabled={!canClaimFuel || claimingFuel}
            style={{
              width: '100%', padding: 12, borderRadius: 12, border: 'none',
              background: canClaimFuel ? 'var(--btn-primary-bg)' : 'var(--bg3)',
              color: canClaimFuel ? 'var(--btn-primary-text)' : 'var(--text3)',
              fontSize: 13, fontWeight: 700,
              cursor: canClaimFuel && !claimingFuel ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: claimingFuel ? 0.7 : 1,
            }}
          >
            <IconBolt size={14} stroke={2} />
            {claimingFuel ? 'Claiming…' : 'Claim Daily Fuel'}
          </button>
        </div>

        {/* ── Notifications ── */}
        <p style={{ ...sectionLabel, marginTop: 16 }}>Notifications</p>
        {([
          ['Daily reminder', '9:00 AM'],
          ['Streak alerts', 'On'],
          ['Circle activity', 'On'],
        ] as [string, string][]).map(([label, value], i, arr) => (
          <div key={label} style={{ ...listRow, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--accent-text)', fontWeight: 600, marginRight: 8 }}>{value}</span>
            <IconChevronRight size={14} stroke={2} color="var(--text3)" />
          </div>
        ))}

        {/* ── Sign out ── */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: 13, borderRadius: 13, marginTop: 20, marginBottom: '2rem',
            background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)',
            color: '#f43f5e', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <IconLogout size={14} stroke={2} /> Sign out
        </button>

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
