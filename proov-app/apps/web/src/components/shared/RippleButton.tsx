'use client';
import { useRef, type ReactNode, type CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export function RippleButton({ children, onClick, className = 'btn-primary', style, disabled }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      background:rgba(255,255,255,.25);
      transform:scale(0);
      animation:rippleAnim .5s ease forwards;
      pointer-events:none;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
    onClick?.();
  };

  return (
    <button
      ref={ref}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
