import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      // Pure rules shared by phone and server: fully tested, like scoring.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
