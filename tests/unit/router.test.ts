import { describe, expect, it } from 'vitest';
import { adminInviteUrl, parseHash, parseLocation, toHash, type Route } from '../../src/app/lib/router';

describe('hash router', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'donate' },
      { name: 'donate', amountCents: 2500 },
      { name: 'thanks', id: 'abc' },
      { name: 'board' },
      { name: 'admin' },
      { name: 'admin', key: 'daa737c4' },
    ];
    for (const r of routes) expect(parseHash(toHash(r))).toEqual(r);
  });
  it('falls back to home on junk', () => {
    expect(parseHash('#/nothing/here')).toEqual({ name: 'home' });
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/donate/abc')).toEqual({ name: 'donate' });
    expect(parseHash('#/thanks')).toEqual({ name: 'home' });
  });
  it('treats /admin?key= as the desk and lets any hash win', () => {
    expect(parseLocation({ pathname: '/admin', search: '?key=abc', hash: '' })).toEqual({ name: 'admin', key: 'abc' });
    expect(parseLocation({ pathname: '/admin/', search: '', hash: '' })).toEqual({ name: 'admin' });
    expect(parseLocation({ pathname: '/admin', search: '?key=abc', hash: '#/board' })).toEqual({ name: 'board' });
    expect(parseLocation({ pathname: '/', search: '', hash: '#/donate/2500' })).toEqual({ name: 'donate', amountCents: 2500 });
    expect(adminInviteUrl('https://give.example', 'a b')).toBe('https://give.example/admin?key=a%20b');
  });
});
