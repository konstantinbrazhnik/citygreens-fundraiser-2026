import { percent } from '@shared/board';
import { formatMoney } from '@shared/donations';

export function Progress({
  raisedCents,
  goalCents,
  count,
  size = 'md',
}: {
  raisedCents: number;
  goalCents: number;
  count: number;
  size?: 'md' | 'xl';
}) {
  const pct = percent(raisedCents, goalCents);
  const xl = size === 'xl';
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className={`font-black leading-none gold-text ${xl ? 'text-[clamp(3.5rem,11vw,10rem)]' : 'text-[2.4rem]'}`} data-testid="raised">
            {formatMoney(raisedCents)}
          </div>
          <div className={`mt-1 font-bold text-cream/90 ${xl ? 'text-[clamp(1.4rem,3vw,2.4rem)]' : 'text-[1.05rem]'}`}>
            raised of {formatMoney(goalCents)}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-black leading-none ${xl ? 'text-[clamp(2.5rem,7vw,6rem)]' : 'text-[1.9rem]'}`}>{Math.floor(pct)}%</div>
          <div className={`font-bold text-cream/80 ${xl ? 'text-[clamp(1.2rem,2.4vw,2rem)]' : 'text-[1rem]'}`}>
            {count} {count === 1 ? 'gift' : 'gifts'}
          </div>
        </div>
      </div>
      <div className={`progress mt-3 ${xl ? 'h-9' : 'h-6'}`} role="progressbar" aria-valuenow={Math.floor(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%` }} />
      </div>
    </div>
  );
}
