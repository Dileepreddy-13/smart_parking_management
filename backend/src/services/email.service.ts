import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest, smtpEnabled } from '../config/env';

let transporter: Transporter | undefined;
if (smtpEnabled) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const template = (title: string, body: string) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;color:#facc15;padding:16px 24px;font-weight:700;font-size:18px">Smart Parking</div>
  <div style="padding:24px;color:#0f172a">
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
    <p style="margin:0;line-height:1.6;color:#334155">${escapeHtml(body)}</p>
  </div>
</div>`;

/**
 * Sends an e-mail. Never throws: a mail failure must not break a booking.
 * When SMTP is not configured the message is logged instead (development fallback).
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!transporter) {
    if (!isTest) console.log(`[email:simulated] to=${to} | ${subject} | ${body}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text: body, html: template(subject, body) });
  } catch (err) {
    console.error('[email] delivery failed:', (err as Error).message);
  }
}
