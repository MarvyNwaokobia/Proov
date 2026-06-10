'use client';
import { useState } from 'react';

const STOPS = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
function fmtDur(m: number) { return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`; }

export function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [mode, setMode] = useState<'slider' | 'manual'>('slider');
  // Use index into STOPS so thumb position aligns exactly with tick labels
  const stopIdx = STOPS.reduce((best, s, i) =>
    Math.abs(s - value) < Math.abs(STOPS[best] - value) ? i : best, 0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['slider', 'manual'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: '5px 12px', borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`, background: mode === m ? 'var(--accent-bg)' : 'transparent', color: mode === m ? 'var(--accent-text)' : 'var(--text3)' }}>
            {m === 'slider' ? '⟷ Slider' : '✎ Manual'}
          </button>
        ))}
      </div>
      {mode === 'slider' ? (
        <div>
          <p style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, marginBottom: 10 }}>{fmtDur(value)}</p>
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={stopIdx}
            onChange={(e) => onChange(STOPS[parseInt(e.target.value)])}
            className="duration-slider"
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => onChange(s)} style={{ fontSize: 9, padding: '2px 1px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: value === s ? 'var(--accent-text)' : 'var(--text3)', fontWeight: value === s ? 700 : 400 }}>
                {s < 60 ? `${s}m` : `${s / 60}h`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
            <button onClick={() => onChange(Math.max(1, value - 5))} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
            <input type="number" value={value} min={1} max={480} onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onChange(Math.min(480, Math.max(1, n))); }} style={{ width: 80, textAlign: 'center', fontSize: 24, fontWeight: 800 }} />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>min</span>
            <button onClick={() => onChange(Math.min(480, value + 5))} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDur(value)}</p>
        </div>
      )}
    </div>
  );
}
