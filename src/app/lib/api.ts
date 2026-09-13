import type { BoardSettings, BoardSnapshot } from '@shared/board';
import type { EVENT, ORG } from '@shared/campaign';
import type { PublicDonation } from '@shared/donations';

export interface AppConfig {
  environment: string;
  paymentsMode: 'square' | 'simulated';
  paymentsReady: boolean;
  square: { applicationId: string; locationId: string; env: 'sandbox' | 'production' } | null;
  org: typeof ORG;
  event: typeof EVENT;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0, 'OFFLINE');
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error page
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: string; code?: string };
    throw new ApiError(j.error ?? `Request failed (${res.status}).`, res.status, j.code);
  }
  return json as T;
}

const json = (body: unknown, extra?: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(extra ?? {}) },
  body: JSON.stringify(body),
});

export const getConfig = () => request<AppConfig>('/api/config');
export const getBoard = () => request<BoardSnapshot>('/api/board');
export const getDonation = (id: string) => request<{ donation: PublicDonation }>(`/api/donations/${encodeURIComponent(id)}`);

export interface DonationPayload {
  id: string;
  amountCents: number;
  name: string | null;
  anonymous: boolean;
  message: string | null;
  email: string | null;
  sourceId: string;
  verificationToken: string | null;
}

export interface DonationReceipt {
  donation: PublicDonation;
  receiptUrl: string | null;
  replay?: boolean;
}

export const postDonation = (payload: DonationPayload) => request<DonationReceipt>('/api/donations', json(payload));

export const subscribe = (body: { email: string; firstName: string | null; lastName: string | null }) =>
  request<{ ok: true; outcome: 'subscribed' | 'already' | 'saved' }>('/api/newsletter', json(body));

/* admin */
const adminHeaders = (key: string) => ({ 'x-admin-key': key });

export const adminPing = (key: string) => request<{ ok: true }>('/api/admin/ping', { headers: adminHeaders(key) });
export const adminDonations = (key: string) =>
  request<{ donations: AdminDonation[] }>('/api/admin/donations', { headers: adminHeaders(key) });
export const adminAddDonation = (key: string, body: { amountCents: number; name: string | null; anonymous: boolean; message: string | null }) =>
  request<{ donation: PublicDonation }>('/api/admin/donations', json(body, adminHeaders(key)));
export const adminHideDonation = (key: string, id: string) =>
  request<{ ok: true }>(`/api/admin/donations/${encodeURIComponent(id)}`, { method: 'DELETE', headers: adminHeaders(key) });
export const adminGetSettings = (key: string) => request<BoardSettings>('/api/admin/settings', { headers: adminHeaders(key) });
export const adminPutSettings = (key: string, body: Partial<BoardSettings>) =>
  request<BoardSettings>('/api/admin/settings', { ...json(body, adminHeaders(key)), method: 'PUT' });
export const adminSubscribers = (key: string) =>
  request<{ subscribers: { email: string; first_name: string | null; last_name: string | null; synced: number; created_at: string }[] }>(
    '/api/admin/subscribers',
    { headers: adminHeaders(key) },
  );

export interface AdminDonation {
  id: string;
  amount_cents: number;
  donor_name: string | null;
  anonymous: number;
  message: string | null;
  email: string | null;
  source: string;
  square_payment_id: string | null;
  receipt_url: string | null;
  card_brand: string | null;
  card_last4: string | null;
  status: string;
  created_at: string;
}
