# Requirements Traceability

Every requirement in the SRS (`SRS.md`, section 9) traced to where it is implemented and how it is tested.
Test IDs refer to `TESTING.md`.

## Case study → implementation

| Case study requirement | Implementation |
|---|---|
| "Locate available parking spaces" | Parking search, filters, map and availability API (`/parking`, `GET /api/parking`, `GET /api/parking/:id/slots`) |
| "Reserve a parking slot" | Reservation module with server-side validation and double-booking prevention (`POST /api/reservations`) |
| "Make payments" | Razorpay test-mode integration with a simulated fallback (`/api/payments/create-order`, `/api/payments/verify`) |
| "Receive notifications" | Persisted in-app notifications pushed over Socket.IO, plus e-mail via Nodemailer |
| "Administrators can monitor occupancy" | Admin dashboard and occupancy page with real-time updates (`GET /api/admin/occupancy`) |
| "Manage parking areas" | Admin CRUD for areas, slots, rates and operating hours |
| SE deliverable 1: stakeholders and SRS | `SRS.md` (stakeholders in section 5) |
| SE deliverable 2: sequence diagram | `sequence-diagram.md` |
| SE deliverable 3: class diagram | `class-diagram.md` |

## Functional requirements

| ID | Requirement (short) | Backend | Frontend | Tests |
|---|---|---|---|---|
| FR-01 | Register | `POST /auth/register` · `auth.service.register` | `/register` | TC-01, TC-E1 |
| FR-02 | Reject duplicate e-mail | `auth.service.register` | `/register` field error | TC-02 |
| FR-03 | Login with token | `POST /auth/login` · `utils/jwt` | `/login` | TC-03, TC-04, TC-16 |
| FR-04 | Logout | `POST /auth/logout` | navbar / sidebar | TC-E1 |
| FR-05 | Profile and password | `PUT /auth/profile`, `PUT /auth/password` | `/profile` | TC-17 |
| FR-06 | Vehicles | `/vehicles` | `/profile` | TC-18 |
| FR-07 | Role-based access | `middleware/auth` (`authenticate`, `requireRole`) | `routes/guards.tsx` | TC-14, TC-F6, TC-E1 |
| FR-08 | List areas with availability | `GET /parking` · `parking.service.listAreas` | `/parking`, landing | TC-05 |
| FR-09 | Search by name / location | `GET /parking?q=` | search box | TC-05, TC-E1 |
| FR-10 | Filter by type, price, availability | `GET /parking?vehicleType&maxPrice&availableOnly` | filter bar | TC-19 |
| FR-11 | Sort by price, availability, distance | `GET /parking?sort&lat&lng` · `utils/geo` | sort menu | TC-19, TC-U4 |
| FR-12 | Map with markers and popup | data from `GET /parking` | `ParkingMap.tsx` (Leaflet + OSM) | Manual TC-M1 |
| FR-13 | User location with fallback | — | `useGeolocation.ts` | Manual TC-M1 |
| FR-14 | Parking details | `GET /parking/:id` | `/parking/:id` | TC-06, TC-E1 |
| FR-15 | Slot availability for a time | `GET /parking/:id/slots?start&end` · `availability.conflictingSlotIds` | `SlotGrid.tsx` | TC-06, TC-13, TC-F3 |
| FR-16 | Select slot, date, times | — | `/parking/:id` | TC-E1 |
| FR-17 | Server-side booking checks | `reservation.service.validateBooking` | error messages | TC-20, TC-21 |
| FR-18 | No double booking | `createReservation` (row lock + overlap check) | "slot already reserved" message | TC-08, TC-22 |
| FR-19 | Price calculated on server | `utils/pricing.calculatePrice`, `POST /reservations/quote` | `PriceBreakdown.tsx` (display only) | TC-U1, TC-U2, TC-23 |
| FR-20 | Pending reservation holds slot | `POST /reservations` | `/booking/:id` | TC-07 |
| FR-21 | Expire unpaid holds | `jobs/reservationLifecycle` | countdown on payment step | TC-24 |
| FR-22 | Create payment order | `payment.service.createOrder` | payment step | TC-10 |
| FR-23 | Verify payment on server | `payment.service.verifyPayment`, `payment.gateway.isValidSignature` | — | TC-09, TC-10 |
| FR-24 | Store payment record | `payments` table | booking details, admin payments | TC-09 |
| FR-25 | Payment failure, retry | `verifyPayment` (402) | "Retry payment" | TC-10, TC-E1 |
| FR-26 | In-app notifications | `notification.service.notify` | bell, `/notifications` | TC-15 |
| FR-27 | Unread count, real time | `sockets.emitToUser` | `NotificationBell.tsx` | TC-15, TC-E1 |
| FR-28 | Mark read / all read | `PATCH /notifications/...` | bell, `/notifications` | TC-15 |
| FR-29 | E-mail with fallback | `email.service.sendEmail` | — | Manual TC-M3 |
| FR-30 | Bookings by tab | `GET /reservations?tab=` | `/bookings` | TC-09, TC-E1 |
| FR-31 | Details, QR, receipt | `GET /reservations/:id` | `/bookings/:id` | TC-E1, Manual TC-M4 |
| FR-32 | Cancel with policy and refund | `cancelReservation`, `utils/pricing.refundPolicy` | cancel dialog | TC-11, TC-U3 |
| FR-33 | Auto activate / complete | `jobs/reservationLifecycle.runLifecycle` | status badges | TC-25 |
| FR-34 | Separate admin interface | `requireAdmin` | `/admin/*`, `AdminLayout` | TC-E2 |
| FR-35 | Admin dashboard figures | `GET /admin/dashboard` | `/admin` | TC-12, TC-E2 |
| FR-36 | Manage parking areas | `POST/PUT/DELETE /parking` | `/admin/parking` | TC-26 |
| FR-37 | Rates and hours | `PUT /parking/:id/rates`, `/hours` | `/admin/parking/:id` | TC-26 |
| FR-38 | Manage slots | `POST /parking/:id/slots`, `PUT/DELETE /slots/:id` | `/admin/slots`, `/admin/parking/:id` | TC-26 |
| FR-39 | Change slot status | `PATCH /slots/:id/status` | `/admin/slots`, `/admin/occupancy` | TC-13, TC-E2 |
| FR-40 | Occupancy monitoring | `GET /admin/occupancy` · `availability.countSlots` | `/admin/occupancy` | TC-13, TC-U5, TC-E2 |
| FR-41 | Search / filter reservations | `GET /admin/reservations` | `/admin/reservations` | TC-27, TC-E2 |
| FR-42 | View and cancel reservation | `PATCH /admin/reservations/:id/cancel` | details modal | TC-27 |
| FR-43 | View users | `GET /admin/users` | `/admin/users` | TC-27, TC-E2 |
| FR-44 | Activate / deactivate user | `PATCH /admin/users/:id/status` | `/admin/users` | TC-27 |
| FR-45 | Never show passwords | hash excluded from every query result | — | TC-01, TC-27 |
| FR-46 | View payments | `GET /admin/payments` | `/admin/payments` | TC-27, TC-E2 |
| FR-47 | Manage notifications | `GET/POST /admin/notifications` | `/admin/notifications` | TC-27 |
| FR-48 | Confirm destructive actions | — | `ConfirmDialog` | Manual TC-M5 |
| FR-49 | Revenue statistics | `GET /admin/revenue` | `/admin/reports` | TC-27, TC-E2 |
| FR-50 | Occupancy / reservation charts | `GET /admin/dashboard` | Recharts on `/admin`, `/admin/reports` | TC-12 |
| FR-51 | Export report | — | CSV export, print | Manual TC-M6 |
| FR-52 | Real-time availability | `sockets.emitSlotsChanged` | `useRealtime.ts` | TC-E2, Manual TC-M2 |

