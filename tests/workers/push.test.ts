import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN = { 'x-admin-key': 'test-admin-key' };
const PUSH_ORIGIN = 'https://push.test';

const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A real browser-side keypair: the Worker must be able to encrypt to it. */
async function subscription(path: string) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return {
    endpoint: `${PUSH_ORIGIN}${path}`,
    expirationTime: null,
    keys: { p256dh: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) },
  };
}

const json = (method: string, path: string, body: unknown) =>
  SELF.fetch(`https://cg.test${path}`, { method, headers: { ...ADMIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const state = async () => (await (await SELF.fetch('https://cg.test/api/admin/push', { headers: ADMIN })).json()) as { enabled: boolean; publicKey: string | null; devices: number };

interface Seen {
  path: string;
  headers: Record<string, string>;
  bytes: number;
}

/**
 * Tests and the Worker share one isolate here, so stubbing the global fetch
 * is how outbound push requests get intercepted. Anything not aimed at the
 * fake push service still goes out for real.
 */
function mockPushService(reply: (path: string) => { status: number; body?: string }) {
  const seen: Seen[] = [];
  const real = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== PUSH_ORIGIN) return real(input, init);
    const bytes = (await req.arrayBuffer()).byteLength;
    seen.push({ path: url.pathname, headers: Object.fromEntries(req.headers), bytes });
    const r = reply(url.pathname);
    return new Response(r.body ?? '', { status: r.status });
  });
  return seen;
}

afterEach(() => vi.unstubAllGlobals());
beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM donations'), env.DB.prepare('DELETE FROM push_subscriptions')]);
});

describe('organizer push', () => {
  it('is gated by the admin key and reports the public key', async () => {
    expect((await SELF.fetch('https://cg.test/api/admin/push')).status).toBe(401);
    const s = await state();
    expect(s.enabled).toBe(true);
    expect(s.publicKey).toBe(env.VAPID_PUBLIC_KEY);
    expect(s.devices).toBe(0);
  });

  it('registers a phone once per endpoint and forgets it on request', async () => {
    const sub = await subscription('/sub/one');
    expect((await json('POST', '/api/admin/push/subscriptions', { subscription: sub, label: 'iPhone · Safari' })).status).toBe(201);
    expect((await json('POST', '/api/admin/push/subscriptions', { subscription: sub })).status).toBe(201);
    expect((await state()).devices).toBe(1);
    const row = await env.DB.prepare('SELECT label FROM push_subscriptions').first<{ label: string }>();
    expect(row?.label).toBe('iPhone · Safari');

    expect((await json('POST', '/api/admin/push/subscriptions', { subscription: { ...sub, endpoint: 'http://insecure' } })).status).toBe(400);
    expect((await json('DELETE', '/api/admin/push/subscriptions', { endpoint: sub.endpoint })).status).toBe(200);
    expect((await state()).devices).toBe(0);
  });

  it('sends a signed, encrypted test push to every phone', async () => {
    await json('POST', '/api/admin/push/subscriptions', { subscription: await subscription('/sub/a') });
    await json('POST', '/api/admin/push/subscriptions', { subscription: await subscription('/sub/b') });
    const seen = mockPushService(() => ({ status: 201 }));
    const r = await SELF.fetch('https://cg.test/api/admin/push/test', { method: 'POST', headers: ADMIN });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ sent: 2, failed: 0, dropped: 0 });
    expect(seen.map((s) => s.path).sort()).toEqual(['/sub/a', '/sub/b']);
    for (const s of seen) {
      expect(s.headers['authorization']).toMatch(/^vapid t=.+, k=.+$/);
      expect(s.headers['content-encoding']).toBe('aes128gcm');
      expect(s.headers['ttl']).toBe('3600');
      expect(s.bytes).toBeGreaterThan(100);
    }
    const rows = await env.DB.prepare('SELECT last_sent_at FROM push_subscriptions').all<{ last_sent_at: string | null }>();
    expect(rows.results.every((x) => x.last_sent_at)).toBe(true);
  });

  it('drops a subscription the push service says is gone, keeps one that merely errored', async () => {
    await json('POST', '/api/admin/push/subscriptions', { subscription: await subscription('/sub/gone') });
    await json('POST', '/api/admin/push/subscriptions', { subscription: await subscription('/sub/flaky') });
    mockPushService((path) => (path === '/sub/gone' ? { status: 410, body: 'gone' } : { status: 500, body: 'oops' }));
    const r = (await (await SELF.fetch('https://cg.test/api/admin/push/test', { method: 'POST', headers: ADMIN })).json()) as unknown;
    expect(r).toEqual({ sent: 0, failed: 1, dropped: 1 });
    const rows = await env.DB.prepare('SELECT endpoint, last_error FROM push_subscriptions').all<{ endpoint: string; last_error: string | null }>();
    expect(rows.results).toEqual([{ endpoint: `${PUSH_ORIGIN}/sub/flaky`, last_error: '500 oops' }]);
  });

  it('buzzes the organizers when a gift lands', async () => {
    await json('POST', '/api/admin/push/subscriptions', { subscription: await subscription('/sub/phone') });
    const seen = mockPushService(() => ({ status: 201 }));
    const r = await SELF.fetch('https://cg.test/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), amountCents: 2500, name: 'Buzz Donor', anonymous: false, message: null, email: null, sourceId: 'sim-ok' }),
    });
    expect(r.status).toBe(201);
    // The fan-out runs in waitUntil after the response; give it a moment.
    for (let i = 0; i < 40 && seen.length === 0; i++) await new Promise((res) => setTimeout(res, 50));
    expect(seen.map((x) => x.path)).toEqual(['/sub/phone']);
    const row = await env.DB.prepare('SELECT last_sent_at FROM push_subscriptions').first<{ last_sent_at: string | null }>();
    expect(row?.last_sent_at).toBeTruthy();
  });

  it('serves a desk manifest whose start_url carries the key', async () => {
    const r = await SELF.fetch('https://cg.test/api/admin/manifest.webmanifest?key=test-admin-key');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/manifest+json');
    const m = (await r.json()) as { id: string; start_url: string; name: string; display: string };
    expect(m).toMatchObject({ id: '/admin', name: 'City Greens Desk', display: 'standalone', start_url: '/admin?key=test-admin-key' });
    expect((await SELF.fetch('https://cg.test/api/admin/manifest.webmanifest')).status).toBe(401);
  });

  it('renders /admin?key= with the desk manifest baked into the HTML', async () => {
    const r = await SELF.fetch('https://cg.test/admin?key=test-admin-key');
    // Needs a built app (dist/client). `npm run build` runs tests first, so allow that order.
    if (r.status === 404) return;
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const html = await r.text();
    expect(html).toContain('<link rel="manifest" href="/api/admin/manifest.webmanifest?key=test-admin-key">');
    expect(html).toContain('content="CG Desk"');
    expect(html).toContain('<title>City Greens Desk</title>');
    const plain = await (await SELF.fetch('https://cg.test/admin')).text();
    expect(plain).toContain('href="/manifest.webmanifest"');
  });
});
