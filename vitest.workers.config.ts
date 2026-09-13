import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
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
