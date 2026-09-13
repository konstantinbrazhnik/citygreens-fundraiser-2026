/** Smallest and largest gift the form accepts, in cents. */
export const MIN_CENTS = 500;
export const MAX_CENTS = 2_500_000;
export const MAX_NAME = 40;
export const MAX_MESSAGE = 100;
export const MAX_EMAIL = 254;

export interface Preset {
  cents: number;
  /** One line under the dollar figure: what the gift does, concretely. */
  outcome: string;
  /** A little longer, shown once the amount is chosen. */
  detail: string;
  emoji: string;
}

/**
 * Tangible outcomes. Each one is anchored to a real City Greens number: the
 * $25 membership tier for an unemployed household, the $10–25 Give-a-Bag
 * gift cards, the 1:1 SNAP produce match. The two largest speak to the
 * capital campaign.
 */
export const PRESETS: readonly Preset[] = [
  {
    cents: 2_500,
    emoji: '🪪',
    outcome: 'A full year of membership for an unemployed household',
    detail: 'That is the exact price of the lowest tier. One family shops at cost for twelve months.',
  },
  {
    cents: 5_000,
    emoji: '🛒',
    outcome: 'Two $25 grocery gift cards on the Give-a-Bag wall',
    detail: 'A neighbor who is short this week takes one off the wall and puts it toward their groceries. No questions asked.',
  },
  {
    cents: 10_000,
    emoji: '🎁',
    outcome: 'Four $25 grocery gift cards on the Give-a-Bag wall',
    detail: 'Four neighbors get help with this week\'s groceries, straight from the wall by the register.',
  },
  {
    cents: 25_000,
    emoji: '🥕',
    outcome: 'Doubles $250 of fruit and vegetables for neighbors shopping with SNAP',
    detail: 'When a shopper pays for fruit and vegetables with SNAP, City Greens matches it dollar for dollar so they take home twice as much. Your gift funds that match.',
  },
  {
    cents: 50_000,
    emoji: '🏗️',
    outcome: 'Stocks a shelf of local food in the new Bevo Mill store',
    detail: 'The first season of farm-fresh food on a shelf in a neighborhood with no grocery store.',
  },
  {
    cents: 100_000,
    emoji: '🔑',
    outcome: 'A founding gift toward opening the doors in Bevo Mill',
    detail: 'Coolers, a walk-in, and the build-out that turns an empty storefront into a grocery store.',
  },
];

/** The preset whose outcome best describes an arbitrary amount (largest ≤ cents). */
export function outcomeFor(cents: number): Preset {
  let best = PRESETS[0]!;
  for (const p of PRESETS) if (p.cents <= cents) best = p;
  return best;
}

export type DonationSource = 'square' | 'simulated' | 'manual';

/** What everyone can see: the board, the ticker, the thank-you screen. */
export interface PublicDonation {
  id: string;
  amountCents: number;
  /** null when the donor asked to be anonymous. */
  name: string | null;
  message: string | null;
  createdAt: string;
  source: DonationSource;
}

export interface DonationRequest {
  id: string;
  amountCents: number;
  name: string | null;
  anonymous: boolean;
  message: string | null;
  email: string | null;
  sourceId: string;
  verificationToken: string | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Control characters (C0 + DEL); spelled with escapes so the source stays printable.
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** Trim, collapse whitespace, strip control characters, cap the length. */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max).trim() : t;
}

export function parseAmountCents(v: unknown): Parsed<number> {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: 'Amount must be a whole number of cents.' };
  }
  if (n < MIN_CENTS) return { ok: false, error: `The minimum gift is ${formatMoney(MIN_CENTS)}.` };
  if (n > MAX_CENTS) {
    return { ok: false, error: `For gifts over ${formatMoney(MAX_CENTS)}, please talk to us in person. We would love to.` };
  }
  return { ok: true, value: n };
}

export function parseDonationRequest(body: unknown): Parsed<DonationRequest> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing body.' };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return { ok: false, error: 'Missing donation id.' };
  const amount = parseAmountCents(b.amountCents);
  if (!amount.ok) return amount;
  const anonymous = b.anonymous === true;
  const name = anonymous ? null : cleanText(b.name, MAX_NAME);
  if (!anonymous && !name) return { ok: false, error: 'Tell us your name, or choose to give anonymously.' };
  const message = cleanText(b.message, MAX_MESSAGE);
  const emailRaw = cleanText(b.email, MAX_EMAIL);
  if (emailRaw && !EMAIL.test(emailRaw)) return { ok: false, error: 'That email address does not look right.' };
  if (typeof b.sourceId !== 'string' || !b.sourceId.trim() || b.sourceId.length > 200) {
    return { ok: false, error: 'Missing payment token.' };
  }
  const verificationToken =
    typeof b.verificationToken === 'string' && b.verificationToken ? b.verificationToken : null;
  return {
    ok: true,
    value: {
      id: b.id.toLowerCase(),
      amountCents: amount.value,
      name,
      anonymous,
      message,
      email: emailRaw ? emailRaw.toLowerCase() : null,
      sourceId: b.sourceId,
      verificationToken,
    },
  };
}

/** `$1,250`, or `$12.50` when there are cents to show. */
export function formatMoney(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const base = `$${whole.toLocaleString('en-US')}`;
  const s = rest === 0 ? base : `${base}.${String(rest).padStart(2, '0')}`;
  return cents < 0 ? `-${s}` : s;
}

export function displayName(d: Pick<PublicDonation, 'name'>): string {
  return d.name ?? 'Anonymous';
}

/** First name plus last initial: "Maria Gonzalez" → "Maria G." for the ticker. */
export function shortName(name: string | null): string {
  if (!name) return 'Someone';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2) return parts[0] ?? 'Someone';
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}
