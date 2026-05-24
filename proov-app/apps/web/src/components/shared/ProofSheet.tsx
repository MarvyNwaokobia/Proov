'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconShieldCheck, IconX, IconPhoto, IconAlignLeft, IconLoader2, IconCheck } from '@tabler/icons-react';
import { markHabitVerified, getAiVerificationUsage } from '@/lib/supabase';

interface ProofSheetProps {
  habitId: string;
  habitName: string;
  userAddress: string;
  onVerified: () => void;
  onSelfReport: () => void;
  onClose: () => void;
}

export function ProofSheet({ habitId, habitName, userAddress, onVerified, onSelfReport, onClose }: ProofSheetProps) {
  const [tab, setTab] = useState<'text' | 'photo'>('text');
  const [text, setText] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verdict: string; reasoning: string } | null>(null);
  const [usageUsed, setUsageUsed] = useState(0);
  const [visible, setVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userAddress) {
      getAiVerificationUsage(userAddress).then(({ used }) => setUsageUsed(used)).catch(() => {});
    }
  }, [userAddress]);

  const remaining = Math.max(0, 20 - usageUsed);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 240);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setPhotoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit = tab === 'text' ? text.trim().length >= 20 : !!photoDataUrl;
  const isApproved = result?.verdict === 'approved';
  const isDisabled = !canSubmit || loading || isApproved;

  const handleSubmit = async () => {
    if (isDisabled) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/verify-habit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          habitId,
          habitName,
          proofType: tab,
          proofContent: tab === 'text' ? text.trim() : photoDataUrl,
          userAddress,
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.limitReached) {
        showToast('Monthly limit reached (20/20)');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'Verification failed');
        setLoading(false);
        return;
      }
      setResult({ verdict: data.verdict, reasoning: data.reasoning });
      if (data.verdict === 'approved') {
        await markHabitVerified(habitId, userAddress, data.reasoning).catch(() => {});
        setUsageUsed(prev => prev + 1);
        setTimeout(() => {
          showToast('Proov accepted ✓ +3 leaderboard points');
          onVerified();
          handleClose();
        }, 1200);
      }
    } catch {
      showToast('Network error — try again');
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:var(--text);color:var(--card-bg);padding:8px 16px;border-radius:20px;
      font-size:13px;font-weight:600;z-index:10000;white-space:nowrap;font-family:inherit;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  const btnBg = isApproved
    ? 'rgba(5,150,105,0.15)'
    : canSubmit && !loading
    ? 'var(--btn-primary-bg)'
    : 'var(--bg3)';

  const btnColor = isApproved
    ? '#059669'
    : canSubmit && !loading
    ? 'var(--btn-primary-text)'
    : 'var(--text3)';

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
              background: 'var(--card-bg)',
              borderTop: '1px solid var(--card-border)',
              borderRadius: '20px 20px 0 0',
              padding: '0 20px 36px',
              maxWidth: 540, margin: '0 auto',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconShieldCheck size={18} stroke={2} color="var(--accent)" />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Proov it</span>
              </div>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 4 }}>
                <IconX size={18} stroke={2} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Submit proof for <strong style={{ color: 'var(--text)' }}>{habitName}</strong> · earn +3 leaderboard points
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 }}>
              {(['text', 'photo'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setResult(null); }}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: tab === t ? 700 : 500,
                    background: tab === t ? 'var(--card-bg)' : 'transparent',
                    color: tab === t ? 'var(--text)' : 'var(--text3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t === 'text' ? <><IconAlignLeft size={13} stroke={2} /> Text</> : <><IconPhoto size={13} stroke={2} /> Photo</>}
                </button>
              ))}
            </div>

            {/* Content */}
            {tab === 'text' ? (
              <div>
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setResult(null); }}
                  placeholder="Describe what you did in at least 20 characters…"
                  rows={4}
                  style={{
                    width: '100%', borderRadius: 12, border: '1px solid var(--border2)',
                    background: 'var(--bg2)', color: 'var(--text)',
                    fontSize: 13, padding: '10px 12px', resize: 'none',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: text.length >= 20 ? 'var(--accent-text)' : 'var(--text3)', textAlign: 'right', marginTop: 4 }}>
                  {text.length} / 20 chars {text.length < 20 && `(${20 - text.length} more)`}
                </div>
              </div>
            ) : (
              <div>
                {photoDataUrl ? (
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <img src={photoDataUrl} alt="proof" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                    <button
                      onClick={() => { setPhotoDataUrl(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconX size={14} stroke={2} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', padding: '2rem', borderRadius: 12,
                      border: '2px dashed var(--border2)', background: 'var(--bg2)',
                      cursor: 'pointer', color: 'var(--text3)', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 6,
                    }}
                  >
                    <IconPhoto size={24} stroke={1.5} color="var(--text3)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Tap to choose photo</span>
                    <span style={{ fontSize: 11 }}>Max 5 MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 10,
                background: result.verdict === 'approved' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${result.verdict === 'approved' ? 'rgba(5,150,105,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: result.verdict === 'approved' ? '#059669' : '#dc2626', marginBottom: 4 }}>
                  {result.verdict === 'approved' ? '✓ Approved' : '✗ Not approved'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{result.reasoning}</div>
                {result.verdict === 'rejected' && (
                  <button
                    onClick={() => { onSelfReport(); handleClose(); }}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
                  >
                    Just self-report instead
                  </button>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text3)', marginBottom: 10, textAlign: 'center' }}>
              {remaining} of 20 free verifications remaining this month
            </div>

            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              style={{
                width: '100%', padding: 13, borderRadius: 12, border: 'none',
                background: btnBg,
                color: btnColor,
                fontSize: 14, fontWeight: 700,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.8 : 1,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {loading ? (
                <>
                  <IconLoader2 size={16} stroke={2} style={{ animation: 'spin 1s linear infinite' }} />
                  Verifying…
                </>
              ) : isApproved ? (
                <>
                  <IconCheck size={16} stroke={2.5} /> Verified
                </>
              ) : (
                <><IconShieldCheck size={16} stroke={2} /> Verify & complete</>
              )}
            </button>

            {!canSubmit && !loading && !result && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                {tab === 'text' ? `Add ${20 - text.trim().length} more characters to enable` : 'Choose a photo to enable'}
              </p>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
