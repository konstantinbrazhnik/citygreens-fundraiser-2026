import { mailchimpOutcome, parseMailchimpReply, type SubscribeOutcome, type SubscribeRequest } from '../../shared/newsletter';

type MailchimpEnv = Pick<Env, 'MAILCHIMP_HOST' | 'MAILCHIMP_U' | 'MAILCHIMP_ID' | 'MAILCHIMP_F_ID'>;

/**
 * The same embedded form stlcitygreens.org uses, submitted from the Worker via
 * Mailchimp's JSONP endpoint so the donor never leaves the app (the classic
 * form opens a Mailchimp page in a new tab). An empty MAILCHIMP_HOST turns
 * this into a no-op — that is how tests run without touching the network.
 */
export async function subscribeToMailchimp(env: MailchimpEnv, req: SubscribeRequest): Promise<SubscribeOutcome> {
  if (!env.MAILCHIMP_HOST) return 'failed';
  const url = new URL(`https://${env.MAILCHIMP_HOST}/subscribe/post-json`);
  url.searchParams.set('u', env.MAILCHIMP_U);
  url.searchParams.set('id', env.MAILCHIMP_ID);
  url.searchParams.set('f_id', env.MAILCHIMP_F_ID);
  url.searchParams.set('EMAIL', req.email);
  if (req.firstName) url.searchParams.set('FNAME', req.firstName);
  if (req.lastName) url.searchParams.set('LNAME', req.lastName);
  url.searchParams.set('c', 'cb');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { Accept: '*/*' } });
    const text = await res.text();
    return mailchimpOutcome(parseMailchimpReply(text));
  } catch (err) {
    console.error('mailchimp subscribe failed', err);
    return 'failed';
  }
}