## Non-functional requirements

| ID | How it is met | Verified by |
|---|---|---|
| NFR-S1 | `bcryptjs` hash with cost 10; `passwordHash` stripped from every response | TC-01, TC-03, TC-27 |
| NFR-S2 | `authenticate` middleware; 1-day token expiry | TC-16 |
| NFR-S3 | `requireRole('ADMIN')`; ownership checks in services | TC-14, TC-10 |
| NFR-S4 | Zod schemas in `validators/`; Drizzle parameterised queries | TC-20, TC-28 |
| NFR-S5 | `config/env.ts`, `.env.example`, `.gitignore` | Code review |
| NFR-S6 | Key secret used only in `payment.gateway.ts`; HMAC verification | TC-10 |
| NFR-S7 | Helmet, CORS allow-list, `express-rate-limit` (production) | Code review |
| NFR-S8 | Central `errorHandler` returns code + message only | TC-28 |
| NFR-P1 to P4 | Indexed queries, connection pool, React Query caching, lazy-loaded admin bundle | Manual timing |
| NFR-A2 | E-mail failures caught and logged; map is independent of data | TC-09 (runs with no SMTP) |
| NFR-A3 | PostgreSQL persistence; transactions | TC-09 |
| NFR-A4 | Hold expiry in overlap check and scheduled job | TC-24 |
| NFR-U1 to U6 | Guided 3-step booking; loading/empty/error states; labelled controls | TC-E1, TC-F1 to TC-F6 |
| NFR-SC1 to SC3 | Data-driven areas and slots; stateless JWT API; slot-status endpoint for sensors | Design review |
| NFR-M1 to M4 | Layered folders; strict TypeScript; ESLint; 39 backend + 10 frontend + 2 browser tests | `npm run typecheck`, `npm run lint`, `npm test` |
