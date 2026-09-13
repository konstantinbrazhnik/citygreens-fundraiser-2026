import { useEffect, useState } from 'react';
import { EVENT, ORG } from '@shared/campaign';
import { formatMoney, outcomeFor, type PublicDonation } from '@shared/donations';
import { getDonation } from '../lib/api';
import { celebrateGift } from '../lib/celebrate';
import type { LiveBoard } from '../lib/live';
import { findGift } from '../lib/local';
import type { Route } from '../lib/router';
import { Footer, Section, TopBar } from './Chrome';
import { Newsletter } from './Newsletter';
import { Progress } from './Progress';

export function Thanks({ id, live, navigate }: { id: string; live: LiveBoard; navigate: (r: Route) => void }) {
  const [gift, setGift] = useState(() => findGift(id));
  const [donation, setDonation] = useState<PublicDonation | null>(gift?.donation ?? null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (donation) return;
    getDonation(id)
      .then((r) => setDonation(r.donation))
      .catch(() => setMissing(true));
  }, [id, donation]);

  useEffect(() => {
    if (donation) {
      const t = window.setTimeout(() => celebrateGift(donation.amountCents, { x: 0.5, y: 0.35 }), 250);
      return () => window.clearTimeout(t);
    }
  }, [donation]);

  useEffect(() => setGift(findGift(id)), [id]);

  const share = async () => {
    const text = `I just gave ${donation ? formatMoney(donation.amountCents) : ''} to help open City Greens Market in Dutchtown. Join me: `;
    const url = `${location.origin}/`;
    if (navigator.share) {
      try {
        await navigator.share({ title: EVENT.name, text, url });
      } catch {
        // dismissed
      }
    } else {
      await navigator.clipboard?.writeText(`${text}${url}`);
      alert('Link copied!');
    }
  };

  const s = live.snapshot;
  const preset = donation ? outcomeFor(donation.amountCents) : null;
  const first = donation?.name?.split(' ')[0];

  return (
    <>
      <TopBar live={live} navigate={navigate} />
      <Section className="pt-8">
        {missing && !donation ? (
          <div className="card p-6 text-center">
            <p className="text-[1.3rem] font-black text-forest-deep">We could not find that gift.</p>
            <button type="button" className="btn btn-leaf mt-4 w-full" onClick={() => navigate({ name: 'home' })}>
              Back to the start
            </button>
          </div>
        ) : (
          <div className="anim-pop text-center">
            <div className="text-[4rem] leading-none anim-wiggle">💚</div>
            <h1 className="mt-3 font-display text-[clamp(2.4rem,10vw,4rem)] leading-none gold-text">Thank you{first ? `, ${first}` : ''}!</h1>
            {donation && (
              <>
                <p className="mt-4 text-[1.6rem] font-black">Your {formatMoney(donation.amountCents)} is on the board.</p>
                {preset && <p className="mt-2 text-[1.15rem] font-bold text-cream/90">{preset.outcome}.</p>}
                {donation.name === null && <p className="mt-2 text-[1rem] font-semibold text-cream/75">Listed as Anonymous, as you asked.</p>}
              </>
            )}
            {gift?.receiptUrl && (
              <a href={gift.receiptUrl} target="_blank" rel="noopener" className="mt-4 inline-block text-[1.05rem] font-extrabold text-gold underline decoration-2 underline-offset-4">
                View your Square receipt
              </a>
            )}
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={share} className="btn btn-gold w-full">
                Share &amp; invite a friend
              </button>
              <button type="button" onClick={() => navigate({ name: 'donate' })} className="text-[1.05rem] font-extrabold text-cream/80 underline decoration-gold decoration-2 underline-offset-4">
                Give again
              </button>
            </div>
          </div>
        )}
      </Section>

      {s?.showTotal && (
        <Section className="pt-8">
          <div className="rounded-3xl bg-forest-deep/70 p-5 ring-2 ring-gold/40">
            <Progress raisedCents={s.raisedCents} goalCents={s.goalCents} count={s.count} />
          </div>
        </Section>
      )}

      <Section className="pt-8">
        <Newsletter />
      </Section>
      <Section className="pt-4">
        <div className="card p-5">
          <h3 className="text-[1.5rem] font-black text-forest-deep">Shop with us, at cost</h3>
          <p className="mt-1 text-[1.05rem] font-semibold text-ink/80">Membership starts at $25 a year on a sliding scale. Members pay what the food costs, nothing more.</p>
          <a href={ORG.membershipUrl} target="_blank" rel="noopener" className="btn btn-leaf mt-4 w-full">
            Become a member
          </a>
        </div>
      </Section>
      <Footer />
    </>
  );
}
