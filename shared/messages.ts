import type { BoardSettings } from './board';
import type { PublicDonation } from './donations';

/**
 * Every frame the DonationBoard fans out. The app and the Worker import this
 * one file; add a type here or the message does not exist.
 */
export type BoardMessage =
  | { type: 'donation.new'; payload: PublicDonation; ts: number }
  | { type: 'donation.hidden'; payload: { id: string }; ts: number }
  | { type: 'board.settings'; payload: BoardSettings; ts: number }
  | { type: 'board.hello'; payload: { clients: number }; ts: number };

const TYPES = new Set<string>(['donation.new', 'donation.hidden', 'board.settings', 'board.hello']);

export function parseBoardMessage(raw: unknown): BoardMessage | null {
  if (typeof raw !== 'string') return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  if (typeof m.type !== 'string' || !TYPES.has(m.type)) return null;
  if (!m.payload || typeof m.payload !== 'object') return null;
  if (typeof m.ts !== 'number') return null;
  return m as unknown as BoardMessage;
}
