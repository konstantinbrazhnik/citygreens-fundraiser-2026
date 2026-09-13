import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { BoardSettings } from '@shared/board';
import { formatMoney } from '@shared/donations';
import {
  adminAddDonation,
  adminDonations,
  adminGetSettings,
  adminHideDonation,
  adminManifestUrl,
  adminPing,
  adminPush,
  adminPushSubscribe,
  adminPushTest,
  adminPushUnsubscribe,
  adminPutSettings,
  adminSubscribers,
  type AdminDonation,
  type AdminPushState,
} from '../lib/api';
import { currentSubscription, deviceLabel, isApple, permissionState, pushSupport, subscribePush, unsubscribePush } from '../lib/push';
import { toHash, type Route } from '../lib/router';

/* localStorage, not session: a desk saved to the Home Screen must stay signed in. */
const KEY_STORAGE = 'cg:admin-key';

function readStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? sessionStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function storeKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // private mode: the URL still carries it
  }
}

/**
 * The organizer's back pocket: paddle raises and checks typed straight onto
 * the board, a goal that can move, a mistaken gift hidden, and the gift list
 * exported. Gated by the ADMIN_KEY secret, checked on the server per request.
 */
export function Admin({ navigate, urlKey }: { navigate: (r: Route) => void; urlKey: string | null }) {
  const [key, setKey] = useState(() => urlKey ?? readStoredKey());
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
      storeKey(key);
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

  /*
   * While signed in, this page presents itself as its own web app ("City
   * Greens Desk") whose start_url carries the key, so Add to Home Screen /
   * Install opens a signed-in desk that can receive push notifications.
   */
  useEffect(() => {
    if (!authed) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const prevHref = link?.getAttribute('href');
    const prevTitle = meta?.getAttribute('content');
    link?.setAttribute('href', adminManifestUrl(key));
    meta?.setAttribute('content', 'CG Desk');
    return () => {
      if (link && prevHref) link.setAttribute('href', prevHref);
      if (meta && prevTitle) meta.setAttribute('content', prevTitle);
    };
  }, [authed, key]);

  /* push notifications on this phone */
  const [push, setPush] = useState<AdminPushState | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const support = pushSupport();

  const loadPush = useCallback(async (k: string) => {
    const [state, sub] = await Promise.all([adminPush(k), currentSubscription()]);
    setPush(state);
    setSubscribed(sub !== null);
  }, []);

  useEffect(() => {
    if (authed) loadPush(key).catch(() => setPush({ enabled: false, publicKey: null, devices: 0 }));
  }, [authed, key, loadPush]);

  const turnOn = async () => {
    if (!push?.publicKey) return;
    setPushBusy(true);
    setPushNote(null);
    try {
      const sub = await subscribePush(push.publicKey);
      const r = await adminPushSubscribe(key, sub, deviceLabel());
      setSubscribed(true);
      setPush((p) => (p ? { ...p, devices: r.devices } : p));
      setPushNote('Notifications are on. Every gift will buzz this phone.');
    } catch (err) {
      setPushNote(err instanceof Error ? err.message : 'Could not turn notifications on.');
    } finally {
      setPushBusy(false);
    }
  };

  const turnOff = async () => {
    setPushBusy(true);
    setPushNote(null);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) {
        const r = await adminPushUnsubscribe(key, endpoint);
        setPush((p) => (p ? { ...p, devices: r.devices } : p));
      }
      setSubscribed(false);
      setPushNote('Notifications are off on this phone.');
    } catch (err) {
      setPushNote(err instanceof Error ? err.message : 'Could not turn notifications off.');
    } finally {
      setPushBusy(false);
    }
  };

  const sendTest = async () => {
    setPushBusy(true);
    setPushNote(null);
    try {
      const r = await adminPushTest(key);
      setPushNote(`Sent to ${r.sent} ${r.sent === 1 ? 'phone' : 'phones'}${r.failed ? `, ${r.failed} failed` : ''}${r.dropped ? `, ${r.dropped} expired` : ''}.`);
      if (r.dropped) await loadPush(key);
    } catch (err) {
      setPushNote(err instanceof Error ? err.message : 'Could not send a test.');
    } finally {
      setPushBusy(false);
    }
  };

  /* invite link */
  const inviteUrl = `${location.origin}/${toHash({ name: 'admin', key })}`;
  const [copied, setCopied] = useState(false);
  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'City Greens Desk', text: 'Organizer desk for Growing City Greens. Open it, then turn on notifications to hear about every gift.', url: inviteUrl });
        return;
      } catch {
        // dismissed: fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this link:', inviteUrl);
    }
  };

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
  const [showTotal, setShowTotal] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setGoal(String(settings.goalCents / 100));
    setOffset(String(settings.offsetCents / 100));
    setOffsetLabel(settings.offsetLabel);
    setShowTotal(settings.showTotal);
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
        showTotal,
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

        {/* The loud one: until this phone is subscribed, it sits at the top. */}
        {push?.enabled && subscribed === false && (
          <section className="rounded-3xl bg-gold p-5 text-ink ring-4 ring-cream shadow-2xl anim-pop" data-testid="push-prompt">
            <h2 className="text-[1.5rem] font-black leading-tight">🔔 Hear about every gift</h2>
            {support === 'ready' && (
              <>
                <p className="mt-1 text-[1.05rem] font-semibold text-ink/80">Turn on notifications and this phone buzzes the moment a gift lands, even with the app closed.</p>
                {permissionState() === 'denied' && (
                  <p className="mt-2 rounded-xl bg-cream/70 px-3 py-2 text-[0.95rem] font-bold text-red-900">Notifications are blocked for this site. Allow them in your browser or phone settings, then tap again.</p>
                )}
                <button type="button" onClick={turnOn} disabled={pushBusy} className="btn btn-leaf mt-4 w-full text-[1.2rem]">
                  Turn on notifications
                </button>
              </>
            )}
            {support === 'needs-home-screen' && (
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-[1.05rem] font-semibold text-ink/85">
                <li>
                  Tap <span className="font-black">Share</span> (the box with the arrow) and choose <span className="font-black">Add to Home Screen</span>.
                </li>
                <li>
                  Open <span className="font-black">CG Desk</span> from your Home Screen. It signs you in.
                </li>
                <li>Tap the gold button there to turn on notifications.</li>
              </ol>
            )}
            {support === 'unsupported' && (
              <p className="mt-1 text-[1.05rem] font-semibold text-ink/80">
                This browser cannot receive push notifications. Open the invite link in Chrome{isApple() ? ', or add this page to your Home Screen in Safari' : ''}.
              </p>
            )}
            {pushNote && <p className="mt-3 text-[0.95rem] font-bold text-ink/80">{pushNote}</p>}
          </section>
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
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-[1.1rem] font-extrabold text-forest-deep">
            <input type="checkbox" className="h-7 w-7 accent-leaf" checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} />
            Show live total &amp; progress bar
          </label>
          <p className="mt-1 text-[0.95rem] font-semibold text-ink/70">
            {showTotal
              ? 'Visible on the top bar, home page, projector board and thank-you screen.'
              : 'Hidden everywhere. Turn on once every pledge (including verbal ones from tonight) is entered, so the total is accurate.'}
          </p>
          <button type="submit" className="btn btn-leaf mt-4 w-full" disabled={busy}>
            Save
          </button>
        </form>

        <section className="card p-5" data-testid="push-card">
          <h2 className="text-[1.4rem] font-black text-forest-deep">Notifications</h2>
          {push === null ? (
            <p className="mt-1 text-[1rem] font-semibold text-ink/70">Checking…</p>
          ) : !push.enabled ? (
            <p className="mt-1 text-[1rem] font-semibold text-ink/70">Push is not set up on the server yet. Set the VAPID keys (see wrangler.jsonc) and redeploy.</p>
          ) : (
            <>
              <p className="mt-1 text-[1rem] font-semibold text-ink/70">
                {subscribed ? 'On for this phone.' : 'Off for this phone.'} {push.devices} {push.devices === 1 ? 'phone is' : 'phones are'} signed up for a buzz on every gift.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {subscribed ? (
                  <button type="button" onClick={turnOff} disabled={pushBusy} className="btn btn-outline min-h-11 border-forest-deep text-forest-deep">
                    Turn off on this phone
                  </button>
                ) : (
                  <button type="button" onClick={turnOn} disabled={pushBusy || support !== 'ready'} className="btn btn-leaf min-h-11">
                    Turn on notifications
                  </button>
                )}
                <button type="button" onClick={sendTest} disabled={pushBusy || push.devices === 0} className="btn btn-cream min-h-11">
                  Send a test to everyone
                </button>
              </div>
              {pushNote && subscribed !== false && <p className="mt-3 text-[0.95rem] font-bold text-forest-deep">{pushNote}</p>}
            </>
          )}
        </section>

        <section className="card p-5" data-testid="invite-card">
          <h2 className="text-[1.4rem] font-black text-forest-deep">Invite an organizer</h2>
          <p className="mt-1 text-[1rem] font-semibold text-ink/70">
            Send this link privately. Anyone who opens it is signed in to this desk and can save it to their Home Screen to get gift notifications.
          </p>
          <p className="mt-3 break-all rounded-xl bg-forest-deep/5 px-3 py-2 font-mono text-[0.9rem] font-bold text-forest-deep" aria-label="Invite link">
            {inviteUrl}
          </p>
          <button type="button" onClick={shareInvite} className="btn btn-gold mt-4 w-full">
            {copied ? 'Copied!' : 'share' in navigator ? 'Share the link' : 'Copy the link'}
          </button>
        </section>

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
