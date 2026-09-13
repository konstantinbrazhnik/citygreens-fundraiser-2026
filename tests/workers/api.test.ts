import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const ADMIN = { 'x-admin-key': 'test-admin-key' };
const uuid = () => crypto.randomUUID();

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`https://cg.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const gift = (over: Record<string, unknown> = {}) => ({
  id: uuid(),
  amountCents: 5000,
  name: 'Maria Gonzalez',
  anonymous: false,
  message: 'For the Mamas',
  email: 'maria@example.com',
  sourceId: 'sim-ok',
  ...over,
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM donations'),
    env.DB.prepare('DELETE FROM subscribers'),
    env.DB.prepare('DELETE FROM settings'),
  ]);
});

describe('config', () => {
  it('reports simulated payments without leaking secrets', async () => {
    const r = await SELF.fetch('https://cg.test/api/config');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const j = (await r.json()) as { paymentsMode: string; paymentsReady: boolean; square: unknown; event: { name: string } };
    expect(j.paymentsMode).toBe('simulated');
    expect(j.paymentsReady).toBe(true);
    expect(j.square).toBeNull();
    expect(j.event.name).toContain('Growing City Greens');
    expect(JSON.stringify(j)).not.toContain('test-admin-key');
  });
});

describe('POST /api/donations', () => {
  it('records a gift and shows it on the board', async () => {
    const g = gift();
    const r = await post('/api/donations', g);
    expect(r.status).toBe(201);
    const j = (await r.json()) as { donation: { id: string; name: string; amountCents: number; source: string } };
    expect(j.donation).toMatchObject({ id: g.id, name: 'Maria Gonzalez', amountCents: 5000, source: 'simulated' });

    const board = (await (await SELF.fetch('https://cg.test/api/board')).json()) as {
      raisedCents: number;
      count: number;
      recent: { id: string }[];
    };
    expect(board.raisedCents).toBe(5000);
    expect(board.count).toBe(1);
    expect(board.recent[0]!.id).toBe(g.id);
  });

  it('respects anonymity everywhere the public can look', async () => {
    const g = gift({ anonymous: true, name: 'Should Not Show' });
    const r = await post('/api/donations', g);
    expect(r.status).toBe(201);
    const j = (await r.json()) as { donation: { name: string | null } };
    expect(j.donation.name).toBeNull();
    const board = await (await SELF.fetch('https://cg.test/api/board')).text();
    expect(board).not.toContain('Should Not Show');
    const one = await (await SELF.fetch(`https://cg.test/api/donations/${g.id}`)).text();
    expect(one).not.toContain('Should Not Show');
    expect(one).not.toContain('maria@example.com');
    // still on record for the organizers
    const row = await env.DB.prepare('SELECT donor_name, email FROM donations WHERE id = ?')
      .bind(g.id)
      .first<{ donor_name: string | null; email: string }>();
    expect(row).toEqual({ donor_name: null, email: 'maria@example.com' });
  });

  it('is idempotent on the client id', async () => {
    const g = gift();
    expect((await post('/api/donations', g)).status).toBe(201);
    const again = await post('/api/donations', g);
    expect(again.status).toBe(200);
    expect(((await again.json()) as { replay: boolean }).replay).toBe(true);
    const board = (await (await SELF.fetch('https://cg.test/api/board')).json()) as { count: number };
    expect(board.count).toBe(1);
  });

  it('rejects bad input with a readable message', async () => {
    expect((await post('/api/donations', gift({ amountCents: 100 }))).status).toBe(400);
    expect((await post('/api/donations', gift({ name: '', anonymous: false }))).status).toBe(400);
    expect((await post('/api/donations', gift({ id: 'nope' }))).status).toBe(400);
    expect((await post('/api/donations', gift({ email: 'not-an-email' }))).status).toBe(400);
    const r = await post('/api/donations', gift({ amountCents: 100 }));
    expect(((await r.json()) as { error: string }).error).toContain('$5');
  });

  it('surfaces a decline as 402 and records nothing', async () => {
    const r = await post('/api/donations', gift({ sourceId: 'sim-decline' }));
    expect(r.status).toBe(402);
    expect(((await r.json()) as { code: string }).code).toBe('CARD_DECLINED');
    const board = (await (await SELF.fetch('https://cg.test/api/board')).json()) as { count: number };
    expect(board.count).toBe(0);
  });

  it('cleans and caps free text', async () => {
    const g = gift({ name: '  Maria   Gonzalez  ', message: 'x'.repeat(500) });
    const j = (await (await post('/api/donations', g)).json()) as { donation: { name: string; message: string } };
    expect(j.donation.name).toBe('Maria Gonzalez');
    expect(j.donation.message.length).toBe(100);
  });
});

