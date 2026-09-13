import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

/** A throwaway VAPID pair per run: the push tests sign real JWTs and encrypt real payloads against a mocked push service. */
async function testVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: jwk.d!, VAPID_SUBJECT: 'https://cg.test' };
}

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  const vapid = await testVapid();
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            PAYMENTS_MODE: 'simulated',
            ADMIN_KEY: 'test-admin-key',
            SQUARE_APPLICATION_ID: 'sandbox-sq0idb-test',
            SQUARE_LOCATION_ID: 'LTEST',
            // Never touch the real list from a test run.
            MAILCHIMP_HOST: '',
            ...vapid,
          },
        },
      }),
    ],
    test: {
      include: ['tests/workers/**/*.test.ts'],
      setupFiles: ['./tests/workers/apply-migrations.ts'],
    },
  };
});
