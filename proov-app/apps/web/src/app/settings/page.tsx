"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { getUsername, setUsername, validateUsername, isUsernameTaken } from "@/lib/username";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useCircle } from "@/hooks/useCircle";
import { useLeaderboard } from "@/hooks/useStreak";

function shortAddr(addr: string) { return `${addr.slice(0,6)}…${addr.slice(-4)}`; }

export default function SettingsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { circle } = useCircle();
  const { entries } = useLeaderboard(50);

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState("");
  const [hintOk, setHintOk] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);
  useEffect(() => { if (address) setCurrentUsername(getUsername(address)); }, [address]);

  const checkDraft = (val: string) => {
    setDraft(val);
    const clean = val.trim();
    if (!clean) { setHint(''); setHintOk(false); return; }
    const { valid, message } = validateUsername(clean);
    if (!valid) { setHint(message); setHintOk(false); return; }
    if (isUsernameTaken(clean, address ?? '')) { setHint('Already taken — try another'); setHintOk(false); return; }
    setHint('✓ Available'); setHintOk(true);
  };

  const handleSave = () => {
    if (!hintOk || !address) return;
    setUsername(address, draft.trim());
    setCurrentUsername(draft.trim());
    setEditing(false); setDraft(''); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const myRank = address ? entries.findIndex(e => e.address.toLowerCase() === address.toLowerCase()) + 1 : 0;
  const initials = (currentUsername ?? shortAddr(address ?? '0x')).slice(0, 2).toUpperCase();

  if (!isConnected) return null;

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ children, last = false, onClick }: { children: React.ReactNode; last?: boolean; onClick?: () => void }) => (
    <div onClick={onClick} style={{ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>{children}</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>Settings</p>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '1.25rem' }}>

        {/* Leaderboard card at top */}
        <div onClick={() => router.push('/leaderboard')} style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 14, padding: '0.875rem', marginBottom: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Leaderboard</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{myRank > 0 ? `You're #${myRank} globally` : 'See how you rank'}</div>
          </div>
          <span style={{ color: 'var(--accent-text)', fontSize: 18 }}>›</span>
        </div>

        {/* Profile */}
        <Section label="Profile">
          <Row last>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--accent2,var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'var(--btn-primary-text)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                {!editing ? (
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                      {currentUsername ?? <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 14 }}>Not set</span>}
                    </p>
                    {address && <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 2 }}>{shortAddr(address)}</p>}
                    {saved && <p style={{ fontSize: 11, color: 'var(--success-text)', marginTop: 2 }}>✓ Saved</p>}
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <input autoFocus value={draft} onChange={e => checkDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} placeholder="@yourname" maxLength={20} style={{ marginBottom: 4 }} />
                    {hint && <p style={{ fontSize: 11, color: hintOk ? 'var(--success-text)' : '#f43f5e', marginBottom: 4 }}>{hint}</p>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={() => { setEditing(false); setDraft(''); }} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                      <button onClick={handleSave} disabled={!hintOk} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: hintOk ? 'var(--btn-primary-bg)' : 'var(--bg3)', color: hintOk ? 'var(--btn-primary-text)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: hintOk ? 'pointer' : 'default', fontFamily: 'inherit' }}>Save</button>
                    </div>
                  </div>
                )}
              </div>
              {!editing && (
                <button onClick={() => { setDraft(currentUsername ?? ''); setEditing(true); }} style={{ fontSize: 12, color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {currentUsername ? 'Edit' : 'Set name'}
                </button>
              )}
            </div>
          </Row>
        </Section>

        {/* Appearance */}
        <Section label="Appearance">
          <Row last><ThemeToggle /></Row>
        </Section>

        {/* Habits */}
        <Section label="Habits">
          <Row onClick={() => router.push('/habits')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>Manage habits</span>
              <span style={{ color: 'var(--text3)', fontSize: 14 }}>›</span>
            </div>
          </Row>
          <Row last>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>Default privacy</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Private</span>
            </div>
          </Row>
        </Section>

        {/* Circle */}
        <Section label="Circle">
          <Row last onClick={() => router.push('/circle')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>Your circle</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{circle.length} members ›</span>
            </div>
          </Row>
        </Section>

        {/* Notifications */}
        <Section label="Notifications">
          <Row last>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, color: 'var(--text)' }}>Streak reminders</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Coming soon</p>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px' }}>Soon</div>
            </div>
          </Row>
        </Section>

        {/* Account */}
        <Section label="Account">
          <Row>
            <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{address}</p>
          </Row>
          <Row>
            <button onClick={() => { disconnect(); router.push("/"); }} style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', padding: 0 }}>
              Sign out
            </button>
          </Row>
          <Row last>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', padding: 0 }}>
                Delete account
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>This will delete your profile. Your onchain records remain.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#f43f5e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                </div>
              </div>
            )}
          </Row>
        </Section>
      </div>
    </div>
  );
}
