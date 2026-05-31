'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IconHome2,
  IconCheckbox,
  IconBolt,
  IconUsers,
  IconSettings2,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: IconHome2,     label: 'Home',     wtId: ''              },
  { href: '/habits',    icon: IconCheckbox,  label: 'Habits',   wtId: ''              },
  { href: '/timer',     icon: IconBolt,      label: 'Grind',    wtId: 'wt-nav-grind'  },
  { href: '/circle',    icon: IconUsers,     label: 'Circle',   wtId: 'wt-nav-circle' },
  { href: '/settings',  icon: IconSettings2, label: 'Settings', wtId: ''              },
];

const PUBLIC_PATHS = ['/', '/signin', '/signup', '/onboarding', '/username-setup', '/tutorial'];

export function BottomNav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      setUnread((e as CustomEvent<{ count: number }>).detail.count);
    };
    window.addEventListener('proov-notif-update', handler);
    return () => window.removeEventListener('proov-notif-update', handler);
  }, []);

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
      {NAV_ITEMS.map(({ href, icon: Icon, label, wtId }) => {
        const active = path === href || (href !== '/dashboard' && path.startsWith(href));
        const showBadge = href === '/circle' && unread > 0 && !active;
        return (
          <Link key={href} href={href} id={wtId || undefined} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 48, paddingBottom: 2 }}>
            <div style={{ position: 'relative' }}>
              <Icon
                size={22}
                stroke={1.8}
                color={active ? 'var(--accent)' : 'var(--text3)'}
              />
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -3, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f43f5e',
                  border: '1.5px solid var(--nav-bg)',
                }} />
              )}
            </div>
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
