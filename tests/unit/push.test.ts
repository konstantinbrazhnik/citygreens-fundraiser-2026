import { describe, expect, it } from 'vitest';
import { noticeForDonation, parsePushSubscription, testNotice } from '../../shared/push';

const sub = () => ({
  endpoint: 'https://push.example.com/send/abc123',
  expirationTime: null,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
});

describe('push notice', () => {
  it('names the donor, the amount, and how it arrived', () => {
    const n = noticeForDonation({ id: 'x1', amountCents: 25_000, name: 'Maria Gonzalez', message: 'For the Mamas', createdAt: '', source: 'square' });
    expect(n.title).toBe('Maria Gonzalez just gave $250');
    expect(n.body).toBe('Card payment · “For the Mamas”');
    expect(n.tag).toBe('gift-x1');
    expect(n.url).toBe('/#/admin');
  });
  it('keeps anonymous gifts anonymous and marks manual pledges', () => {
    const n = noticeForDonation({ id: 'x2', amountCents: 5000, name: null, message: null, createdAt: '', source: 'manual' });
    expect(n.title).toBe('Anonymous just gave $50');
    expect(n.body).toBe('Manual pledge');
  });
  it('gives every test its own tag so they stack', () => {
    expect(testNotice().tag).toMatch(/^test-\d+$/);
  });
});

describe('parsePushSubscription', () => {
  it('accepts what PushSubscription.toJSON() produces', () => {
    const r = parsePushSubscription(sub());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(sub());
  });
  it('rejects non-https endpoints and junk keys', () => {
    expect(parsePushSubscription({ ...sub(), endpoint: 'http://push.example.com/x' }).ok).toBe(false);
    expect(parsePushSubscription({ ...sub(), endpoint: 'not a url' }).ok).toBe(false);
    expect(parsePushSubscription({ ...sub(), keys: { p256dh: 'short', auth: 'a'.repeat(22) } }).ok).toBe(false);
    expect(parsePushSubscription({ ...sub(), keys: { p256dh: 'B'.repeat(87), auth: 'has spaces!' } }).ok).toBe(false);
    expect(parsePushSubscription(null).ok).toBe(false);
    expect(parsePushSubscription('string').ok).toBe(false);
  });
});
