import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routing: the fragment never reaches the Worker, so a reload of the
 * installed PWA (or a QR code deep link) lands on the same screen with no
 * server-side route config fighting the service worker's navigate fallback.
 */
export type Route =
  | { name: 'home' }
  | { name: 'donate'; amountCents?: number }
  | { name: 'thanks'; id: string }
  | { name: 'board' }
  /** `key` is the organizer invite: #/admin/<ADMIN_KEY> signs in and is what a Home Screen app opens to. */
  | { name: 'admin'; key?: string };

export const DEFAULT_ROUTE: Route = { name: 'home' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, arg] = parts;
  switch (head) {
    case undefined:
    case '':
      return DEFAULT_ROUTE;
    case 'donate': {
      const n = arg ? Number(arg) : NaN;
      return Number.isInteger(n) && n > 0 ? { name: 'donate', amountCents: n } : { name: 'donate' };
    }
    case 'thanks':
      return arg ? { name: 'thanks', id: arg } : { name: 'home' };
    case 'board':
      return { name: 'board' };
    case 'admin':
      return arg ? { name: 'admin', key: arg } : { name: 'admin' };
    default:
      return DEFAULT_ROUTE;
  }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'donate':
      return route.amountCents ? `#/donate/${route.amountCents}` : '#/donate';
    case 'thanks':
      return `#/thanks/${encodeURIComponent(route.id)}`;
    case 'board':
      return '#/board';
    case 'admin':
      return route.key ? `#/admin/${encodeURIComponent(route.key)}` : '#/admin';
  }
}

export function useRoute(): { route: Route; navigate: (route: Route, opts?: { replace?: boolean }) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((next: Route, opts?: { replace?: boolean }) => {
    const hash = toHash(next);
    if (opts?.replace) history.replaceState(null, '', hash);
    else location.hash = hash;
    // replaceState does not fire hashchange
    setRoute(parseHash(hash));
    window.scrollTo({ top: 0 });
  }, []);
  return { route, navigate };
}
