import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify('test-build') },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
