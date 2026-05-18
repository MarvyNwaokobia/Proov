"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import Link from "next/link";
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
  const { entries } = useLeaderboard(20);

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [usernameHint, setUsernameHint] = useState("");
  const [hintOk, setHintOk] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);
  useEffect(() => { if (address) setCurrentUsername(getUsername(address)); }, [address]);

  const checkDraft = (val: string) => {
    setDraft(val);
    const clean = val.trim();
    if (!clean) { setUsernameHint(''); setHintOk(false); return; }
    const { valid, message } = validateUsername(clean);
    if (!valid) { setUsernameHint(message); setHintOk(false); return; }
    if (isUsernameTaken(clean, address ?? '')) { setUsernameHint('Already taken'); setHintOk(false); return; }
    setUsernameHint('✓ Available'); setHintOk(true);
  };

  const handleSave = () => {
    if (!hintOk || !address) return;
    setUsername(address, draft.trim());
    setCurrentUsername(draft.trim());
    setEditing(false); setDraft(''); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const myRank = address ? entries.findIndex(e => e.address.toLowerCase() === address.toLowerCase()) + 1 : 0;

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom:'1.5rem' }}>
      <p style={{ fontSize:10, fontWeight:600, letterSpacing:'1.5px', color:'var(--text3)', textTransform:'uppercase', marginBottom:10 }}>
        {label}
      </p>
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ children, last = false }: { children: React.ReactNode; last?: boolean }) => (
    <div style={{ padding:'14px 16px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{children}</div>
  );

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24">
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.05] rounded-full"
        style={{ background:'radial-gradient(ellipse,var(--accent),transparent)' }} />

      {/* Header */}
      <div style={{ background:'var(--nav-bg)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)', padding:'1rem 1.25rem', position:'sticky', top:0, zIndex:30 }}>
        <div style={{ maxWidth:520, margin:'0 auto', display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/dashboard" style={{ width:32, height:32, borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', color:'var(--text2)', fontSize:14 }}>←</Link>
          <p style={{ color:'var(--text)', fontWeight:700 }}>Settings</p>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'1.5rem 1.25rem', position:'relative', zIndex:1 }}>

        {/* Profile */}
        <Section label="Profile">
          <Row last>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'var(--btn-primary-text)', flexShrink:0 }}>
                {(currentUsername ?? shortAddr(address ?? '0x')).slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                {!editing ? (
                  <div>
                    <p style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>
                      {currentUsername ?? <span style={{ color:'var(--text3)', fontWeight:400, fontSize:14 }}>No username set</span>}
                    </p>
                    {address && <p style={{ fontSize:11, color:'var(--text3)', fontFamily:'monospace', marginTop:2 }}>{shortAddr(address)}</p>}
                    {saved && <p style={{ fontSize:11, color:'var(--success-text)', marginTop:2 }}>✓ Saved</p>}
                  </div>
                ) : (
                  <div style={{ flex:1 }}>
                    <input autoFocus value={draft} onChange={e => checkDraft(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter') handleSave(); if (e.key==='Escape') setEditing(false); }}
                      placeholder="@yourname" maxLength={20}
                      style={{ marginBottom:4, padding:'7px 12px', fontSize:13 }}
                    />
                    {usernameHint && <p style={{ fontSize:11, color: hintOk ? 'var(--success-text)' : '#f43f5e', marginBottom:4 }}>{usernameHint}</p>}
                    <p style={{ fontSize:10, color:'var(--text3)' }}>3–20 chars · letters, numbers, underscores</p>
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <button onClick={() => { setEditing(false); setDraft(''); }} style={{ flex:1, padding:'7px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                      <button onClick={handleSave} disabled={!hintOk} style={{ flex:1, padding:'7px', borderRadius:8, border:'none', background: hintOk?'var(--btn-primary-bg)':'var(--bg3)', color: hintOk?'var(--btn-primary-text)':'var(--text3)', fontSize:12, fontWeight:600, cursor: hintOk?'pointer':'default', fontFamily:'inherit' }}>Save</button>
                    </div>
                  </div>
                )}
              </div>
              {!editing && (
                <button onClick={() => { setDraft(currentUsername ?? ''); setEditing(true); }} style={{ fontSize:12, color:'var(--accent-text)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
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
          <Row last>
            <Link href="/habits" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', color:'var(--text)' }}>
              <span style={{ fontSize:14 }}>Manage habits</span>
              <span style={{ color:'var(--text3)', fontSize:12 }}>→</span>
            </Link>
          </Row>
        </Section>

        {/* Circle */}
        <Section label="Circle">
          <Row last>
            <Link href="/circle" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', color:'var(--text)' }}>
              <span style={{ fontSize:14 }}>Manage circle</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{circle.length} members →</span>
            </Link>
          </Row>
        </Section>

        {/* Leaderboard */}
        <Section label="Leaderboard">
          <Row last>
            <Link href="/leaderboard" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', color:'var(--text)' }}>
              <span style={{ fontSize:14 }}>View leaderboard</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{myRank > 0 ? `You're #${myRank}` : '→'}</span>
            </Link>
          </Row>
        </Section>

        {/* Notifications */}
        <Section label="Notifications">
          <Row last>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ fontSize:14, color:'var(--text)' }}>Streak reminders</p>
                <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Coming soon</p>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, padding:'4px 10px' }}>Soon</div>
            </div>
          </Row>
        </Section>

        {/* Account */}
        <Section label="Account">
          <Row>
            <p style={{ fontSize:11, color:'var(--text3)', fontFamily:'monospace', wordBreak:'break-all' }}>{address}</p>
          </Row>
          <Row>
            <button onClick={() => { disconnect(); router.push("/"); }} style={{ width:'100%', padding:'10px 0', textAlign:'left', background:'none', border:'none', color:'#f43f5e', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
              Sign out
            </button>
          </Row>
          <Row last>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} style={{ width:'100%', padding:'10px 0', textAlign:'left', background:'none', border:'none', color:'var(--text3)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Delete account
              </button>
            ) : (
              <div>
                <p style={{ fontSize:13, color:'var(--text)', marginBottom:8 }}>This will delete your profile. Your onchain records remain.</p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                  <button style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'#f43f5e', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Confirm</button>
                </div>
              </div>
            )}
          </Row>
        </Section>
      </div>
    </div>
  );
}
