# Smart Parking Management System

A full-stack web application, built as a Software Engineering case study, that lets drivers **find, reserve and pay for
a parking slot**, and lets parking administrators **monitor occupancy and manage parking areas**.

> **Find. Reserve. Park.**  React + TypeScript · Node.js + Express · PostgreSQL · Socket.IO · Leaflet · Razorpay (test mode)

---

## Contents

1. [Problem statement](#problem-statement)
2. [Objectives](#objectives)
3. [Features](#features)
4. [Stakeholders](#stakeholders)
5. [Tech stack](#tech-stack)
6. [Architecture](#architecture)
7. [Project structure](#project-structure)
8. [Getting started](#getting-started) (prerequisites, installation, environment, database, running)
9. [Demo accounts](#demo-accounts)
10. [Demonstration script](#demonstration-script)
11. [API](#api)
12. [Database schema](#database-schema)
13. [UML diagrams](#uml-diagrams)
14. [Testing](#testing)
15. [Security](#security)
16. [Deployment](#deployment)
17. [Software Engineering mapping](#software-engineering-mapping)
18. [Design decisions and deviations from the brief](#design-decisions-and-deviations-from-the-brief)
19. [Limitations](#limitations)
20. [Future enhancements](#future-enhancements)
21. [Authors](#authors)

---

## Problem statement

> A city plans to develop a Smart Parking Management System that allows users to locate available parking spaces
> through a mobile/web application. Users can reserve a parking slot, make payments, and receive notifications.
> Parking administrators can monitor occupancy and manage parking areas.

Required Software Engineering deliverables:

1. Identify the stakeholders and prepare a Software Requirements Specification → [`docs/SRS.md`](docs/SRS.md)
2. A sequence diagram for finding, reserving and paying for a slot → [`docs/sequence-diagram.md`](docs/sequence-diagram.md)
3. A class diagram → [`docs/class-diagram.md`](docs/class-diagram.md)

## Objectives

1. Show drivers real-time parking availability.
2. Let them search nearby parking by location, price and vehicle type.
3. Let them reserve a slot for a chosen time window.
4. Take secure online payment before the booking is confirmed.
5. Notify users of confirmations, payments, reminders and cancellations.
6. Give administrators live occupancy monitoring.
7. Let administrators manage parking areas, slots, rates and hours.
8. Keep a complete reservation and payment history.
9. Guarantee that a slot is never double-booked.
10. Leave a clean integration point for future IoT sensors.

## Features

### Customer

| Area | What you can do |
|---|---|
| Account | Register, log in / out, edit profile, change password, save vehicles |
| Search | Search by name or location; filter by vehicle type, max price, free bays only; sort by name, price, availability or distance |
| Map | Leaflet + OpenStreetMap; pins show the number of free bays; popup with address, price, distance and "View details"; your location (falls back to Hyderabad city centre) |
| Parking details | Description, operating hours, rates per vehicle type, total and free bays, EV charging, mini map |
| Slot selection | Visual floor plan grouped by level; colour **and** icon for available / reserved / occupied / maintenance; availability recalculated for the date and time you pick |
| Booking | Server-calculated price (base + GST); optional vehicle; cancellation policy shown up front; slot held for 10 minutes while you pay |
| Payment | Razorpay test mode, or a clearly labelled simulated gateway when no keys are set; failure → retry |
| After booking | Confirmation screen, in-app + e-mail notifications, QR booking reference, printable receipt, directions link |
| My bookings | Upcoming / Active / Completed / Cancelled tabs; view details, view receipt, pay a pending booking, cancel |
| Dashboard | Active and upcoming reservation, totals, nearby parking with free bays, bookings per month, recent payments, notifications |
| Notifications | Bell with live unread count; mark one / all as read |

### Administrator

| Area | What you can do |
|---|---|
| Dashboard | Parking areas, total / available / occupied / reserved / maintenance slots, today's reservations and revenue, users, occupancy %; charts for occupancy by area, slot status, revenue and reservations over time |
| Occupancy | Per-area totals and occupancy % with progress bars, updated live; **Simulation Mode** to mark bays occupied / available / maintenance |
| Parking areas | Create (with click-on-map location), edit, deactivate / reactivate; rates per vehicle type; operating hours per day or 24×7 |
| Slots | Add, edit (number, level, type, custom price, EV), delete (only without history), change status |
| Reservations | Search by booking ID, customer, vehicle or slot; filter by status and area; details; cancel with full refund |
| Users | Search; view details, vehicles, bookings and total spent; activate / deactivate (passwords are never visible) |
| Payments | All attempts with status, refunds and gateway IDs |
| Notifications | Send an announcement to everyone or one user; see what was sent |
| Reports | Net / gross / refunded revenue; per day, per area, per vehicle type; reservations by status; peak hours; CSV export; print |

Every screen has loading skeletons, empty states, error states with retry, toasts and confirmation dialogs for destructive actions.
The UI is responsive from 360 px phones to wide desktops.

## Stakeholders

| Type | Stakeholder | Interest |
|---|---|---|
| Primary | Customer / driver | Find and secure parking quickly at a clear price |
| Primary | Parking administrator | Accurate occupancy, utilisation, revenue, little manual work |
| Secondary | Payment gateway (Razorpay) | Correct and secure payment integration |
| Secondary | City / parking authority | Less congestion, transparent revenue, planning data |
| Secondary | Notification / e-mail service | Valid recipients, reasonable volume |
| Secondary | System administrators | Easy configuration, security, monitoring |
| Secondary | Maintenance staff | Bays under repair are never booked |
| Future | IoT sensor providers | A stable API to report bay occupancy |
| Future | Traffic management systems | Real-time availability data |

Role, responsibilities, interests, system interaction and requirements for each are in [`docs/SRS.md` §5](docs/SRS.md#5-stakeholders).

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, TypeScript (strict), Tailwind CSS v4, React Router, Axios, TanStack Query, React Hook Form, Zod, Leaflet / React-Leaflet, Recharts, Lucide icons, Socket.IO client, qrcode.react |
| Backend | Node.js 20+, Express, TypeScript (strict), Drizzle ORM, PostgreSQL, JWT, bcryptjs, Zod, Socket.IO, Nodemailer, Razorpay SDK, node-cron, Helmet, CORS, express-rate-limit |
| Testing | Vitest, Supertest, React Testing Library, Playwright |
| Tooling | ESLint, Prettier, dotenv, npm, drizzle-kit |
| Deployment | Vercel (frontend), Render / Railway (backend), Neon / Supabase / local PostgreSQL |

## Architecture

```
            Browser (customer / admin)
                      │
          React SPA (Vite, TypeScript)
                      │  REST/JSON + Socket.IO
                      ▼
     Express API ── middleware: Helmet · CORS · rate limit · JWT · RBAC · errors
        routes → controllers (Zod validation) → services (business rules)
                      │                              │
                Drizzle ORM                  scheduled lifecycle job
                      │
                 PostgreSQL

  External: Backend → Razorpay · Backend → SMTP (Nodemailer) · Frontend → OpenStreetMap tiles
```

Details, authentication flow, data flows and the real-time event model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure

```
smart-parking-management-system/
├── backend/
│   ├── src/
│   │   ├── config/        env.ts: validated environment variables
│   │   ├── controllers/   parse + validate requests, call one service
│   │   ├── services/      business logic (availability, pricing, booking, payment, notifications, admin)
│   │   ├── routes/        URL → controller, with auth middleware
│   │   ├── middleware/    JWT auth, role checks, rate limits, error handler
│   │   ├── validators/    Zod schemas for every request
│   │   ├── utils/         pricing, time zone, distance, JWT, errors
│   │   ├── sockets/       Socket.IO server and emitters
│   │   ├── jobs/          reservation lifecycle (expire, activate, complete, remind)
│   │   ├── db/            schema.ts, migrate.ts, seed.ts
│   │   ├── types/         Express request typing
│   │   ├── app.ts         Express app
│   │   └── server.ts      HTTP + Socket.IO + job start-up
│   ├── drizzle/           SQL migrations (generated from schema.ts)
│   ├── tests/             unit + API tests (Vitest, Supertest)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/           Axios client and typed endpoints
│   │   ├── components/    UI kit, charts, logo, notification bell
│   │   ├── contexts/      AuthContext
│   │   ├── features/      booking, parking (map, slot grid), admin forms
│   │   ├── hooks/         realtime, geolocation, countdown, debounce, config
│   │   ├── layouts/       public, customer and admin layouts
│   │   ├── pages/         all screens (admin/ for the admin console)
│   │   ├── routes/        route table and guards
│   │   ├── services/      Socket.IO and Razorpay checkout
│   │   ├── types/         shared TypeScript types
│   │   └── utils/         formatting helpers
│   ├── tests/             component tests (React Testing Library)
│   ├── e2e/               browser tests (Playwright)
│   └── .env.example
├── docs/                  SRS, requirements, API, architecture, testing, UML, database, deployment
│   └── diagrams/          every diagram rendered as PNG and SVG
├── package.json           convenience scripts for both apps
└── README.md
```

## Getting started

### Prerequisites

- **Node.js 20 or newer** (includes npm) – check with `node -v`
- **PostgreSQL 14 or newer** running locally – or a free Neon / Supabase database
- Git

### 1. Install

```bash
git clone <repository-url>
cd smart-parking-management-system
npm run install:all        # installs backend and frontend
```

### 2. Create the databases

```bash
createdb smartparking            # application data
createdb smartparking_test       # only needed for the automated API tests
```

On Windows, use pgAdmin or `psql -U postgres -c "CREATE DATABASE smartparking"`.

### 3. Configure the backend

```bash
cd backend
cp .env.example .env             # Windows: copy .env.example .env
```

Edit `backend/.env`:

| Variable | Required | Example / default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5432/smartparking` | PostgreSQL connection |
| `JWT_SECRET` | yes | any long random string | Signs login tokens |
| `PORT` | no | `5000` | API port |
| `FRONTEND_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `JWT_EXPIRES_IN` | no | `1d` | Token lifetime |
| `APP_TIMEZONE` | no | `Asia/Kolkata` | Operating hours and "today" statistics |
| `TAX_PERCENT` | no | `18` | GST added to the parking charge |
| `PAYMENT_HOLD_MINUTES` | no | `10` | How long an unpaid booking holds its slot |
| `FREE_CANCEL_MINUTES` | no | `60` | Full refund if cancelled at least this long before start |
| `LATE_CANCEL_REFUND_PERCENT` | no | `50` | Refund when cancelled later than that |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | no | Razorpay **test** keys | Leave empty to use the simulated gateway |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | no | e.g. Gmail app password or Mailtrap | Leave empty and e-mails are printed in the backend console |

The frontend needs no configuration for local development (`frontend/.env.example` explains `VITE_API_URL` for production).

### 4. Create tables and load demo data

```bash
cd backend
npm run db:setup     # = npm run db:migrate && npm run seed
```

The seed **wipes all tables** and loads 1 admin, 5 users, 5 Hyderabad parking areas (CBIT Main, Hyderabad Central,
Gachibowli Metro, HITEC City, Madhapur Smart), 124 slots, 30 reservations with payments over the last two weeks,
and notifications. Run `npm run seed` again at any time to reset the demo.

If you change `src/db/schema.ts`, generate a new migration with `npm run db:generate` and apply it with `npm run db:migrate`.
`npm run db:studio` opens a browser view of the database.

### 5. Run

Two terminals:

```bash
# terminal 1
cd backend
npm run dev          # http://localhost:5000  (API at /api, health check at /api/health)

# terminal 2
cd frontend
npm run dev          # http://localhost:5173
```

Open **http://localhost:5173**. The backend prints whether payments and e-mail are real or simulated.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` | `backend/.env` is missing or `DATABASE_URL` / `JWT_SECRET` are empty |
| `Cannot connect to PostgreSQL` | Start PostgreSQL; check user, password, port and database name in `DATABASE_URL` |
| `password authentication failed` | The password in `DATABASE_URL` is wrong for your PostgreSQL user |
| Frontend shows "Cannot reach the server" | The backend is not running on port 5000 |
| Map is grey | No internet access to OpenStreetMap tiles; markers and list still work |
| Port already in use | Change `PORT` (backend) or run `npm run dev -- --port 5174` (frontend; add it to `FRONTEND_URL`) |

## Demo accounts

**Development / demo only. Do not use these in production.**

| Role | E-mail | Password |
|---|---|---|
| Administrator | `admin@smartparking.local` | `Admin@123` |
| Customer | `user@smartparking.local` | `User@123` |
| More customers | `ananya@`, `rahul@`, `sneha@`, `karthik@smartparking.local` | `User@123` |

In development the login page has one-click buttons that fill these in.

**Payments:** with no Razorpay keys, the checkout shows a *Simulated payment gateway* window with **Pay** and
**Simulate a failed payment** buttons. With Razorpay test keys, use any [Razorpay test card or UPI ID](https://razorpay.com/docs/payments/payments/test-card-details/), e.g. UPI `success@razorpay`.

## Demonstration script

Use two browser windows (one normal, one private) to show real-time updates.

**Part 1 – Customer** (window A, `user@smartparking.local`)

1. Landing page → **Find Parking**.
2. Search "HITEC", filter *Car*, sort *Nearest*; show list and map; click a pin → popup → *View details*.
3. Pick a date and time; show the slot grid and legend; select a green bay.
4. **Review booking**: price is calculated by the server (₹60 × 2 h + 18% GST); point out the cancellation policy.
5. **Confirm reservation** → payment step with the 10-minute hold timer.
6. Click **Pay** → *Simulate a failed payment* → error and **Retry payment** → **Pay** → *Booking confirmed*.
7. Show the bell's unread count and the notifications.
8. **View booking & receipt**: QR reference, payment IDs, print.
9. **My bookings**: tabs; cancel an upcoming booking and show the refund.
10. Go back to the same parking area and show that the booked bay is no longer selectable for that time.

**Part 2 – Administrator** (window B, `admin@smartparking.local`)

1. Dashboard figures and four charts.
2. **Parking areas** → *Manage* an area: rates, operating hours, slots.
3. **Slots**: add a slot; edit a price.
4. **Occupancy** → *Simulation Mode*: mark a bay occupied. Watch the percentage change, and in window A the bay turns red without refreshing.
5. **Reservations**: search the booking from Part 1; open details.
6. **Payments**, **Users** (deactivate / reactivate), **Notifications** (send an announcement and show it arriving in window A).
7. **Reports**: change the period; export CSV.
8. In window A, open `/admin` as the customer → *Access denied*.

## API

REST API under `/api`, JSON in and out, JWT bearer authentication. Main endpoints:

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `PUT /auth/profile` · `PUT /auth/password` |
| Parking | `GET /parking` · `GET /parking/:id` · `POST /parking` · `PUT /parking/:id` · `DELETE /parking/:id` · `PUT /parking/:id/rates` · `PUT /parking/:id/hours` |
| Slots | `GET /parking/:id/slots` · `POST /parking/:id/slots` · `PUT /slots/:id` · `PATCH /slots/:id/status` · `DELETE /slots/:id` |
| Reservations | `POST /reservations/quote` · `POST /reservations` · `GET /reservations` · `GET /reservations/:id` · `PATCH /reservations/:id/cancel` |
| Payments | `POST /payments/create-order` · `POST /payments/verify` · `GET /payments` · `GET /payments/:id` |
| Notifications | `GET /notifications` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` |
| Admin | `GET /admin/dashboard` · `GET /admin/occupancy` · `GET /admin/revenue` · `GET /admin/users` · `PATCH /admin/users/:id/status` · `GET /admin/reservations` · `PATCH /admin/reservations/:id/cancel` · `GET /admin/payments` · `GET /admin/slots` · `GET/POST /admin/notifications` |
| Other | `GET /health` · `GET /config` · `GET /vehicles` · `POST /vehicles` · `DELETE /vehicles/:id` · `GET /dashboard` |

Full reference with request bodies, error codes and Socket.IO events: [`docs/API.md`](docs/API.md).

## Database schema

Nine tables: `users`, `vehicles`, `parking_areas`, `parking_rates`, `operating_hours`, `parking_slots`, `reservations`,
`payments`, `notifications`, with UUID keys, foreign keys, unique constraints, indexes and PostgreSQL enums.
ER diagram, table descriptions and the double-booking design: [`docs/database-design.md`](docs/database-design.md).

## UML diagrams

All diagrams are written in Mermaid (they render on GitHub) and also exported as images in [`docs/diagrams/`](docs/diagrams).

| Diagram | Document | Image |
|---|---|---|
| Use case diagram | [`use-case-diagram.md`](docs/use-case-diagram.md) | [PNG](docs/diagrams/use-case-diagram.png) |
| **Sequence diagram** (find → reserve → pay → notify) | [`sequence-diagram.md`](docs/sequence-diagram.md) | [PNG](docs/diagrams/sequence-diagram.png) |
| **Class diagram** | [`class-diagram.md`](docs/class-diagram.md) | [PNG](docs/diagrams/class-diagram.png) |
| Activity diagram + reservation state machine | [`activity-diagram.md`](docs/activity-diagram.md) | [PNG](docs/diagrams/activity-diagram-1.png), [PNG](docs/diagrams/activity-diagram-2.png) |
| ER diagram | [`database-design.md`](docs/database-design.md) | [PNG](docs/diagrams/database-design.png) |
| System architecture, auth flow | [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | [PNG](docs/diagrams/ARCHITECTURE-1.png), [PNG](docs/diagrams/ARCHITECTURE-2.png) |

## Testing

```bash
cd backend  && npm test          # 39 unit + API tests against PostgreSQL (database smartparking_test)
cd frontend && npm test          # 10 component tests
cd frontend && npm run test:e2e  # 2 browser journeys (run `npx playwright install chromium` once; seed first)
npm run typecheck && npm run lint  # from the project root
```

Highlights: double booking is tested with **8 simultaneous requests for the same slot** (exactly one succeeds);
payment failure and retry; cancellation refunds (100% / 50% / not allowed); hold expiry; the full reservation
lifecycle; role checks; expired tokens. Test case table (ID, module, input, expected, actual, status) and manual
test checklist: [`docs/TESTING.md`](docs/TESTING.md).

## Security

- Passwords hashed with bcrypt; never returned by any endpoint, including admin ones.
- JWT authentication with expiry; the user is re-checked on every request, so deactivation takes effect immediately.
- Role-based authorisation on the server (`requireRole('ADMIN')`) plus ownership checks for bookings, payments and notifications.
- Zod validation of every request body, query and URL parameter; Drizzle uses parameterised SQL (no SQL injection).
- Helmet security headers, CORS allow-list, rate limiting on login/register and the API in production.
- Razorpay key secret stays on the server; payments are confirmed only after HMAC-SHA256 signature verification; the amount always comes from the database.
- Central error handler: consistent error codes, no stack traces to clients.
- Secrets only in `.env` (git-ignored); `.env.example` documents them.

## Deployment

Frontend on Vercel, backend on Render or Railway, database on Neon or Supabase. Step-by-step guide and production
checklist: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The application also runs completely on a local machine.

## Software Engineering mapping

| Case study requirement | Implementation |
|---|---|
| Locate available parking | Parking search + filters + map + availability API |
| View available spaces | Slot grid with availability for the chosen time; live updates via Socket.IO |
| Reserve parking slot | Reservation module: server-side validation, transaction with row lock, pending hold |
| Make payments | Razorpay test-mode integration with signature verification; simulated fallback |
| Receive notifications | Persisted in-app notifications (real time) + e-mail via Nodemailer |
| Administrators monitor occupancy | Admin dashboard and occupancy page, real-time; simulation mode in place of sensors |
| Manage parking areas | Admin CRUD for areas, slots, rates and operating hours |
| (implied) Manage users, payments, reports | Admin user, payment and report modules |
| SE deliverable: stakeholders + SRS | [`docs/SRS.md`](docs/SRS.md), traceability in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) |
| SE deliverable: sequence diagram | [`docs/sequence-diagram.md`](docs/sequence-diagram.md) |
| SE deliverable: class diagram | [`docs/class-diagram.md`](docs/class-diagram.md) |

## Design decisions and deviations from the brief

| Decision | Why |
|---|---|
| **Drizzle ORM instead of Prisma** | Prisma downloads native engine binaries at install time, which was blocked in the build environment, so the backend could not have been run or tested with it. Drizzle is pure TypeScript, gives the same type-safe schema-first workflow (`schema.ts` → SQL migrations, parameterised queries, transactions), and lets every flow be verified against a real PostgreSQL database. Switching back is possible: the schema maps one-to-one to Prisma models. |
| **bcryptjs instead of bcrypt** | Same algorithm and hash format, but pure JavaScript, so `npm install` never fails on Windows machines without C++ build tools. |
| **Simulated payment gateway** when no Razorpay keys are set | The brief asks for a mock fallback for external credentials. It is labelled "Simulated" in the UI, in the database (`provider = MOCK`) and in the admin payments list. |
| Slot status = live state; availability = per time window | A booking for tomorrow should not make a bay look taken today. Bays show RESERVED from 30 minutes before a paid booking until it ends. |
| Billing in 30-minute blocks, rounded up | Fair for short stays and simple to explain ("fractional/rounded hours"). |
| Parking areas are deactivated, not deleted | Reservations and payments must keep their history. |
| Lazy-loaded admin console | Customers never download the admin code. |

## Limitations

1. No physical parking sensors; occupancy is changed by the administrator in **Simulation Mode**.
2. Razorpay runs in test mode only; refunds are recorded in the database and requested from Razorpay on a best-effort basis.
3. E-mail requires SMTP settings; without them e-mails are written to the backend console.
4. Maps use OpenStreetMap's public tile server, which is fine for demos but has a fair-use policy.
5. A booking at an area that is not open 24 hours must start and end on the same day.
6. One currency (INR), one tax rate and one time zone for the whole system.
7. Overstays and no-shows are not detected.
8. Logout is client-side (JWTs are stateless); a stolen token stays valid until it expires.

## Future enhancements

IoT parking sensors · automatic number plate recognition · smart gates (QR / RFID) · AI-based demand prediction ·
dynamic pricing · EV charging management and billing · navigation integration · native mobile apps on the same API ·
digital wallet · advanced analytics · PARKING_MANAGER role per area · Redis for caching and distributed locks ·
microservices behind an API gateway (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#future-architecture)).

## Authors

- Majeti Shreeram Phaneendra – B.E. Information Technology, Chaitanya Bharathi Institute of Technology (CBIT), Hyderabad

Software Engineering case study: *Smart Parking Management System*.
