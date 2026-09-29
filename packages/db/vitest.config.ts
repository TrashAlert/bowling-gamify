import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each test file boots its own Postgres (WASM). Give it time on a cold CI runner.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
