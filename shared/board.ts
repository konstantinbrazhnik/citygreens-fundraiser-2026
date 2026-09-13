import type { PublicDonation } from './donations';

export interface BoardSettings {
  goalCents: number;
  /** Money raised elsewhere (tickets, sponsors, pledges on paper) that counts on the board. */
  offsetCents: number;
  offsetLabel: string;
}

export interface BoardSnapshot extends BoardSettings {
  /** Gifts through this app only (excludes the offset). */
  giftCents: number;
  /** giftCents + offsetCents: the number on the wall. */
  raisedCents: number;
  count: number;
  /** Newest first. */
  recent: PublicDonation[];
  largest: PublicDonation | null;
  generatedAt: string;
}

export const RECENT_LIMIT = 60;
export const DEFAULT_GOAL_CENTS = 10_000_000;

export function percent(raised: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(100, (raised / goal) * 100));
}

export function emptySnapshot(settings: BoardSettings): BoardSnapshot {
  return {
    ...settings,
    giftCents: 0,
    raisedCents: settings.offsetCents,
    count: 0,
    recent: [],
    largest: null,
    generatedAt: new Date(0).toISOString(),
  };
}

/** Fold a live gift into a snapshot. Idempotent: the same id twice is a no-op. */
export function applyDonation(s: BoardSnapshot, d: PublicDonation): BoardSnapshot {
  if (s.recent.some((r) => r.id === d.id)) return s;
  const giftCents = s.giftCents + d.amountCents;
  return {
    ...s,
    giftCents,
    raisedCents: giftCents + s.offsetCents,
    count: s.count + 1,
    recent: [d, ...s.recent].slice(0, RECENT_LIMIT),
    largest: !s.largest || d.amountCents > s.largest.amountCents ? d : s.largest,
  };
}

export function removeDonation(s: BoardSnapshot, id: string): BoardSnapshot {
  const gone = s.recent.find((r) => r.id === id);
  if (!gone) return s;
  const recent = s.recent.filter((r) => r.id !== id);
  const giftCents = s.giftCents - gone.amountCents;
  return {
    ...s,
    giftCents,
    raisedCents: giftCents + s.offsetCents,
    count: Math.max(0, s.count - 1),
    recent,
    largest: recent.reduce<PublicDonation | null>((m, r) => (!m || r.amountCents > m.amountCents ? r : m), null),
  };
}

export function applySettings(s: BoardSnapshot, settings: BoardSettings): BoardSnapshot {
  return { ...s, ...settings, raisedCents: s.giftCents + settings.offsetCents };
}

/**
 * The 10% line a gift carried the total across, if any; `null` otherwise.
 * 100 fires once when the goal is met; nothing fires past it.
 */
export function milestoneCrossed(beforeCents: number, afterCents: number, goalCents: number): number | null {
  if (goalCents <= 0 || afterCents <= beforeCents) return null;
  const before = Math.floor(percent(beforeCents, goalCents) / 10) * 10;
  const after = Math.floor(percent(afterCents, goalCents) / 10) * 10;
  if (after <= before) return null;
  return Math.min(100, after);
}

export function parseSettingsPatch(
  body: unknown,
  current: BoardSettings,
): { ok: true; value: BoardSettings } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing body.' };
  const b = body as Record<string, unknown>;
  const next = { ...current };
  if (b.goalCents !== undefined) {
    if (typeof b.goalCents !== 'number' || !Number.isInteger(b.goalCents) || b.goalCents < 100 || b.goalCents > 1_000_000_000) {
      return { ok: false, error: 'Goal must be a whole number of cents, at least $1.' };
    }
    next.goalCents = b.goalCents;
  }
  if (b.offsetCents !== undefined) {
    if (typeof b.offsetCents !== 'number' || !Number.isInteger(b.offsetCents) || b.offsetCents < 0 || b.offsetCents > 1_000_000_000) {
      return { ok: false, error: 'Offset must be a whole number of cents, zero or more.' };
    }
    next.offsetCents = b.offsetCents;
  }
  if (b.offsetLabel !== undefined) {
    if (typeof b.offsetLabel !== 'string' || b.offsetLabel.length > 60) return { ok: false, error: 'Label is too long.' };
    next.offsetLabel = b.offsetLabel.trim();
  }
  return { ok: true, value: next };
}
