import { describe, expect, it } from 'vitest';
import { parseHash, toHash, type Route } from '../../src/app/lib/router';

describe('hash router', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'donate' },
      { name: 'donate', amountCents: 2500 },
      { name: 'thanks', id: 'abc' },
      { name: 'board' },
      { name: 'admin' },
    ];
    for (const r of routes) expect(parseHash(toHash(r))).toEqual(r);
  });
  it('falls back to home on junk', () => {
    expect(parseHash('#/nothing/here')).toEqual({ name: 'home' });
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/donate/abc')).toEqual({ name: 'donate' });
    expect(parseHash('#/thanks')).toEqual({ name: 'home' });
  });
});
