import { useEffect, useState } from 'react';
import { formatMoney, shortName } from '@shared/donations';
import type { LiveBoard, LiveEvent } from '../lib/live';

/**
 * "Maria G. just gave $100" at the foot of the phone, for a few seconds.
 * One line, never stacked: the point is a nudge, not a feed.
 */
export function LiveToast({ live }: { live: LiveBoard }) {
  const [shown, setShown] = useState<LiveEvent | null>(null);
  useEffect(() => {
    if (!live.latest) return;
    setShown(live.latest);
    const t = window.setTimeout(() => setShown(null), 6000);
    return () => window.clearTimeout(t);
  }, [live.latest]);
  if (!shown) return null;
  const d = shown.donation;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 'calc(6.2rem + var(--safe-bottom))' }} aria-live="polite">
      <div key={shown.seq} className="anim-ticker rounded-full bg-cream px-5 py-3 text-[1.05rem] font-extrabold text-forest-deep shadow-2xl ring-4 ring-gold/60">
        💚 {shortName(d.name)} just gave <span className="text-leaf">{formatMoney(d.amountCents)}</span>
      </div>
    </div>
  );
}