describe('board', () => {
  it('sums, orders newest first, and caps the recent list', async () => {
    for (let i = 0; i < 70; i++) {
      await env.DB.prepare(
        "INSERT INTO donations (id, amount_cents, donor_name, anonymous, source, created_at) VALUES (?, ?, ?, 0, 'manual', ?)",
      )
        .bind(uuid(), 1000 + i, `Donor ${i}`, new Date(Date.UTC(2026, 8, 22, 0, 0, i)).toISOString())
        .run();
    }
    const b = (await (await SELF.fetch('https://cg.test/api/board')).json()) as {
      count: number;
      giftCents: number;
      recent: { name: string }[];
      largest: { name: string };
      goalCents: number;
    };
    expect(b.count).toBe(70);
    expect(b.giftCents).toBe(70 * 1000 + (69 * 70) / 2);
    expect(b.recent.length).toBe(60);
    expect(b.recent[0]!.name).toBe('Donor 69');
    expect(b.largest.name).toBe('Donor 69');
    expect(b.goalCents).toBe(10_000_000);
  });

  it('excludes hidden gifts', async () => {
    const g = gift();
    await post('/api/donations', g);
    const r = await SELF.fetch(`https://cg.test/api/admin/donations/${g.id}`, { method: 'DELETE', headers: ADMIN });
    expect(r.status).toBe(200);
    const b = (await (await SELF.fetch('https://cg.test/api/board')).json()) as { count: number; raisedCents: number };
    expect(b).toMatchObject({ count: 0, raisedCents: 0 });
    // and the replay still answers, since the row exists
    expect((await post('/api/donations', g)).status).toBe(200);
  });

  it('serves the websocket upgrade and fans out a gift', async () => {
    const r = await SELF.fetch('https://cg.test/api/board/ws', { headers: { Upgrade: 'websocket' } });
    expect(r.status).toBe(101);
    const ws = r.webSocket!;
    ws.accept();
    const frames: string[] = [];
    const got = new Promise<void>((resolve) => {
      ws.addEventListener('message', (ev) => {
        frames.push(String(ev.data));
        if (frames.length >= 2) resolve();
      });
    });
    const g = gift({ name: 'Live Donor' });
    await post('/api/donations', g);
    await got;
    expect(JSON.parse(frames[0]!).type).toBe('board.hello');
    const m = JSON.parse(frames[1]!) as { type: string; payload: { name: string; id: string } };
    expect(m.type).toBe('donation.new');
    expect(m.payload).toMatchObject({ name: 'Live Donor', id: g.id });
    ws.close();
  });

  it('refuses a plain GET on the socket route', async () => {
    expect((await SELF.fetch('https://cg.test/api/board/ws')).status).toBe(426);
  });
});

describe('newsletter', () => {
  it('stores the address even when Mailchimp is unreachable', async () => {
    const r = await post('/api/newsletter', { email: 'Neighbor@Example.com', firstName: 'Nia', lastName: 'B' });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { outcome: string }).outcome).toBe('saved');
    const row = await env.DB.prepare('SELECT email, first_name, synced FROM subscribers').first<{
      email: string;
      first_name: string;
      synced: number;
    }>();
    expect(row).toEqual({ email: 'neighbor@example.com', first_name: 'Nia', synced: 0 });
    // twice is fine
    expect((await post('/api/newsletter', { email: 'neighbor@example.com' })).status).toBe(200);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers').first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('rejects a bad email', async () => {
    expect((await post('/api/newsletter', { email: 'nope' })).status).toBe(400);
  });
});

describe('admin', () => {
  it('needs the key', async () => {
    expect((await SELF.fetch('https://cg.test/api/admin/donations')).status).toBe(401);
    expect((await SELF.fetch('https://cg.test/api/admin/donations', { headers: { 'x-admin-key': 'wrong' } })).status).toBe(401);
    expect((await SELF.fetch('https://cg.test/api/admin/donations', { headers: ADMIN })).status).toBe(200);
    expect((await SELF.fetch('https://cg.test/api/admin/ping?key=test-admin-key')).status).toBe(200);
  });

  it('puts a manual pledge on the board', async () => {
    const r = await post('/api/admin/donations', { amountCents: 100_000, name: 'Paddle Raiser', anonymous: false, message: 'Bevo!' }, ADMIN);
    expect(r.status).toBe(201);
    const b = (await (await SELF.fetch('https://cg.test/api/board')).json()) as {
      raisedCents: number;
      recent: { source: string; name: string }[];
    };
    expect(b.raisedCents).toBe(100_000);
    expect(b.recent[0]).toMatchObject({ source: 'manual', name: 'Paddle Raiser' });
  });

  it('moves the goal and the offset', async () => {
    const r = await SELF.fetch('https://cg.test/api/admin/settings', {
      method: 'PUT',
      headers: { ...ADMIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalCents: 2_000_000, offsetCents: 750_000, offsetLabel: 'from tickets' }),
    });
    expect(r.status).toBe(200);
    await post('/api/donations', gift({ amountCents: 2500 }));
    const b = (await (await SELF.fetch('https://cg.test/api/board')).json()) as {
      goalCents: number;
      offsetCents: number;
      raisedCents: number;
      giftCents: number;
      offsetLabel: string;
    };
    expect(b).toMatchObject({ goalCents: 2_000_000, offsetCents: 750_000, giftCents: 2500, raisedCents: 752_500, offsetLabel: 'from tickets' });
    const bad = await SELF.fetch('https://cg.test/api/admin/settings', {
      method: 'PUT',
      headers: { ...ADMIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalCents: -5 }),
    });
    expect(bad.status).toBe(400);
  });

  it('exports a CSV with the private columns', async () => {
    await post('/api/donations', gift({ anonymous: true, name: 'Secret Donor' }));
    const r = await SELF.fetch('https://cg.test/api/admin/export.csv', { headers: ADMIN });
    expect(r.headers.get('content-type')).toContain('text/csv');
    const text = await r.text();
    expect(text.split('\n').length).toBe(2);
    expect(text).toContain('maria@example.com');
    expect(text).toContain('"yes"');
  });
});
