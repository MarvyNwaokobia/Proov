'use client';
import { useEffect, useState } from 'react';

const PARTICLE_COUNT = 24;
const COLORS = ['#f59e0b', '#10b981', '#6366f1', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'];

interface Particle {
  x: number;
  y: number;
  color: string;
  angle: number;
  velocity: number;
  spin: number;
  size: number;
}

export function ConfettiBurst({ active, onDone }: { active: boolean; onDone?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    const p: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: 50 + (Math.random() - 0.5) * 10,
      y: 45 + (Math.random() - 0.5) * 10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * 360,
      velocity: 2 + Math.random() * 4,
      spin: (Math.random() - 0.5) * 720,
      size: 4 + Math.random() * 4,
    }));
    setParticles(p);
    const timer = setTimeout(() => { setParticles([]); onDone?.(); }, 1200);
    return () => clearTimeout(timer);
  }, [active, onDone]);

  if (particles.length === 0) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.velocity * 60;
        const ty = Math.sin(rad) * p.velocity * 60 - 40;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size * 0.6,
              background: p.color,
              borderRadius: 1,
              opacity: 1,
              transform: 'translate(-50%, -50%) rotate(0deg)',
              animation: `confetti-fly-${i % 6} 1.1s cubic-bezier(.2,.8,.3,1) forwards`,
            }}
          />
        );
      })}
      <style>{`
        ${[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * 360 + Math.random() * 60;
          const rad = (angle * Math.PI) / 180;
          const dist = 120 + Math.random() * 80;
          const tx = Math.cos(rad) * dist;
          const ty = Math.sin(rad) * dist + 60;
          const spin = (Math.random() - 0.5) * 540;
          return `@keyframes confetti-fly-${i} {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
            70% { opacity: 1; }
            100% { opacity: 0; transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${spin}deg) scale(0.5); }
          }`;
        }).join('\n')}
      `}</style>
    </div>
  );
}
