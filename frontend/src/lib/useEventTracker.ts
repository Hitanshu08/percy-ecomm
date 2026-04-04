import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageLoad } from './eventTracker';

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile': 'Profile',
  '/wallet': 'Wallet',
  '/shop': 'Shop',
  '/subscriptions': 'Subscriptions',
  '/contact': 'Contact',
  '/giveaway': 'Giveaway',
  '/terms': 'Terms',
  '/admin': 'Admin',
  '/admin/analytics': 'Admin Analytics',
  '/admin/activity': 'Admin Activity',
};

export function usePageLoadTracker() {
  const location = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    const pageName =
      PAGE_NAMES[location.pathname] ??
      (location.pathname.replace(/^\//, '').replace(/\//g, ' > ') || 'Home');

    trackPageLoad(pageName);
  }, [location.pathname]);
}
