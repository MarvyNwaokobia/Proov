'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome2,
  IconCheckbox,
  IconBolt,
  IconUsers,
  IconSettings2,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: IconHome2,     label: 'Home'     },
  { href: '/habits',    icon: IconCheckbox,  label: 'Habits'   },
  { href: '/timer',     icon: IconBolt,      label: 'Grind'    },
  { href: '/circle',    icon: IconUsers,     label: 'Circle'   },
  { href: '/settings',  icon: IconSettings2, label: 'Settings' },
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
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href));
        return (
          <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 48, paddingBottom: 2 }}>
            <Icon
              size={22}
              stroke={1.8}
              color={active ? 'var(--accent)' : 'var(--text3)'}
            />
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
