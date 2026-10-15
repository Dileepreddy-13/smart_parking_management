import { createServer } from 'node:http';
import { createApp } from './app';
import { env, razorpayEnabled, smtpEnabled } from './config/env';
import { pool } from './db';
import { startLifecycleJob, stopLifecycleJob } from './jobs/reservationLifecycle';
import { initSockets } from './sockets';

async function main() {
  await pool.query('SELECT 1').catch((err) => {
    console.error(`Cannot connect to PostgreSQL (${err.message}). Check DATABASE_URL in backend/.env.`);
    process.exit(1);
  });

  const server = createServer(createApp());
  initSockets(server);
  startLifecycleJob();

  server.listen(env.PORT, () => {
    console.log(`Smart Parking API listening on http://localhost:${env.PORT}`);
    console.log(`  payments: ${razorpayEnabled ? 'Razorpay TEST MODE' : 'SIMULATED gateway (no Razorpay keys set)'}`);
    console.log(`  e-mail:   ${smtpEnabled ? 'SMTP' : 'SIMULATED (logged to console, no SMTP set)'}`);
  });

  const shutdown = () => {
    stopLifecycleJob();
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
