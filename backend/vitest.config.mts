import { defineConfig } from 'vitest/config';

/**
 * Tests run against a real PostgreSQL database (never the development one).
 * Override TEST_DATABASE_URL if your local credentials differ.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: './tests/globalSetup.ts',
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smartparking_test',
      JWT_SECRET: 'test-secret-only-for-automated-tests',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      SMTP_HOST: '',
      TAX_PERCENT: '18',
      PAYMENT_HOLD_MINUTES: '10',
      FREE_CANCEL_MINUTES: '60',
      LATE_CANCEL_REFUND_PERCENT: '50',
      APP_TIMEZONE: 'Asia/Kolkata',
    },
  },
});
