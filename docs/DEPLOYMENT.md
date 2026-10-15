# Deployment

The project runs fully on a laptop (see the README). This guide covers a free-tier cloud deployment:

| Part | Service | Notes |
|---|---|---|
| Database | Neon or Supabase (PostgreSQL) | Copy the connection string. |
| Backend | Render or Railway (Node web service) | Needs WebSocket support (both have it). |
| Frontend | Vercel (static site) | Built with Vite. |

## 1. Database

1. Create a PostgreSQL database on Neon or Supabase.
2. Copy its connection string, e.g. `postgresql://user:password@host/dbname?sslmode=require`.

## 2. Backend (Render)

1. New → Web Service → connect the GitHub repository.
2. Root directory: `backend`
3. Build command: `npm install && npm run db:migrate`
4. Start command: `npm start`
5. Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the connection string from step 1 |
| `JWT_SECRET` | a long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `FRONTEND_URL` | your Vercel URL, e.g. `https://smart-parking.vercel.app` (comma-separate several) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | optional Razorpay **test** keys |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | optional |

6. To load demo data once, open the service shell and run `npm run seed`. **This wipes all tables**, so never run it on a database with real data.

`PORT` is provided by the platform. Rate limiting is active when `NODE_ENV=production`.

## 3. Frontend (Vercel)

1. New Project → import the repository.
2. Root directory: `frontend`; framework preset: Vite; build command `npm run build`; output `dist`.
3. Environment variable: `VITE_API_URL` = the backend URL, e.g. `https://smart-parking-api.onrender.com` (no trailing slash).
4. `frontend/vercel.json` already rewrites every path to `index.html` so deep links such as `/bookings/123` work.

## 4. After deploying

- Open the site, register, and make a test booking.
- Check `https://<backend>/api/health` returns `{"status":"ok"}`.
- If the browser console shows a CORS error, `FRONTEND_URL` on the backend does not match the site's origin exactly.
- Free Render services sleep when idle; the first request after a pause can take about a minute, and the scheduled job only runs while the service is awake.

## Production checklist

- [ ] `JWT_SECRET` is long, random and different from development
- [ ] `.env` files are not committed (they are in `.gitignore`)
- [ ] Database uses SSL (`sslmode=require`)
- [ ] Demo accounts removed or their passwords changed
- [ ] Razorpay keys are **test** keys unless real payments are intended and approved
