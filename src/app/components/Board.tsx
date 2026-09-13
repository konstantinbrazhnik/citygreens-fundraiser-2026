import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { milestoneCrossed, percent } from '@shared/board';
import { EVENT } from '@shared/campaign';
import { displayName, formatMoney } from '@shared/donations';
import { celebrateGift, celebrateMilestone } from '../lib/celebrate';
import type { LiveBoard, LiveEvent } from '../lib/live';
import { Fan, Sunburst } from './Deco';
import { Progress } from './Progress';

interface Celebration {
  key: number;
  title: string;
  sub: string;
  big: boolean;
}

type ShownCelebration = Celebration & { ms: number };

/** Most gifts the feed will lay out; how many actually show is whatever fits above the fold. */
const FEED_MAX = 12;

/**
 * The projector. Everything is sized in viewport units so it fills a wall
 * from a laptop's HDMI port with no fiddling, and the cursor hides itself.
 * The page is exactly one screen tall and never scrolls: a projection has
 * nobody at the keyboard, so the feed clips instead of pushing the QR code
 * off the bottom.
 */
export function Board({ live }: { live: LiveBoard }) {
  const s = live.snapshot;
  const [qr, setQr] = useState<string | null>(null);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [current, setCurrent] = useState<ShownCelebration | null>(null);
  const [idle, setIdle] = useState(false);
  const seen = useRef<number>(0);
  const giveUrl = useMemo(() => `${location.origin}/`, []);

  useEffect(() => {
    QRCode.toDataURL(giveUrl, { margin: 1, width: 800, color: { dark: '#141414', light: '#fff8dd' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [giveUrl]);

  /* Turn each live gift into a celebration card + confetti. */
  useEffect(() => {
    const ev: LiveEvent | null = live.latest;
    if (!ev || ev.seq === seen.current) return;
    seen.current = ev.seq;
    const d = ev.donation;
    const items: Celebration[] = [
      {
        key: ev.seq * 10,
        title: `${displayName(d)} just gave ${formatMoney(d.amountCents)}`,
        sub: d.message ? `“${d.message}”` : 'Thank you! 💚',
        big: d.amountCents >= 50_000,
      },
    ];
    if (s?.showTotal) {
      const goal = s.goalCents;
      const pct = milestoneCrossed(ev.beforeCents, ev.beforeCents + d.amountCents, goal);
      if (pct !== null) {
        items.push({
          key: ev.seq * 10 + 1,
          title: pct >= 100 ? '🎉 GOAL REACHED! 🎉' : `${pct}% of the way there!`,
          sub: pct >= 100 ? 'Dutchtown, here we come.' : `${formatMoney(Math.max(0, goal - (ev.beforeCents + d.amountCents)))} to go`,
          big: true,
        });
        window.setTimeout(() => celebrateMilestone(pct), 400);
      }
    }
    celebrateGift(d.amountCents, { x: 0.5, y: 0.45 });
    setQueue((q) => [...q, ...items]);
  }, [live.latest, s?.goalCents, s?.showTotal]);

  /* One card at a time; shorter when the queue backs up. */
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent({ ...next!, ms: rest.length > 2 ? 2500 : next!.big ? 7000 : 5000 });
  }, [queue, current]);

  /* The card's own clock, keyed on the card alone so a gift arriving mid-card cannot cancel it. */
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCurrent(null), current.ms);
    return () => window.clearTimeout(t);
  }, [current]);

  /* Hide the cursor after a few idle seconds. */
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 4000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 4000);
    };
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.clearTimeout(t);
    };
  }, []);

  /*
   * The QR code is as big as the column allows and no bigger: its width is
   * the column's height minus the caption, capped by the column's width. A
   * projection has nobody to scroll, so nothing may fall off the bottom.
   */
  const asideRef = useRef<HTMLElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const aside = asideRef.current;
    const caption = captionRef.current;
    if (!aside || !caption) return;
    const fit = () => {
      const free = aside.clientHeight - caption.offsetHeight;
      setQrSize(Math.round(Math.max(160, Math.min(free, window.innerWidth * 0.26, 440))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(aside);
    ro.observe(caption);
    return () => ro.disconnect();
  }, []);

  /* Same rule for the feed: count the cards whose bottom edge is inside the list, hide the rest. */
  const feedRef = useRef<HTMLUListElement>(null);
  const [feedShown, setFeedShown] = useState(FEED_MAX);
  const recent = s?.recent;
  useLayoutEffect(() => {
    const ul = feedRef.current;
    if (!ul) return;
    const fit = () => {
      const edge = ul.getBoundingClientRect().bottom + 1;
      let n = 0;
      for (const li of ul.children) {
        if (li.getBoundingClientRect().bottom <= edge) n++;
        else break;
      }
      setFeedShown(Math.max(2, n));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [recent]);

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const pct = s ? percent(s.raisedCents, s.goalCents) : 0;

  return (
    <main className={`deco-bg relative flex h-dvh max-h-dvh flex-col overflow-hidden ${idle ? 'board-cursor-hidden' : ''}`} data-testid="board">
      <Sunburst className="pointer-events-none absolute -left-8 -top-8 h-[26vw] w-[26vw] opacity-60" flip />
      <Sunburst className="pointer-events-none absolute -bottom-10 -right-10 h-[26vw] w-[26vw] rotate-180 opacity-60" />
      <Fan className="pointer-events-none absolute right-0 top-0 h-full w-[14vw] opacity-90" />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-[4vw] pt-[2.5vh]">
        <div>
          <p className="text-[clamp(1rem,1.8vw,1.8rem)] font-extrabold uppercase tracking-[0.25em] text-gold">{EVENT.dateLabel}</p>
          <h1 className="font-display text-[clamp(2.2rem,6vw,6rem)] leading-none gold-text">
            Growing
            <br />
            City
            <br />
            Greens
          </h1>
          <p className="mt-[0.5vh] text-[clamp(1.1rem,2.2vw,2.4rem)] font-black">Help expand food access for all!</p>
        </div>
        <button type="button" onClick={fullscreen} className="mr-[14vw] rounded-full bg-cream/10 px-4 py-2 text-[1rem] font-extrabold text-cream/70 opacity-0 transition hover:opacity-100 focus:opacity-100" aria-label="Toggle full screen">
          ⛶ Full screen
        </button>
      </header>

      {/* Body */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-[3vw] px-[4vw] pb-[3vh] pt-[3vh]" style={{ paddingRight: 'calc(4vw + 14vw)' }}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {!s && <p className="text-[3vw] font-black text-cream/70">{live.offline ? 'Reconnecting…' : 'Warming up the board…'}</p>}
          {s?.showTotal && (
            <>
              <Progress raisedCents={s.raisedCents} goalCents={s.goalCents} count={s.count} size="xl" />
              {s.offsetCents ? (
                <p className="mt-[1vh] text-[clamp(1rem,1.6vw,1.6rem)] font-bold text-cream/70">
                  includes {formatMoney(s.offsetCents)} {s.offsetLabel || 'raised before tonight'}
                </p>
              ) : null}
            </>
          )}

          {/* Feed: whole cards only. Anything that would be cut by the bottom edge is hidden, not half-shown. */}
          <ul ref={feedRef} className="mt-[3vh] grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-[1.2vw] overflow-hidden" aria-label="Recent gifts">
            {(s?.recent ?? []).slice(0, FEED_MAX).map((d, i) => (
              <li
                key={d.id}
                className={`anim-slide-in flex items-center justify-between gap-3 rounded-[1.2vw] px-[1.4vw] py-[1.2vh] ring-2 ${
                  i === 0 ? 'bg-gold text-ink ring-cream' : 'bg-cream/10 text-cream ring-gold/30'
                } ${i >= feedShown ? 'invisible' : ''}`}
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                aria-hidden={i >= feedShown || undefined}
              >
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[clamp(1.1rem,1.9vw,2.2rem)] font-black leading-tight">{displayName(d)}</span>
                  {d.message && <span className={`line-clamp-2 text-[clamp(0.95rem,1.3vw,1.5rem)] font-semibold ${i === 0 ? 'text-ink/80' : 'text-cream/80'}`}>“{d.message}”</span>}
                </span>
                <span className={`shrink-0 text-[clamp(1.2rem,2.2vw,2.6rem)] font-black ${i === 0 ? 'text-forest-deep' : 'text-gold'}`}>{formatMoney(d.amountCents)}</span>
              </li>
            ))}
            {s && s.recent.length === 0 && (
              <li className="col-span-full rounded-[1.2vw] bg-cream/10 p-[2vw] text-center text-[clamp(1.3rem,2.4vw,2.6rem)] font-black text-cream/80">Be the first gift on the board tonight 💚</li>
            )}
          </ul>
        </div>

        {/* QR */}
        <aside ref={asideRef} className="flex min-h-0 w-[clamp(180px,26vw,440px)] flex-col items-center justify-start overflow-hidden" style={qrSize ? { width: qrSize } : undefined}>
          <div className="w-full shrink-0 rounded-[1.6vw] bg-cream p-[1vw] shadow-2xl ring-8 ring-gold">
            {qr ? <img src={qr} alt={`QR code for ${giveUrl}`} className="block w-full" /> : <div className="aspect-square w-full" />}
          </div>
          <div ref={captionRef} className="flex w-full flex-col items-center pt-[1.5vh]">
            <p className="text-center text-[clamp(1.3rem,2.4vw,2.6rem)] font-black leading-tight">Scan to give</p>
            <p className="mt-[0.5vh] text-center text-[clamp(0.9rem,1.3vw,1.4rem)] font-bold text-gold break-all">{giveUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
            {s?.showTotal && (
              <p className="mt-[2vh] text-center text-[clamp(1rem,1.5vw,1.6rem)] font-bold text-cream/80">
                {pct >= 100 ? 'We did it! 🎉' : `${formatMoney(Math.max(0, s.goalCents - s.raisedCents))} to go`}
              </p>
            )}
            <span className={`mt-[1vh] inline-flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1 text-[clamp(0.85rem,1vw,1.1rem)] font-extrabold uppercase tracking-widest ${live.connected ? 'text-lime' : 'text-cream/50'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${live.connected ? 'bg-lime' : 'bg-cream/40'}`} /> {live.connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        </aside>
      </div>

      {/* Celebration overlay */}
      {current && (
        <div key={current.key} className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-[4vw] pb-[10vh]" aria-live="assertive" data-testid="celebration">
          <div className={`anim-pop max-w-[72vw] rounded-[2vw] px-[3vw] py-[2.5vh] text-center shadow-2xl ring-8 ${current.big ? 'bg-gold text-ink ring-cream' : 'bg-cream text-forest-deep ring-gold'}`}>
            <p className={`font-black leading-tight ${current.big ? 'text-[clamp(2.2rem,4.6vw,5.4rem)]' : 'text-[clamp(1.8rem,3.8vw,4.4rem)]'}`}>💚 {current.title}</p>
            <p className={`mt-[1vh] font-bold ${current.big ? 'text-[clamp(1.3rem,2.4vw,2.8rem)]' : 'text-[clamp(1.1rem,2vw,2.4rem)]'} opacity-85`}>{current.sub}</p>
          </div>
        </div>
      )}
    </main>
  );
}
