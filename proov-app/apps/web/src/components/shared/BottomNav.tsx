'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { icon: '🏠', label: 'Home',     href: '/dashboard' },
  { icon: '✅', label: 'Habits',   href: '/habits'    },
  { icon: '⚡', label: 'Grind',    href: '/timer'     },
  { icon: '🤝', label: 'Circle',   href: '/circle'    },
  { icon: '⚙️', label: 'Settings', href: '/settings'  },
];

const PUBLIC_PATHS = ['/', '/signin', '/signup', '/onboarding', '/username-setup', '/tutorial'];

export function BottomNav() {
  const path = usePathname();

  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '?'))) return null;

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
      padding: '0.5rem 0.25rem calc(0.5rem + env(safe-area-inset-bottom))',
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
    }}>
      {NAV.map(({ icon, label, href }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href));
        return (
          <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 48, paddingBottom: 2 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontSize: 9, fontWeight: active ? 700 : 500,
              color: active ? 'var(--accent-text)' : 'var(--text3)',
              transition: 'color .15s',
            }}>{label}</span>
            {active && (
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 1 }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
