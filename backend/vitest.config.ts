import { defineConfig } from 'vitest/config';

// `test.env` is applied to `process.env` before any test module (and its
// imports) loads — this is what lets integration tests point the app at
// TEST_DATABASE_URL instead of the dev DB, since import-hoisting would
// otherwise make a plain `process.env.X = ...; import '../app'` at the top
// of a test file run too late.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    // Integration test files share one real Postgres database (plan-backend.md
    // §9 rules out per-file SQLite/in-memory isolation), so they must not run
    // concurrently against it — otherwise one file's reset/seed races another's.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://expense:expense@localhost:5433/expense_claims_test?schema=public',
      JWT_SECRET: 'test-jwt-secret',
      JWT_EXPIRES_IN_SECONDS: '86400',
      BCRYPT_SALT_ROUNDS: '4',
      UPLOAD_DIR: './tests/.tmp-uploads',
      MAX_RECEIPT_SIZE_BYTES: '5242880',
      COOKIE_SECURE: 'false',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
