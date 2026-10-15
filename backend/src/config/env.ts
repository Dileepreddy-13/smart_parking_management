import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  TAX_PERCENT: z.coerce.number().min(0).max(100).default(18),
  PAYMENT_HOLD_MINUTES: z.coerce.number().min(1).default(10),
  FREE_CANCEL_MINUTES: z.coerce.number().min(0).default(60),
  LATE_CANCEL_REFUND_PERCENT: z.coerce.number().min(0).max(100).default(50),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('Smart Parking <no-reply@smartparking.local>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\nCopy backend/.env.example to backend/.env and fill it in.`);
}

export const env = parsed.data;
export const isTest = env.NODE_ENV === 'test';
/** Real Razorpay test mode is used only when both keys are present; otherwise payments are simulated. */
export const razorpayEnabled = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER);
