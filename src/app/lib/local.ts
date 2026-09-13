import type { PublicDonation } from '@shared/donations';

/**
 * Remembered on this phone only: the donor's name and email so a second gift
 * is two taps, and the gifts made here so the thank-you screen survives a
 * reload. Nothing here is a credential.
 */
const DONOR_KEY = 'cg:donor';
const GIFTS_KEY = 'cg:gifts';

export interface RememberedDonor {
  name: string;
  email: string;
  anonymous: boolean;
}

export interface MyGift {
  donation: PublicDonation;
  receiptUrl: string | null;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode, quota: nothing to do
  }
}

export const loadDonor = (): RememberedDonor => read<RememberedDonor>(DONOR_KEY) ?? { name: '', email: '', anonymous: false };
export const saveDonor = (d: RememberedDonor) => write(DONOR_KEY, d);

export const myGifts = (): MyGift[] => read<MyGift[]>(GIFTS_KEY) ?? [];
export function rememberGift(g: MyGift) {
  const gifts = myGifts().filter((x) => x.donation.id !== g.donation.id);
  write(GIFTS_KEY, [g, ...gifts].slice(0, 20));
}
export const findGift = (id: string): MyGift | null => myGifts().find((g) => g.donation.id === id) ?? null;
