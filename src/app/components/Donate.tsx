import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { formatMoney, MAX_CENTS, MAX_MESSAGE, MAX_NAME, MIN_CENTS, outcomeFor, parseAmountCents, PRESETS } from '@shared/donations';
import { EVENT } from '@shared/campaign';
import { ApiError, getConfig, postDonation, type AppConfig } from '../lib/api';
import { celebrateGift } from '../lib/celebrate';
import type { LiveBoard } from '../lib/live';
import { loadDonor, rememberGift, saveDonor } from '../lib/local';
import type { Route } from '../lib/router';
import { CARD_STYLE, dollars, loadSquare, type SquareCard, type SquarePaymentRequest, type SquarePayments, type SquareWallet, type TokenResult } from '../lib/square';
import { uuid } from '../lib/uuid';
import { Section, TopBar } from './Chrome';

type PayState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'simulated' }
  | { kind: 'unavailable'; reason: string };

export function Donate({ live, navigate, presetCents }: { live: LiveBoard; navigate: (r: Route) => void; presetCents?: number }) {
  const remembered = useMemo(loadDonor, []);
  const [amountCents, setAmountCents] = useState<number>(presetCents && presetCents >= MIN_CENTS ? presetCents : 5_000);
  const [custom, setCustom] = useState<string>(presetCents && !PRESETS.some((p) => p.cents === presetCents) ? String(presetCents / 100) : '');
  const [customOpen, setCustomOpen] = useState<boolean>(Boolean(custom));
  const [name, setName] = useState(remembered.name);
  const [anonymous, setAnonymous] = useState(remembered.anonymous);
  const [email, setEmail] = useState(remembered.email);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<PayState>({ kind: 'loading' });
  const [wallets, setWallets] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });

  const config = useRef<AppConfig | null>(null);
  const payments = useRef<SquarePayments | null>(null);
  const card = useRef<SquareCard | null>(null);
  const paymentRequest = useRef<SquarePaymentRequest | null>(null);
  const googlePay = useRef<SquareWallet | null>(null);
  const applePay = useRef<SquareWallet | null>(null);
  const giftId = useRef(uuid());
  const cardHost = useRef<HTMLDivElement | null>(null);
  const googleHost = useRef<HTMLDivElement | null>(null);

  /* The three steps of the form, for auto-advancing between them. */
  const amountStep = useRef<HTMLDivElement | null>(null);
  const detailsStep = useRef<HTMLDivElement | null>(null);
  const paymentStep = useRef<HTMLDivElement | null>(null);
  const nameField = useRef<HTMLInputElement | null>(null);
  const messageField = useRef<HTMLInputElement | null>(null);
  const emailField = useRef<HTMLInputElement | null>(null);

  /** Scroll a step to the top of the screen and, optionally, put the cursor in its first field. */
  const goTo = (step: HTMLElement | null, field?: HTMLInputElement | null) => {
    if (!step) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    step.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    field?.focus({ preventScroll: true });
  };
  const goToDetails = () => goTo(detailsStep.current, anonymous ? messageField.current : nameField.current);
  const goToPayment = () => goTo(paymentStep.current);
  /** Enter in a text field moves on instead of submitting the form. */
  const nextOnEnter = (next: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    next();
  };

  const preset = outcomeFor(amountCents);
  const amountOk = parseAmountCents(amountCents);

  /* Load config, then Square. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getConfig();
        if (cancelled) return;
        config.current = cfg;
        if (cfg.paymentsMode === 'simulated') {
          setPay({ kind: 'simulated' });
          return;
        }
        if (!cfg.square) {
          setPay({ kind: 'unavailable', reason: 'Card payments are still being set up.' });
          return;
        }
        await loadSquare(cfg.square.env);
        if (cancelled || !window.Square) return;
        const p = window.Square.payments(cfg.square.applicationId, cfg.square.locationId);
        payments.current = p;
        const c = await p.card({ style: CARD_STYLE });
        if (cancelled) {
          void c.destroy();
          return;
        }
        card.current = c;
        if (cardHost.current) await c.attach(cardHost.current);
        setPay({ kind: 'ready' });

        // Wallets are a bonus: any failure just leaves the card form.
        try {
          const req = p.paymentRequest({
            countryCode: 'US',
            currencyCode: 'USD',
            total: { amount: dollars(amountCents), label: EVENT.shortName },
          });
          paymentRequest.current = req;
          const [g, a] = await Promise.allSettled([p.googlePay(req), p.applePay(req)]);
          if (cancelled) return;
          if (g.status === 'fulfilled') {
            googlePay.current = g.value;
            if (googleHost.current && g.value.attach) {
              await g.value.attach(googleHost.current, { buttonColor: 'black', buttonType: 'long', buttonSizeMode: 'fill' });
              setWallets((w) => ({ ...w, google: true }));
            }
          }
          if (a.status === 'fulfilled') {
            applePay.current = a.value;
            setWallets((w) => ({ ...w, apple: true }));
          }
        } catch {
          // no wallets
        }
      } catch (err) {
        if (cancelled) return;
        setPay({ kind: 'unavailable', reason: err instanceof Error ? err.message : 'Could not load the card form.' });
      }
    })();
    return () => {
      cancelled = true;
      void card.current?.destroy();
      void googlePay.current?.destroy();
      void applePay.current?.destroy();
      card.current = null;
      googlePay.current = null;
      applePay.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep the wallet sheet's total in step with the chosen amount. */
  useEffect(() => {
    if (amountOk.ok) paymentRequest.current?.update({ total: { amount: dollars(amountCents), label: EVENT.shortName } });
  }, [amountCents, amountOk.ok]);

  const chooseCustom = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    setCustom(cleaned);
    const n = Math.round(Number(cleaned) * 100);
    if (Number.isFinite(n) && n > 0) setAmountCents(n);
  };

  const verification = () => {
    const parts = name.trim().split(' ').filter(Boolean);
    return {
      amount: dollars(amountCents),
      currencyCode: 'USD' as const,
      intent: 'CHARGE' as const,
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: {
        givenName: anonymous ? undefined : parts[0],
        familyName: anonymous ? undefined : parts.slice(1).join(' ') || undefined,
        email: email.trim() || undefined,
        countryCode: 'US',
      },
    };
  };

  const validate = (): string | null => {
    if (!amountOk.ok) return amountOk.error;
    if (!anonymous && !name.trim()) return 'Tell us your name, or choose to give anonymously.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'That email address does not look right.';
    return null;
  };

  const complete = async (sourceId: string, verificationToken: string | null) => {
    const receipt = await postDonation({
      id: giftId.current,
      amountCents,
      name: anonymous ? null : name.trim(),
      anonymous,
      message: message.trim() || null,
      email: email.trim() || null,
      sourceId,
      verificationToken,
    });
    saveDonor({ name: name.trim(), email: email.trim(), anonymous });
    rememberGift(receipt);
    giftId.current = uuid();
    celebrateGift(amountCents);
    navigate({ name: 'thanks', id: receipt.donation.id });
  };

  const tokenizeAndPay = async (getToken: () => Promise<TokenResult>) => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await getToken();
      if (result.status === 'Cancel' || result.status === 'Abort') return;
      if (result.status !== 'OK' || !result.token) {
        setError(result.errors?.[0]?.message ?? 'Please check the card details and try again.');
        return;
      }
      await complete(result.token, null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'IDEMPOTENCY_KEY_REUSED') giftId.current = uuid();
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmitCard = (e: FormEvent) => {
    e.preventDefault();
    if (pay.kind === 'simulated') {
      void tokenizeAndPay(async () => ({ status: 'OK', token: 'sim-ok' }));
      return;
    }
    if (pay.kind !== 'ready' || !card.current) return;
    const c = card.current;
    void tokenizeAndPay(() => c.tokenize(verification()));
  };

  return (
    <>
      <TopBar
        live={live}
        navigate={navigate}
        back={{ name: 'home' }}
        chip={
          <button
            type="button"
            onClick={() => goTo(amountStep.current)}
            className="min-h-11 rounded-full bg-gold px-3.5 py-1.5 text-right text-ink ring-2 ring-cream/70 shadow-lg"
            aria-label={amountOk.ok ? `Your gift is ${formatMoney(amountCents)}. Change amount` : 'Choose an amount'}
            data-testid="gift-chip"
          >
            <span className="block text-[0.8rem] font-extrabold uppercase tracking-wider text-ink/70">Your gift</span>
            <span className="block text-[1.2rem] font-black leading-none" data-testid="gift-chip-amount">
              {amountOk.ok ? formatMoney(amountCents) : '—'}
            </span>
          </button>
        }
      />
      <form onSubmit={onSubmitCard} className="pb-16">
        <Section className="pt-6">
          <div ref={amountStep} className="scroll-mt-24" />
          <h1 className="text-[2rem] font-black leading-tight">Choose your gift</h1>
          <p className="mt-1 text-[1.1rem] font-semibold text-cream/90">Every dollar goes toward opening City Greens in Dutchtown.</p>

          <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Gift amount">
            {PRESETS.map((p) => {
              const selected = !customOpen && amountCents === p.cents;
              return (
                <button
                  key={p.cents}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`amount-${p.cents}`}
                  onClick={() => {
                    setCustomOpen(false);
                    setCustom('');
                    setAmountCents(p.cents);
                    goToDetails();
                  }}
                  className={`rounded-2xl p-3 text-left ring-4 transition active:scale-[0.98] ${
                    selected ? 'bg-gold text-ink ring-cream shadow-xl' : 'bg-cream/10 text-cream ring-transparent hover:ring-gold/40'
                  }`}
                >
                  <span className="block text-[1.7rem] font-black leading-none">{formatMoney(p.cents)}</span>
                  <span className={`mt-1.5 block text-[0.95rem] font-bold leading-snug ${selected ? 'text-ink/85' : 'text-cream/85'}`}>{p.outcome}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={customOpen}
              data-testid="amount-custom"
              onClick={() => setCustomOpen(true)}
              className={`col-span-2 rounded-2xl p-3 text-left ring-4 transition ${customOpen ? 'bg-gold text-ink ring-cream shadow-xl' : 'bg-cream/10 text-cream ring-transparent'}`}
            >
              <span className="block text-[1.4rem] font-black">Another amount</span>
              {customOpen && (
                <span className="mt-2 flex items-center gap-2">
                  <span className="text-[1.8rem] font-black">$</span>
                  <input
                    className="field text-[1.6rem] font-black"
                    inputMode="decimal"
                    autoFocus
                    placeholder="0"
                    enterKeyHint="next"
                    value={custom}
                    onChange={(e) => chooseCustom(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={nextOnEnter(() => amountOk.ok && goToDetails())}
                    aria-label="Amount in dollars"
                  />
                </span>
              )}
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-cream/10 p-4 ring-1 ring-gold/40" aria-live="polite">
            <p className="text-[1.05rem] font-extrabold uppercase tracking-wider text-gold">
              {preset.emoji} {formatMoney(amountCents)} does this
            </p>
            <p className="mt-1 text-[1.15rem] font-bold leading-snug">{preset.outcome}</p>
            <p className="mt-1 text-[1rem] font-semibold text-cream/85">{preset.detail}</p>
            {!amountOk.ok && (
              <p className="mt-2 text-[1rem] font-bold text-peach">
                {amountCents > MAX_CENTS ? amountOk.error : `The minimum gift is ${formatMoney(MIN_CENTS)}.`}
              </p>
            )}
            <button type="button" onClick={goToDetails} disabled={!amountOk.ok} className="btn btn-gold mt-4 w-full text-[1.2rem] disabled:opacity-50" data-testid="next-details">
              Next: your name ↓
            </button>
          </div>
        </Section>

        <Section className="pt-6">
          <div ref={detailsStep} className="card scroll-mt-24 p-5">
            <label className="label" htmlFor="donor-name">
              Your name, for the board
            </label>
            <input
              ref={nameField}
              id="donor-name"
              className="field"
              placeholder="Maria Gonzalez"
              autoComplete="name"
              enterKeyHint="next"
              maxLength={MAX_NAME}
              value={name}
              disabled={anonymous}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={nextOnEnter(() => messageField.current?.focus())}
              data-testid="donor-name"
            />
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-[1.1rem] font-extrabold text-forest-deep">
              <input type="checkbox" className="h-7 w-7 accent-leaf" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} data-testid="anonymous" />
              Give anonymously
            </label>
            <p className="mt-1 text-[0.95rem] font-semibold text-ink/70">
              {anonymous ? 'The board will show “Anonymous”. Your gift still counts.' : 'Shown on the big board tonight and on this page.'}
            </p>

            <label className="label mt-5" htmlFor="donor-message">
              A word for the wall <span className="font-semibold text-ink/60">(optional)</span>
            </label>
            <input
              ref={messageField}
              id="donor-message"
              className="field"
              placeholder="For the Midtown Mamas 💚"
              enterKeyHint="next"
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={nextOnEnter(() => emailField.current?.focus())}
            />

            <label className="label mt-5" htmlFor="donor-email">
              Email for your receipt <span className="font-semibold text-ink/60">(optional)</span>
            </label>
            <input
              ref={emailField}
              id="donor-email"
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={nextOnEnter(goToPayment)}
              data-testid="donor-email"
            />
            <button type="button" onClick={goToPayment} className="btn btn-leaf mt-5 w-full text-[1.2rem]" data-testid="next-payment">
              Next: payment ↓
            </button>
          </div>
        </Section>

        <Section className="pt-6">
          <div ref={paymentStep} className="card scroll-mt-24 p-5">
            <h2 className="text-[1.4rem] font-black text-forest-deep">Payment</h2>

            {pay.kind === 'loading' && <p className="mt-3 text-[1.05rem] font-bold text-ink/70">Loading secure card form…</p>}

            {pay.kind === 'unavailable' && (
              <div className="mt-3 rounded-2xl bg-peach/30 p-4 text-[1.05rem] font-bold text-ink" role="alert">
                <p>{pay.reason}</p>
                <a href={EVENT.ticketsUrl} target="_blank" rel="noopener" className="btn btn-leaf mt-3 w-full">
                  Give on the event page instead
                </a>
              </div>
            )}

            {pay.kind === 'simulated' && (
              <div className="mt-3 rounded-2xl bg-lime/30 p-4 text-[1.05rem] font-bold text-ink" data-testid="simulated-banner">
                Test mode: no card is charged. Tapping Give records a practice gift on the board.
              </div>
            )}

            {(wallets.google || wallets.apple) && (
              <div className="mt-4 space-y-3">
                {wallets.apple && (
                  <button type="button" className="apple-pay-button" aria-label="Donate with Apple Pay" disabled={busy} onClick={() => applePay.current && void tokenizeAndPay(() => applePay.current!.tokenize())} />
                )}
                <div ref={googleHost} onClick={() => googlePay.current && !busy && void tokenizeAndPay(() => googlePay.current!.tokenize())} />
                <p className="text-center text-[1rem] font-extrabold uppercase tracking-wider text-ink/60">or pay with a card</p>
              </div>
            )}

            <div ref={cardHost} id="card-container" className={`mt-4 ${pay.kind === 'ready' ? '' : 'hidden'}`} />

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[1.05rem] font-bold text-red-800" role="alert" data-testid="pay-error">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-gold mt-5 w-full text-[1.5rem]" disabled={busy || pay.kind === 'loading' || pay.kind === 'unavailable' || !amountOk.ok} data-testid="give">
              {busy ? 'Sending your gift…' : `Give ${amountOk.ok ? formatMoney(amountCents) : ''}`}
            </button>
            <p className="mt-3 text-center text-[0.95rem] font-semibold text-ink/70">🔒 Secure checkout by Square. City Greens Market is a 501(c)(3); gifts are tax-deductible.</p>
          </div>
        </Section>
      </form>
    </>
  );
}
