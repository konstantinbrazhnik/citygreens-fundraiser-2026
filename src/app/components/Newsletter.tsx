import { useState, type FormEvent } from 'react';
import { subscribe } from '../lib/api';

export function Newsletter({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    try {
      const r = await subscribe({ email, firstName: first || null, lastName: last || null });
      setState('done');
      setNote(
        r.outcome === 'already'
          ? 'You are already on the list. Thank you!'
          : r.outcome === 'saved'
            ? 'Saved. We will add you to the list after the event.'
            : 'You are on the list. Check your inbox for a Shop-Like-a-Member coupon.',
      );
    } catch (err) {
      setState('error');
      setNote(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (state === 'done') {
    return (
      <div className="card p-5 text-center anim-pop" role="status">
        <div className="text-[1.4rem] font-black text-forest-deep">📬 {note}</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5" data-testid="newsletter">
      {!compact && (
        <>
          <h3 className="text-[1.5rem] font-black text-forest-deep">Stay in the loop</h3>
          <p className="mt-1 text-[1.05rem] font-semibold text-ink/80">
            Join the City Greens newsletter and get a <strong>Shop Like a Member</strong> coupon in your inbox.
          </p>
        </>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <input className="field" placeholder="First name" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
        <input className="field" placeholder="Last name" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <input
        className="field mt-3"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {state === 'error' && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[1rem] font-bold text-red-800" role="alert">
          {note}
        </p>
      )}
      <button type="submit" className="btn btn-leaf mt-4 w-full" disabled={state === 'busy'}>
        {state === 'busy' ? 'Signing you up…' : 'Sign me up'}
      </button>
    </form>
  );
}
