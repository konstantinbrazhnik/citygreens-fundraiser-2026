import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  applySettings,
  DEFAULT_GOAL_CENTS,
  parseSettingsPatch,
  RECENT_LIMIT,
  type BoardSettings,
  type BoardSnapshot,
} from '../../shared/board';
import { EVENT, ORG } from '../../shared/campaign';
import {
  cleanText,
  MAX_MESSAGE,
  MAX_NAME,
  parseAmountCents,
  parseDonationRequest,
  UUID,
  type DonationSource,
  type PublicDonation,
} from '../../shared/donations';
import type { BoardMessage } from '../../shared/messages';
import { parseSubscribeRequest } from '../../shared/newsletter';
import { subscribeToMailchimp } from './mailchimp';
import { createSquarePayment, squareConfigured, SquareError } from './square';

export { DonationBoard } from './board';

const app = new Hono<{ Bindings: Env }>();

/* ── helpers ─────────────────────────────────────────────────────────── */

interface DonationRow {
  id: string;
  amount_cents: number;
  donor_name: string | null;
  anonymous: number;
  message: string | null;
  email: string | null;
  source: DonationSource;
  square_payment_id: string | null;
  receipt_url: string | null;
  card_brand: string | null;
  card_last4: string | null;
  status: string;
  created_at: string;
}

const PUBLIC_COLS = 'id, amount_cents, donor_name, anonymous, message, source, created_at';

function toPublic(r: Pick<DonationRow, 'id' | 'amount_cents' | 'donor_name' | 'anonymous' | 'message' | 'source' | 'created_at'>): PublicDonation {
  return {
    id: r.id,
    amountCents: r.amount_cents,
    name: r.anonymous ? null : r.donor_name,
    message: r.message,
    createdAt: r.created_at,
    source: r.source,
  };
}

async function readSettings(env: Env): Promise<BoardSettings> {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const map = new Map(results.map((r) => [r.key, r.value]));
  const goalFromVar = Number(env.GOAL_CENTS);
  return {
    goalCents: Number(map.get('goal_cents') ?? (Number.isFinite(goalFromVar) && goalFromVar > 0 ? goalFromVar : DEFAULT_GOAL_CENTS)),
    offsetCents: Number(map.get('offset_cents') ?? 0),
    offsetLabel: map.get('offset_label') ?? '',
  };
}

async function writeSettings(env: Env, s: BoardSettings): Promise<void> {
  const stmt = env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  await env.DB.batch([
    stmt.bind('goal_cents', String(s.goalCents)),
    stmt.bind('offset_cents', String(s.offsetCents)),
    stmt.bind('offset_label', s.offsetLabel),
  ]);
}

async function snapshot(env: Env): Promise<BoardSnapshot> {
  const settings = await readSettings(env);
  const [totals, recent, largest] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS n FROM donations WHERE status = 'completed'"),
    env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM donations WHERE status = 'completed' ORDER BY created_at DESC, rowid DESC LIMIT ?`).bind(RECENT_LIMIT),
    env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM donations WHERE status = 'completed' ORDER BY amount_cents DESC, created_at ASC LIMIT 1`),
  ]);
  const t = (totals.results[0] ?? { total: 0, n: 0 }) as { total: number; n: number };
  const base: BoardSnapshot = {
    ...settings,
    giftCents: t.total,
    raisedCents: t.total,
    count: t.n,
    recent: (recent.results as DonationRow[]).map(toPublic),
    largest: largest.results[0] ? toPublic(largest.results[0] as DonationRow) : null,
    generatedAt: new Date().toISOString(),
  };
  return applySettings(base, settings);
}

async function broadcast(env: Env, message: BoardMessage): Promise<void> {
  try {
    const stub = env.BOARD.get(env.BOARD.idFromName('main'));
    await stub.broadcast(message);
  } catch (err) {
    // A gift is recorded even if the megaphone hiccups; the board catches up on its next snapshot.
    console.error('broadcast failed', err);
  }
}

