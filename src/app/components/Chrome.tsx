import type { ReactNode } from 'react';
import { EVENT, ORG } from '@shared/campaign';
import { formatMoney } from '@shared/donations';
import type { LiveBoard } from '../lib/live';
import type { Route } from '../lib/router';

export function TopBar({ live, navigate, back }: { live: LiveBoard; navigate: (r: Route) => void; back?: Route }) {
  const s = live.snapshot;
  return (
    <header className="sticky top-0 z-30 bg-forest-deep/95 backdrop-blur" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => navigate(back ?? { name: 'home' })} className="flex min-h-11 items-center gap-2 text-left" aria-label={back ? 'Back' : 'Home'}>
          {back ? (
            <span className="text-[1.6rem] font-black leading-none">‹</span>
          ) : (
            <img src="/apple-logo.png" alt="" width="40" height="40" className="h-10 w-10" />
          )}
          <span className="font-black leading-tight">
            <span className="block text-[1.05rem]">{ORG.name}</span>
            <span className="block text-[0.95rem] text-gold">{EVENT.name}</span>
          </span>
        </button>
        {s && (
          <button type="button" onClick={() => navigate({ name: 'board' })} className="min-h-11 rounded-full bg-cream/10 px-3 py-1.5 text-right ring-2 ring-gold/50" aria-label="Open the live board">
            <span className="flex items-center justify-end gap-1.5 text-[0.9rem] font-extrabold uppercase tracking-wider text-gold">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${live.connected ? 'bg-lime anim-pulse-gold' : 'bg-cream/50'}`} />
              Live
            </span>
            <span className="block text-[1.05rem] font-black leading-none">{formatMoney(s.raisedCents)}</span>
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * The bottom-of-screen Donate bar. `visible={false}` slides it off-screen
 * (and hides it from assistive tech) so it does not double up with a Donate
 * button that is already on screen, e.g. the hero's.
 */
export function StickyDonate({ navigate, label = 'Donate now', visible = true }: { navigate: (r: Route) => void; label?: string; visible?: boolean }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-forest-deep via-forest-deep/95 to-transparent px-4 pt-6 transition-[transform,opacity,visibility] duration-300 ease-out motion-reduce:transition-none ${
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-full opacity-0'
      }`}
      style={{ paddingBottom: 'calc(0.9rem + var(--safe-bottom))' }}
      aria-hidden={!visible}
      data-testid="sticky-donate-bar"
    >
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => navigate({ name: 'donate' })} className="btn btn-gold w-full text-[1.5rem] anim-pulse-gold" data-testid="sticky-donate" tabIndex={visible ? 0 : -1}>
          💚 {label}
        </button>
      </div>
    </div>
  );
}

export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-2xl px-4 ${className}`}>{children}</section>;
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-2xl px-4 pb-32 pt-10 text-center text-[1rem] font-semibold text-cream/80">
      <img src="/wordmark.png" alt="City Greens Market" className="mx-auto mb-4 w-56 rounded-2xl bg-cream p-3" />
      <p>
        {ORG.name} is a 501(c)(3) nonprofit grocery store in {ORG.neighborhood}, St. Louis. Gifts are tax-deductible to the extent allowed by law.
      </p>
      <p className="mt-3">
        <a className="underline decoration-gold decoration-2 underline-offset-4" href={ORG.website} target="_blank" rel="noopener">
          stlcitygreens.org
        </a>
        {' · '}
        <a className="underline decoration-gold decoration-2 underline-offset-4" href={ORG.instagram} target="_blank" rel="noopener">
          Instagram
        </a>
        {' · '}
        <a className="underline decoration-gold decoration-2 underline-offset-4" href={ORG.facebook} target="_blank" rel="noopener">
          Facebook
        </a>
      </p>
      <p className="mt-3 text-cream/60">Payments are processed securely by Square. {EVENT.hashtag}</p>
    </footer>
  );
}
