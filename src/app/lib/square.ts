/**
 * The slice of Square's Web Payments SDK this app touches. The SDK is loaded
 * from Square's CDN at runtime (it must be; it is not an npm package), so the
 * types are declared here rather than imported.
 */
export interface TokenResult {
  status: 'OK' | 'Cancel' | 'Error' | 'Invalid' | 'Abort';
  token?: string;
  errors?: { message?: string; type?: string }[];
}

export interface VerificationDetails {
  amount: string;
  currencyCode: 'USD';
  intent: 'CHARGE';
  customerInitiated: boolean;
  sellerKeyedIn: boolean;
  billingContact: { givenName?: string; familyName?: string; email?: string; countryCode?: string };
}

export interface SquareCard {
  attach(target: string | HTMLElement): Promise<void>;
  tokenize(details?: VerificationDetails): Promise<TokenResult>;
  destroy(): Promise<boolean>;
}

export interface SquarePaymentRequest {
  update(options: { total: { amount: string; label: string } }): boolean;
}

export interface SquareWallet {
  attach?(target: string | HTMLElement, options?: Record<string, string>): Promise<void>;
  tokenize(): Promise<TokenResult>;
  destroy(): Promise<boolean>;
}

export interface SquarePayments {
  card(options?: { style?: Record<string, Record<string, string>> }): Promise<SquareCard>;
  paymentRequest(options: {
    countryCode: string;
    currencyCode: string;
    total: { amount: string; label: string };
    requestBillingContact?: boolean;
  }): SquarePaymentRequest;
  googlePay(req: SquarePaymentRequest): Promise<SquareWallet>;
  applePay(req: SquarePaymentRequest): Promise<SquareWallet>;
}

declare global {
  interface Window {
    Square?: { payments(applicationId: string, locationId: string): SquarePayments };
  }
}

const SDK_URL = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
} as const;

let loading: Promise<void> | null = null;

export function loadSquare(env: 'sandbox' | 'production'): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL[env];
    s.async = true;
    s.onload = () => (window.Square ? resolve() : reject(new Error('Square SDK did not initialise.')));
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the card form. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Cents → "50.00", the string the SDK wants everywhere. */
export const dollars = (cents: number) => (cents / 100).toFixed(2);

export const CARD_STYLE = {
  input: { fontSize: '18px', color: '#141414' },
  '.input-container': { borderColor: '#c9d6bd', borderRadius: '16px', borderWidth: '3px' },
  '.input-container.is-focus': { borderColor: '#558632' },
  '.input-container.is-error': { borderColor: '#b3261e' },
  '.message-text': { color: '#5b5555' },
  '.message-icon': { color: '#5b5555' },
  '.message-text.is-error': { color: '#b3261e' },
  '.message-icon.is-error': { color: '#b3261e' },
  'input::placeholder': { color: '#7c8a72' },
} as const;
