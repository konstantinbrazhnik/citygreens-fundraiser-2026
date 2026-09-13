import { describe, expect, it } from 'vitest';
import {
  applyDonation,
  applySettings,
  emptySnapshot,
  milestoneCrossed,
  parseSettingsPatch,
  percent,
  RECENT_LIMIT,
  removeDonation,
} from '../../shared/board';
import type { PublicDonation } from '../../shared/donations';
import { parseBoardMessage } from '../../shared/messages';

const d = (id: string, amountCents: number): PublicDonation => ({
  id,
  amountCents,
  name: null,
  message: null,
  createdAt: 'now',
  source: 'manual',
});
const settings = { goalCents: 100_000, offsetCents: 10_000, offsetLabel: 'tix', showTotal: true };

describe('snapshot folding', () => {
  it('adds, dedupes, caps, and tracks the largest', () => {
    let s = emptySnapshot(settings);
    expect(s.raisedCents).toBe(10_000);
    s = applyDonation(s, d('a', 500));
    s = applyDonation(s, d('a', 500));
    s = applyDonation(s, d('b', 900));
    expect(s.count).toBe(2);
    expect(s.giftCents).toBe(1400);
    expect(s.raisedCents).toBe(11_400);
    expect(s.recent[0]!.id).toBe('b');
    expect(s.largest!.id).toBe('b');
    for (let i = 0; i < RECENT_LIMIT + 5; i++) s = applyDonation(s, d(`x${i}`, 100));
    expect(s.recent.length).toBe(RECENT_LIMIT);
  });
  it('removes and recomputes', () => {
    let s = emptySnapshot(settings);
    s = applyDonation(s, d('a', 500));
    s = applyDonation(s, d('b', 900));
    s = removeDonation(s, 'b');
    expect(s.count).toBe(1);
    expect(s.giftCents).toBe(500);
    expect(s.largest!.id).toBe('a');
    expect(removeDonation(s, 'zzz')).toBe(s);
  });
  it('re-derives the total when settings change', () => {
    let s = applyDonation(emptySnapshot(settings), d('a', 500));
    s = applySettings(s, { ...settings, offsetCents: 0 });
    expect(s.raisedCents).toBe(500);
  });
});

describe('percent & milestones', () => {
  it('clamps', () => {
    expect(percent(50, 100)).toBe(50);
    expect(percent(500, 100)).toBe(100);
    expect(percent(5, 0)).toBe(0);
  });
  it('fires once per 10% line and once at the goal', () => {
    expect(milestoneCrossed(0, 5, 100)).toBeNull();
    expect(milestoneCrossed(5, 12, 100)).toBe(10);
    expect(milestoneCrossed(12, 35, 100)).toBe(30);
    expect(milestoneCrossed(95, 100, 100)).toBe(100);
    expect(milestoneCrossed(100, 200, 100)).toBeNull();
    expect(milestoneCrossed(50, 40, 100)).toBeNull();
  });
});

describe('settings patch', () => {
  it('validates and merges', () => {
    expect(parseSettingsPatch({ goalCents: 5000 }, settings)).toEqual({ ok: true, value: { ...settings, goalCents: 5000 } });
    expect(parseSettingsPatch({ offsetCents: -1 }, settings).ok).toBe(false);
    expect(parseSettingsPatch({ goalCents: 1.5 }, settings).ok).toBe(false);
    expect(parseSettingsPatch({ offsetLabel: ' hi ' }, settings)).toEqual({ ok: true, value: { ...settings, offsetLabel: 'hi' } });
    expect(parseSettingsPatch(null, settings).ok).toBe(false);
  });
});

describe('parseBoardMessage', () => {
  it('accepts known shapes and rejects junk', () => {
    expect(parseBoardMessage(JSON.stringify({ type: 'donation.new', payload: d('a', 1), ts: 1 }))?.type).toBe('donation.new');
    expect(parseBoardMessage('pong')).toBeNull();
    expect(parseBoardMessage(JSON.stringify({ type: 'evil', payload: {}, ts: 1 }))).toBeNull();
    expect(parseBoardMessage(JSON.stringify({ type: 'donation.new', ts: 1 }))).toBeNull();
    expect(parseBoardMessage(12)).toBeNull();
  });
});
