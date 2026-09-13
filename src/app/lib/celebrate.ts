import confetti from 'canvas-confetti';

const GOLD = ['#d8a850', '#f2d27f', '#a07830'];
const GREENS = ['#a6ce39', '#558632', '#fff8dd'];

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A burst sized to the gift: a $25 pop, a $1,000 downpour. */
export function celebrateGift(amountCents: number, origin?: { x: number; y: number }) {
  if (reduced()) return;
  const scale = Math.min(4, 1 + Math.log10(Math.max(1, amountCents / 2500)));
  const count = Math.round(80 * scale);
  void confetti({
    particleCount: count,
    spread: 70 + 15 * scale,
    startVelocity: 40 + 10 * scale,
    origin: origin ?? { x: 0.5, y: 0.6 },
    colors: [...GOLD, ...GREENS],
    scalar: 1.1,
    ticks: 220,
  });
  if (scale >= 2.5) {
    void confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: GOLD });
    void confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: GOLD });
  }
}

/** Ten seconds of gold rain for a milestone. */
export function celebrateMilestone(pct: number) {
  if (reduced()) return;
  const end = Date.now() + (pct >= 100 ? 10_000 : 4_000);
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: [...GOLD, ...GREENS] });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: [...GOLD, ...GREENS] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