function noStore(c: Context) {
  c.header('Cache-Control', 'no-store');
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.byteLength !== bb.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < ab.byteLength; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

/* ── public ──────────────────────────────────────────────────────────── */

app.use('/api/*', async (c, next) => {
  noStore(c);
  await next();
});

app.get('/api/version', (c) => c.json({ environment: c.env.ENVIRONMENT, paymentsMode: c.env.PAYMENTS_MODE }));

app.get('/api/config', (c) => {
  const env = c.env;
  const mode = env.PAYMENTS_MODE === 'simulated' ? 'simulated' : 'square';
  const square =
    mode === 'square' && squareConfigured(env)
      ? { applicationId: env.SQUARE_APPLICATION_ID!, locationId: env.SQUARE_LOCATION_ID!, env: env.SQUARE_ENV === 'sandbox' ? 'sandbox' : 'production' }
      : null;
  return c.json({
    environment: env.ENVIRONMENT,
    paymentsMode: mode,
    paymentsReady: mode === 'simulated' || square !== null,
    square,
    org: ORG,
    event: EVENT,
  });
});

app.get('/api/board', async (c) => c.json(await snapshot(c.env)));

app.get('/api/board/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return c.text('expected websocket', 426);
  const stub = c.env.BOARD.get(c.env.BOARD.idFromName('main'));
  return stub.fetch(c.req.raw);
});

