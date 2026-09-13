import { cleanText, EMAIL, MAX_EMAIL, type Parsed } from './donations';

export interface SubscribeRequest {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export function parseSubscribeRequest(body: unknown): Parsed<SubscribeRequest> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing body.' };
  const b = body as Record<string, unknown>;
  const email = cleanText(b.email, MAX_EMAIL)?.toLowerCase() ?? null;
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  return {
    ok: true,
    value: {
      email,
      firstName: cleanText(b.firstName, 60),
      lastName: cleanText(b.lastName, 60),
    },
  };
}

export interface MailchimpReply {
  result: 'success' | 'error';
  msg: string;
}

/** Mailchimp's JSONP reply, with the callback wrapper stripped. */
export function parseMailchimpReply(text: string): MailchimpReply | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1)) as { result?: unknown; msg?: unknown };
    if (v.result !== 'success' && v.result !== 'error') return null;
    return { result: v.result, msg: typeof v.msg === 'string' ? v.msg : '' };
  } catch {
    return null;
  }
}

export type SubscribeOutcome = 'subscribed' | 'already' | 'failed';

/** "Already subscribed" is a success from the donor's point of view. */
export function mailchimpOutcome(reply: MailchimpReply | null): SubscribeOutcome {
  if (!reply) return 'failed';
  if (reply.result === 'success') return 'subscribed';
  return /already/i.test(reply.msg) ? 'already' : 'failed';
}
