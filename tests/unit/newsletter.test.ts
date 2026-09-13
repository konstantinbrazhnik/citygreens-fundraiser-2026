import { describe, expect, it } from 'vitest';
import { mailchimpOutcome, parseMailchimpReply, parseSubscribeRequest } from '../../shared/newsletter';

describe('parseSubscribeRequest', () => {
  it('normalises', () => {
    expect(parseSubscribeRequest({ email: ' Nia@Example.com ', firstName: ' Nia ' })).toEqual({
      ok: true,
      value: { email: 'nia@example.com', firstName: 'Nia', lastName: null },
    });
    expect(parseSubscribeRequest({ email: 'nope' }).ok).toBe(false);
    expect(parseSubscribeRequest(undefined).ok).toBe(false);
  });
});

describe('mailchimp reply', () => {
  it('unwraps JSONP and classifies', () => {
    expect(mailchimpOutcome(parseMailchimpReply('cb({"result":"success","msg":"Thank you for subscribing!"})'))).toBe('subscribed');
    expect(
      mailchimpOutcome(parseMailchimpReply('cb({"result":"error","msg":"nia@example.com is already subscribed to list City Greens."})')),
    ).toBe('already');
    expect(mailchimpOutcome(parseMailchimpReply('cb({"result":"error","msg":"0 - Please enter a value"})'))).toBe('failed');
    expect(mailchimpOutcome(parseMailchimpReply('<html>oops</html>'))).toBe('failed');
  });
});
