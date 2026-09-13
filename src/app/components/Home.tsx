import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN, EVENT, ORG } from '@shared/campaign';
import { formatMoney, PRESETS, shortName } from '@shared/donations';
import type { LiveBoard } from '../lib/live';
import type { Route } from '../lib/router';
import { Footer, Section, StickyDonate, TopBar } from './Chrome';
import { Sunburst } from './Deco';
import { Newsletter } from './Newsletter';
import { Progress } from './Progress';

export function Home({ live, navigate }: { live: LiveBoard; navigate: (r: Route) => void }) {
  const s = live.snapshot;
  const heroDonate = useRef<HTMLButtonElement>(null);
  // The bottom bar only appears once the hero's Donate button has scrolled
  // out of view, so there is never two Donate buttons on screen at once.
  const [heroDonateOffscreen, setHeroDonateOffscreen] = useState(false);
  useEffect(() => {
    const el = heroDonate.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setHeroDonateOffscreen(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <TopBar live={live} navigate={navigate} />

      {/* Hero */}
      <Section className="relative overflow-hidden pt-8 pb-6">
        <Sunburst className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-70" />
        <p className="text-[1.05rem] font-extrabold uppercase tracking-[0.2em] text-gold">{EVENT.dateLabel} · {EVENT.venueShort}</p>
        <h1 className="mt-3 font-display text-[clamp(2.6rem,11vw,4.6rem)] leading-[0.95] gold-text" data-testid="hero-title">
          Growing
          <br />
          City
          <br />
          Greens
        </h1>
        <p className="mt-5 text-[1.6rem] font-black leading-tight">{CAMPAIGN.headline}</p>
        <p className="mt-3 text-[1.15rem] font-semibold text-cream/90">
          A neighborhood with no grocery store. A market that sells local food at cost. Tonight, we bring them together.
        </p>
        <button ref={heroDonate} type="button" onClick={() => navigate({ name: 'donate' })} className="btn btn-gold mt-6 w-full text-[1.5rem]" data-testid="hero-donate">
          💚 Donate now
        </button>
        <p className="mt-3 text-center text-[1rem] font-bold text-cream/80">Takes about a minute. Card, Apple Pay or Google Pay.</p>
      </Section>

      {/* Live progress */}
      <Section className="pb-6">
        <div className="rounded-3xl bg-forest-deep/70 p-5 ring-2 ring-gold/40">
          {s ? (
            <>
              <Progress raisedCents={s.raisedCents} goalCents={s.goalCents} count={s.count} />
              {s.recent.length > 0 && (
                <ul className="mt-4 space-y-2" aria-label="Latest gifts">
                  {s.recent.slice(0, 3).map((d) => (
                    <li key={d.id} className="anim-slide-in flex items-baseline justify-between gap-3 rounded-2xl bg-cream/10 px-4 py-2.5 text-[1.05rem] font-bold">
                      <span className="truncate">
                        💚 {shortName(d.name)}
                        {d.message && <span className="font-semibold text-cream/80"> · “{d.message}”</span>}
                      </span>
                      <span className="shrink-0 font-black text-gold">{formatMoney(d.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => navigate({ name: 'board' })} className="mt-4 w-full text-center text-[1rem] font-extrabold text-gold underline decoration-2 underline-offset-4">
                Watch the live board →
              </button>
            </>
          ) : (
            <p className="text-center text-[1.1rem] font-bold text-cream/80">{live.offline ? 'Reconnecting to the board…' : 'Loading the board…'}</p>
          )}
        </div>
      </Section>

      {/* Why */}
      <Section className="pb-8">
        <h2 className="text-[1.9rem] font-black leading-tight">Why Bevo Mill, why now</h2>
        {CAMPAIGN.story.map((p) => (
          <p key={p.slice(0, 20)} className="mt-4 text-[1.15rem] font-semibold leading-relaxed text-cream/95">
            {p}
          </p>
        ))}
        <dl className="mt-6 grid grid-cols-2 gap-3">
          {CAMPAIGN.proof.map((p) => (
            <div key={p.stat} className="rounded-2xl bg-cream/10 p-4 ring-1 ring-gold/30">
              <dt className="text-[2rem] font-black leading-none text-gold">{p.stat}</dt>
              <dd className="mt-1 text-[1rem] font-bold text-cream/90">{p.label}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* What a gift does */}
      <Section className="pb-8">
        <h2 className="text-[1.9rem] font-black leading-tight">What your gift does</h2>
        <ul className="mt-4 space-y-3">
          {PRESETS.map((p) => (
            <li key={p.cents}>
              <button
                type="button"
                onClick={() => navigate({ name: 'donate', amountCents: p.cents })}
                className="card flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99]"
              >
                <span className="text-[2rem]" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.6rem] font-black leading-none text-forest-deep">{formatMoney(p.cents)}</span>
                  <span className="mt-1 block text-[1.05rem] font-bold leading-snug text-ink/85">{p.outcome}</span>
                </span>
                <span className="text-[1.6rem] font-black text-leaf" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {/* Event */}
      <Section className="pb-8">
        <div className="rounded-3xl bg-forest-deep/70 p-5 ring-2 ring-gold/40">
          <p className="text-[1rem] font-extrabold uppercase tracking-[0.2em] text-gold">Tonight's event</p>
          <p className="mt-2 text-[1.5rem] font-black leading-tight">{EVENT.name}</p>
          <p className="mt-2 text-[1.1rem] font-semibold text-cream/90">
            {EVENT.dateLabel}, {EVENT.timeLabel}
            <br />
            {EVENT.venue}
            <br />
            {EVENT.venueAddress}
          </p>
          <a href={EVENT.ticketsUrl} target="_blank" rel="noopener" className="btn btn-outline mt-4 w-full">
            Tickets &amp; event page
          </a>
        </div>
      </Section>

      {/* Newsletter + membership */}
      <Section className="pb-6">
        <Newsletter />
      </Section>
      <Section className="pb-4">
        <div className="card p-5">
          <h3 className="text-[1.5rem] font-black text-forest-deep">Become a member</h3>
          <p className="mt-1 text-[1.05rem] font-semibold text-ink/80">
            Members shop everything at cost: 30% below non-member prices, free delivery within 3 miles, and a sliding scale that starts at $25 a year.
          </p>
          <a href={ORG.membershipUrl} target="_blank" rel="noopener" className="btn btn-leaf mt-4 w-full">
            Join City Greens
          </a>
        </div>
      </Section>

      <Footer />
      <StickyDonate navigate={navigate} visible={heroDonateOffscreen} />
    </>
  );
}
