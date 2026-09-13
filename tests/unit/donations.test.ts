import { describe, expect, it } from 'vitest';
import {
  cleanText,
  formatMoney,
  outcomeFor,
  parseAmountCents,
  parseDonationRequest,
  PRESETS,
  shortName,
} from '../../shared/donations';

describe('formatMoney', () => {
  it('drops cents when whole', () => {
    expect(formatMoney(5000)).toBe('$50');
    expect(formatMoney(125000)).toBe('$1,250');
    expect(formatMoney(1250)).toBe('$12.50');
    expect(formatMoney(5)).toBe('$0.05');
    expect(formatMoney(-2500)).toBe('-$25');
  });
});

describe('presets', () => {
  it('are ascending and each has an outcome', () => {
    for (let i = 1; i < PRESETS.length; i++) expect(PRESETS[i]!.cents).toBeGreaterThan(PRESETS[i - 1]!.cents);
    for (const p of PRESETS) expect(p.outcome.length).toBeGreaterThan(10);
  });
  it('describe an arbitrary amount by the largest preset at or below it', () => {
    expect(outcomeFor(500).cents).toBe(2500);
    expect(outcomeFor(7500).cents).toBe(5000);
    expect(outcomeFor(99_999).cents).toBe(50_000);
    expect(outcomeFor(5_000_000).cents).toBe(100_000);
  });
});

describe('parseAmountCents', () => {
  it('bounds and integer-checks', () => {
    expect(parseAmountCents(499).ok).toBe(false);
    expect(parseAmountCents(500).ok).toBe(true);
    expect(parseAmountCents(50.5).ok).toBe(false);
    expect(parseAmountCents('2500')).toEqual({ ok: true, value: 2500 });
    expect(parseAmountCents(2_500_001).ok).toBe(false);
    expect(parseAmountCents(NaN).ok).toBe(false);
  });
});

describe('cleanText', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(cleanText('  a   b\n\nc ', 100)).toBe('a b c');
    expect(cleanText('ab', 100)).toBe('a b');
    expect(cleanText('', 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
    expect(cleanText('abcdefghij', 5)).toBe('abcde');
  });
});

describe('parseDonationRequest', () => {
  const base = { id: '9b2f6e8c-3c9d-4c4b-9f5b-2b1e0f6a7d11', amountCents: 2500, name: 'Ann', anonymous: false, sourceId: 'tok' };
  it('accepts a good request and lowercases the id and email', () => {
    const r = parseDonationRequest({ ...base, id: base.id.toUpperCase(), email: 'A@B.CO' });
    expect(r.ok && r.value.id).toBe(base.id);
    expect(r.ok && r.value.email).toBe('a@b.co');
    expect(r.ok && r.value.message).toBeNull();
  });
  it('drops the name when anonymous', () => {
    const r = parseDonationRequest({ ...base, anonymous: true });
    expect(r.ok && r.value.name).toBeNull();
  });
  it('requires a name when not anonymous', () => {
    expect(parseDonationRequest({ ...base, name: '   ' }).ok).toBe(false);
  });
  it('requires a payment token', () => {
    expect(parseDonationRequest({ ...base, sourceId: '' }).ok).toBe(false);
  });
});

describe('shortName', () => {
  it('keeps a first name and an initial', () => {
    expect(shortName('Maria Gonzalez')).toBe('Maria G.');
    expect(shortName('Cher')).toBe('Cher');
    expect(shortName(null)).toBe('Someone');
  });
});
