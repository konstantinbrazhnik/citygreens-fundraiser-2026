#!/usr/bin/env node
// Mint a VAPID keypair for organizer push notifications.
//   node scripts/vapid-keys.mjs
// Put the public key in wrangler.jsonc (VAPID_PUBLIC_KEY) and pipe the
// private key into `npx wrangler secret put VAPID_PRIVATE_KEY`. Phones that
// subscribed under the old pair stop receiving pushes: they re-subscribe from
// #/admin.
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('raw', kp.publicKey);
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
console.log(`VAPID_PUBLIC_KEY=${b64u(pub)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
