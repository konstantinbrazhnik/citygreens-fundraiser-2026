import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { BoardSettings } from '@shared/board';
import { formatMoney } from '@shared/donations';
import { adminAddDonation, adminDonations, adminGetSettings, adminHideDonation, adminPing, adminPutSettings, adminSubscribers, type AdminDonation } from '../lib/api';
import type { Route } from '../lib/router';

const KEY_STORAGE = 'cg:admin-key';

/**
 * The organizer's back pocket: paddle raises and checks typed straight onto
 * the board, a goal that can move, a mistaken gift hidden, and the gift list
 * exported. Gated by the ADMIN_KEY secret, checked on the server per request.
 */
export function Admin({ navigate }: { navigate: (r: Route) => void }) {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY_STORAGE) ?? '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [settings, setSettings] = useState<BoardSettings | null>(null);
  const [subs, setSubs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (k: string) => {
    const [d, s, subsRes] = await Promise.all([adminDonations(k), adminGetSettings(k), adminSubscribers(k)]);
    setDonations(d.donations);
    setSettings(s);
    setSubs(subsRes.subscribers.length);
  }, []);

  const login = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      await adminPing(key);
      sessionStorage.setItem(KEY_STORAGE, key);
      setAuthed(true);
      await load(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    }
  };

  useEffect(() => {
    if (key && !authed) void login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* pledge form */
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');

  const addPledge = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminAddDonation(key, { amountCents: Math.round(Number(amount) * 100), name: anonymous ? null : name, anonymous, message: message || null });
      setAmount('');
      setName('');
      setMessage('');
      setAnonymous(false);
      await load(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add.');
    } finally {
      setBusy(false);
    }
  };

  const hide = async (d: AdminDonation) => {
    if (!confirm(`Hide ${formatMoney(d.amount_cents)} from ${d.donor_name ?? 'Anonymous'}? It stays in the export.`)) return;
    try {
      await adminHideDonation(key, d.id);
      await load(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hide.');
    }
  };

  /* settings form */
  const [goal, setGoal] = useState('');
  const [offset, setOffset] = useState('');
  const [offsetLabel, setOffsetLabel] = useState('');
  useEffect(() => {
    if (!settings) return;
    setGoal(String(settings.goalCents / 100));
    setOffset(String(settings.offsetCents / 100));
    setOffsetLabel(settings.offsetLabel);
  }, [settings]);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const s = await adminPutSettings(key, {
        goalCents: Math.round(Number(goal) * 100),
        offsetCents: Math.round(Number(offset || '0') * 100),
        offsetLabel,
      });
      setSettings(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <main className="deco-bg min-h-dvh px-4 py-10">
        <form onSubmit={login} className="card mx-auto max-w-md p-6">
          <h1 className="text-[1.6rem] font-black text-forest-deep">Organizer sign-in</h1>
          <label className="label mt-4" htmlFor="admin-key">
            Admin key
          </label>
          <input id="admin-key" className="field" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 font-bold text-red-800" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-leaf mt-4 w-full">
            Open
          </button>
          <button type="button" onClick={() => navigate({ name: 'home' })} className="mt-4 w-full text-center font-extrabold text-forest-deep underline">
            Back
          </button>
        </form>
      </main>
    );
  }

  const visible = donations.filter((d) => d.status === 'completed');
  const total = visible.reduce((a, d) => a + d.amount_cents, 0);

  return (
    <main className="deco-bg min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.8rem] font-black">Organizer desk</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate({ name: 'board' })} className="btn btn-outline min-h-11 px-4 py-2 text-[1rem]">
              Board
            </button>
            <a href={`/api/admin/export.csv?key=${encodeURIComponent(key)}`} className="btn btn-cream min-h-11 px-4 py-2 text-[1rem]" download>
              Export CSV
            </a>
          </div>
        </header>

        {error && (
          <p className="rounded-xl bg-red-100 px-4 py-3 font-bold text-red-900" role="alert">
            {error}
          </p>
        )}

        <section className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-cream/10 p-4 ring-1 ring-gold/40">
            <div className="text-[1.6rem] font-black text-gold">{formatMoney(total)}</div>
            <div className="font-bold text-cream/80">via this app</div>
          </div>
          <div className="rounded-2xl bg-cream/10 p-4 ring-1 ring-gold/40">
            <div className="text-[1.6rem] font-black text-gold">{visible.length}</div>
            <div className="font-bold text-cream/80">gifts</div>
          </div>
          <div className="rounded-2xl bg-cream/10 p-4 ring-1 ring-gold/40">
            <div className="text-[1.6rem] font-black text-gold">{subs ?? '–'}</div>
            <div className="font-bold text-cream/80">newsletter</div>
          </div>
        </section>

        <form onSubmit={addPledge} className="card p-5" data-testid="pledge-form">
          <h2 className="text-[1.4rem] font-black text-forest-deep">Put a pledge on the board</h2>
          <p className="text-[1rem] font-semibold text-ink/70">Paddle raises, checks, cash. Shows on every screen instantly.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pledge-amount">
                Amount ($)
              </label>
              <input id="pledge-amount" className="field" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pledge-name">
                Name
              </label>
              <input id="pledge-name" className="field" value={name} disabled={anonymous} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <label className="mt-3 flex min-h-11 items-center gap-3 font-extrabold text-forest-deep">
            <input type="checkbox" className="h-6 w-6 accent-leaf" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Anonymous
          </label>
          <label className="label mt-3" htmlFor="pledge-message">
            Message (optional)
          </label>
          <input id="pledge-message" className="field" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="submit" className="btn btn-gold mt-4 w-full" disabled={busy}>
            Add to the board
          </button>
        </form>

        <form onSubmit={saveSettings} className="card p-5">
          <h2 className="text-[1.4rem] font-black text-forest-deep">Goal &amp; starting total</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="goal">
                Goal ($)
              </label>
              <input id="goal" className="field" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="offset">
                Already raised ($)
              </label>
              <input id="offset" className="field" inputMode="decimal" value={offset} onChange={(e) => setOffset(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="offset-label">
                Label
              </label>
              <input id="offset-label" className="field" placeholder="from tickets & sponsors" value={offsetLabel} onChange={(e) => setOffsetLabel(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-leaf mt-4 w-full" disabled={busy}>
            Save
          </button>
        </form>

        <section className="card p-5">
          <h2 className="text-[1.4rem] font-black text-forest-deep">Every gift</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {donations.map((d) => (
              <li key={d.id} className={`flex items-center justify-between gap-3 py-3 ${d.status !== 'completed' ? 'opacity-40' : ''}`}>
                <div className="min-w-0">
                  <div className="truncate text-[1.1rem] font-black text-forest-deep">
                    {formatMoney(d.amount_cents)} · {d.anonymous ? `Anonymous (${d.donor_name ?? '—'})` : d.donor_name}
                  </div>
                  <div className="truncate text-[0.95rem] font-semibold text-ink/70">
                    {new Date(d.created_at).toLocaleTimeString()} · {d.source}
                    {d.card_brand ? ` · ${d.card_brand} ${d.card_last4}` : ''}
                    {d.email ? ` · ${d.email}` : ''}
                    {d.message ? ` · “${d.message}”` : ''}
                  </div>
                </div>
                {d.status === 'completed' && (
                  <button type="button" onClick={() => hide(d)} className="min-h-11 shrink-0 rounded-xl bg-red-100 px-3 font-extrabold text-red-900">
                    Hide
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
