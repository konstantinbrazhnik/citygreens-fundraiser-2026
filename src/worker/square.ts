/**
 * Square Payments API, called only from the Worker. The access token never
 * reaches a browser; the browser only ever holds a one-time card token from
 * the Web Payments SDK, which is useless without the token kept here.
 */
export class SquareError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface SquarePaymentInput {
  /** Also the idempotency key: a retry of the same gift can never double-charge. */
  id: string;
  sourceId: string;
  amountCents: number;
  email: string | null;
  note: string;
  verificationToken: string | null;
}

export interface SquarePaymentResult {
  paymentId: string;
  status: string;
  receiptUrl: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
}

type SquareEnv = Pick<Env, 'SQUARE_ENV' | 'SQUARE_VERSION' | 'SQUARE_ACCESS_TOKEN' | 'SQUARE_APPLICATION_ID' | 'SQUARE_LOCATION_ID'>;

export function squareHost(env: Pick<Env, 'SQUARE_ENV'>): string {
  return env.SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

export function squareConfigured(env: SquareEnv): boolean {
  return Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_APPLICATION_ID && env.SQUARE_LOCATION_ID);
}

/** What a donor should read when Square says no. Anything unknown gets the generic line. */
export function friendlySquareError(code: string): string {
  switch (code) {
    case 'CARD_DECLINED':
    case 'GENERIC_DECLINE':
    case 'CARD_DECLINED_CALL_ISSUER':
    case 'CARD_DECLINED_VERIFICATION_REQUIRED':
      return 'Your card was declined. Please try another card.';
    case 'INSUFFICIENT_FUNDS':
      return 'The card was declined for insufficient funds. Please try another card.';
    case 'CVV_FAILURE':
      return 'The security code (CVV) did not match. Please check it and try again.';
    case 'ADDRESS_VERIFICATION_FAILURE':
      return 'The ZIP code did not match the card. Please check it and try again.';
    case 'INVALID_EXPIRATION':
    case 'CARD_EXPIRED':
      return 'That card has expired or the expiration date is wrong.';
    case 'INVALID_CARD':
    case 'INVALID_CARD_DATA':
    case 'UNSUPPORTED_CARD_BRAND':
      return 'That card could not be used. Please try another card.';
    case 'CARD_TOKEN_EXPIRED':
    case 'CARD_TOKEN_USED':
      return 'The card entry timed out. Please enter your card again.';
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'This gift was already submitted.';
    default:
      return 'The payment did not go through. Please try again, or find a volunteer with a card reader.';
  }
}

interface SquareErrorBody {
  errors?: { code?: string; detail?: string; category?: string }[];
}

interface SquarePaymentBody {
  payment?: {
    id: string;
    status: string;
    receipt_url?: string;
    card_details?: { card?: { card_brand?: string; last_4?: string } };
  };
}

export async function createSquarePayment(env: SquareEnv, input: SquarePaymentInput): Promise<SquarePaymentResult> {
  if (!squareConfigured(env)) throw new SquareError('PAYMENTS_UNAVAILABLE', 'Card payments are not set up yet.', 503);
  const body: Record<string, unknown> = {
    source_id: input.sourceId,
    idempotency_key: input.id,
    amount_money: { amount: input.amountCents, currency: 'USD' },
    location_id: env.SQUARE_LOCATION_ID,
    note: input.note.slice(0, 500),
    reference_id: input.id.slice(0, 40),
    autocomplete: true,
  };
  if (input.email) body.buyer_email_address = input.email;
  if (input.verificationToken) body.verification_token = input.verificationToken;

  let res: Response;
  try {
    res = await fetch(`${squareHost(env)}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': env.SQUARE_VERSION,
        Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SquareError('UPSTREAM_UNREACHABLE', 'Could not reach the payment processor. Please try again.', 502);
  }

  let json: SquarePaymentBody & SquareErrorBody;
  try {
    json = (await res.json()) as SquarePaymentBody & SquareErrorBody;
  } catch {
    throw new SquareError('UPSTREAM_BAD_RESPONSE', friendlySquareError('UNKNOWN'), 502);
  }
  if (!res.ok || !json.payment) {
    const first = json.errors?.[0];
    const code = first?.code ?? 'UNKNOWN';
    console.error('square createPayment failed', res.status, JSON.stringify(json.errors ?? json));
    throw new SquareError(code, friendlySquareError(code), res.status === 401 || res.status === 403 ? 503 : 402);
  }
  const p = json.payment;
  if (p.status !== 'COMPLETED' && p.status !== 'APPROVED') {
    throw new SquareError(`PAYMENT_${p.status}`, friendlySquareError('UNKNOWN'), 402);
  }
  return {
    paymentId: p.id,
    status: p.status,
    receiptUrl: p.receipt_url ?? null,
    cardBrand: p.card_details?.card?.card_brand ?? null,
    cardLast4: p.card_details?.card?.last_4 ?? null,
  };
}