app.get('/api/donations/:id', async (c) => {
  const id = c.req.param('id').toLowerCase();
  if (!UUID.test(id)) return c.json({ error: 'Not found.' }, 404);
  const row = await c.env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM donations WHERE id = ? AND status = 'completed'`).bind(id).first<DonationRow>();
  if (!row) return c.json({ error: 'Not found.' }, 404);
  return c.json({ donation: toPublic(row) });
});

app.post('/api/donations', async (c) => {
  const env = c.env;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed request.' }, 400);
  }
  const parsed = parseDonationRequest(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const d = parsed.value;

  // Idempotent: a phone that retries after a dropped response gets the same answer.
  const existing = await env.DB.prepare('SELECT * FROM donations WHERE id = ?').bind(d.id).first<DonationRow>();
  if (existing) {
    return c.json({ donation: toPublic(existing), receiptUrl: existing.receipt_url, replay: true });
  }

  let source: DonationSource;
  let paymentId: string | null = null;
  let receiptUrl: string | null = null;
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;

  if (env.PAYMENTS_MODE === 'simulated') {
    if (!d.sourceId.startsWith('sim-')) return c.json({ error: 'Simulated mode only accepts simulated cards.' }, 400);
    if (d.sourceId === 'sim-decline') return c.json({ error: 'Your card was declined. Please try another card.', code: 'CARD_DECLINED' }, 402);
    source = 'simulated';
    paymentId = `sim_${d.id}`;
    cardBrand = 'TEST';
    cardLast4 = '0000';
  } else {
    if (!squareConfigured(env)) {
      return c.json({ error: 'Card payments are not set up yet. Please give at the Givebutter link instead.', code: 'PAYMENTS_UNAVAILABLE' }, 503);
    }
    try {
      const r = await createSquarePayment(env, {
        id: d.id,
        sourceId: d.sourceId,
        amountCents: d.amountCents,
        email: d.email,
        note: `${EVENT.name} gift${d.name ? ` from ${d.name}` : ' (anonymous)'}`,
        verificationToken: d.verificationToken,
      });
      source = 'square';
      paymentId = r.paymentId;
      receiptUrl = r.receiptUrl;
      cardBrand = r.cardBrand;
      cardLast4 = r.cardLast4;
    } catch (err) {
      if (err instanceof SquareError) return c.json({ error: err.message, code: err.code }, err.status as 402);
      console.error('payment failed', err);
      return c.json({ error: 'The payment did not go through. Please try again.', code: 'UNKNOWN' }, 502);
    }
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO donations (id, amount_cents, donor_name, anonymous, message, email, source, square_payment_id, receipt_url, card_brand, card_last4)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(d.id, d.amountCents, d.name, d.anonymous ? 1 : 0, d.message, d.email, source, paymentId, receiptUrl, cardBrand, cardLast4)
    .run();
  const row = await env.DB.prepare('SELECT * FROM donations WHERE id = ?').bind(d.id).first<DonationRow>();
  if (!row) return c.json({ error: 'The gift was charged but could not be recorded. Please show this screen to a volunteer.' }, 500);
  const pub = toPublic(row);
  c.executionCtx.waitUntil(broadcast(env, { type: 'donation.new', payload: pub, ts: Date.now() }));
  return c.json({ donation: pub, receiptUrl: row.receipt_url }, 201);
});

app.post('/api/newsletter', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed request.' }, 400);
  }
  const parsed = parseSubscribeRequest(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const s = parsed.value;
  const outcome = await subscribeToMailchimp(c.env, s);
  const synced = outcome === 'subscribed' || outcome === 'already' ? 1 : 0;
  await c.env.DB.prepare(
    `INSERT INTO subscribers (id, email, first_name, last_name, synced) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET first_name = COALESCE(excluded.first_name, first_name), last_name = COALESCE(excluded.last_name, last_name), synced = MAX(synced, excluded.synced)`,
  )
    .bind(crypto.randomUUID(), s.email, s.firstName, s.lastName, synced)
    .run();
  return c.json({ ok: true, outcome: outcome === 'failed' ? 'saved' : outcome });
});

/* ── admin ───────────────────────────────────────────────────────────── */

const admin = new Hono<{ Bindings: Env }>();

admin.use('*', async (c, next) => {
  const key = c.env.ADMIN_KEY;
  if (!key) return c.json({ error: 'Admin is not enabled: set the ADMIN_KEY secret.' }, 503);
  const given = c.req.header('x-admin-key') ?? c.req.query('key') ?? '';
  if (!given || !timingSafeEqual(given, key)) return c.json({ error: 'Wrong key.' }, 401);
  await next();
});

admin.get('/ping', (c) => c.json({ ok: true }));

admin.get('/donations', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM donations ORDER BY created_at DESC, rowid DESC LIMIT 500').all<DonationRow>();
  return c.json({ donations: results });
});

admin.get('/export.csv', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM donations ORDER BY created_at ASC').all<DonationRow>();
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['id', 'created_at', 'amount_usd', 'donor_name', 'anonymous', 'email', 'message', 'source', 'square_payment_id', 'card', 'status'].join(','),
    ...results.map((r) =>
      [r.id, r.created_at, (r.amount_cents / 100).toFixed(2), r.donor_name, r.anonymous ? 'yes' : 'no', r.email, r.message, r.source, r.square_payment_id, r.card_brand ? `${r.card_brand} ${r.card_last4}` : '', r.status]
        .map(esc)
        .join(','),
    ),
  ];
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="growing-city-greens-gifts.csv"');
  return c.body(lines.join('\n'));
});

/** A paddle raise, a check, cash in the jar: put it on the board by hand. */
admin.post('/donations', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed request.' }, 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const amount = parseAmountCents(b.amountCents);
  if (!amount.ok) return c.json({ error: amount.error }, 400);
  const anonymous = b.anonymous === true;
  const name = anonymous ? null : cleanText(b.name, MAX_NAME);
  if (!anonymous && !name) return c.json({ error: 'Name, or anonymous.' }, 400);
  const message = cleanText(b.message, MAX_MESSAGE);
  const id = typeof b.id === 'string' && UUID.test(b.id) ? b.id.toLowerCase() : crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO donations (id, amount_cents, donor_name, anonymous, message, source) VALUES (?, ?, ?, ?, ?, 'manual')`,
  )
    .bind(id, amount.value, name, anonymous ? 1 : 0, message)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM donations WHERE id = ?').bind(id).first<DonationRow>();
  const pub = toPublic(row!);
  c.executionCtx.waitUntil(broadcast(c.env, { type: 'donation.new', payload: pub, ts: Date.now() }));
  return c.json({ donation: pub }, 201);
});

admin.delete('/donations/:id', async (c) => {
  const id = c.req.param('id').toLowerCase();
  if (!UUID.test(id)) return c.json({ error: 'Not found.' }, 404);
  const r = await c.env.DB.prepare("UPDATE donations SET status = 'hidden' WHERE id = ? AND status = 'completed'").bind(id).run();
  if (!r.meta.changes) return c.json({ error: 'Not found.' }, 404);
  c.executionCtx.waitUntil(broadcast(c.env, { type: 'donation.hidden', payload: { id }, ts: Date.now() }));
  return c.json({ ok: true });
});

admin.get('/settings', async (c) => c.json(await readSettings(c.env)));

admin.put('/settings', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed request.' }, 400);
  }
  const current = await readSettings(c.env);
  const parsed = parseSettingsPatch(body, current);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  await writeSettings(c.env, parsed.value);
  c.executionCtx.waitUntil(broadcast(c.env, { type: 'board.settings', payload: parsed.value, ts: Date.now() }));
  return c.json(parsed.value);
});

admin.get('/subscribers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 1000').all();
  return c.json({ subscribers: results });
});

app.route('/api/admin', admin);

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found.' }, 404) : c.env.ASSETS.fetch(c.req.raw)));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
