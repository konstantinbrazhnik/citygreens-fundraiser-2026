import { displayName, formatMoney, type PublicDonation } from './donations';

/**
 * Organizer push notifications. The Worker builds one of these per gift and
 * the service worker (src/app/public/push-sw.js) turns it into a system
 * notification, so the two must agree on this shape.
 */
export type PushNotice = {
  title: string;
  body: string;
  /** Distinct per gift so a busy night stacks notifications instead of replacing them. */
  tag: string;
  /** Where a tap lands. */
  url: string;
};

export const ADMIN_URL = '/#/admin';

export function noticeForDonation(d: PublicDonation): PushNotice {
  const how = d.source === 'manual' ? 'Manual pledge' : 'Card payment';
  return {
    title: `${displayName(d)} just gave ${formatMoney(d.amountCents)}`,
    body: d.message ? `${how} · “${d.message}”` : how,
    tag: `gift-${d.id}`,
    url: ADMIN_URL,
  };
}

export function testNotice(): PushNotice {
  return {
    title: 'Notifications are on 💚',
    body: 'You will hear about every gift as it lands.',
    tag: `test-${Date.now()}`,
    url: ADMIN_URL,
  };
}

/** What the browser hands us from PushManager.subscribe(), after toJSON(). */
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}

export const MAX_LABEL = 120;
const MAX_ENDPOINT = 2048;
const B64URL = /^[A-Za-z0-9_-]+=*$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parsePushSubscription(v: unknown): Parsed<PushSubscriptionJSON> {
  if (!v || typeof v !== 'object') return { ok: false, error: 'Missing subscription.' };
  const s = v as Record<string, unknown>;
  if (typeof s.endpoint !== 'string' || s.endpoint.length > MAX_ENDPOINT) return { ok: false, error: 'Bad endpoint.' };
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return { ok: false, error: 'Bad endpoint.' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'Endpoint must be https.' };
  const keys = (s.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  if (!B64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return { ok: false, error: 'Bad p256dh key.' };
  if (!B64URL.test(auth) || auth.length < 16 || auth.length > 32) return { ok: false, error: 'Bad auth key.' };
  const expirationTime = typeof s.expirationTime === 'number' ? s.expirationTime : null;
  return { ok: true, value: { endpoint: s.endpoint, expirationTime, keys: { p256dh, auth } } };
}
