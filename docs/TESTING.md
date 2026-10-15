# Testing

## Strategy

| Level | Tool | Location | What it proves |
|---|---|---|---|
| Unit | Vitest | `backend/tests/unit.test.ts` | Pure rules: pricing, rounding, cancellation policy, distance, occupancy formula, validation |
| Integration / API | Vitest + Supertest | `backend/tests/*.test.ts` | Each endpoint against a **real PostgreSQL** test database: auth, search, booking, payment, notifications, admin |
| Component | Vitest + React Testing Library | `frontend/tests/components.test.tsx` | UI logic: slot grid, price display, form validation, route protection |
| End-to-end | Playwright (Chromium) | `frontend/e2e/booking.spec.ts` | The full customer and admin journeys in a browser against the running system |
| Manual | Checklist below | — | Things automation does not cover: map tiles, e-mail delivery, printing, Razorpay's hosted window |

## Running the tests

```bash
# Backend unit + API tests (needs PostgreSQL and an empty database named smartparking_test)
createdb smartparking_test
cd backend
npm test
# if your PostgreSQL user/password differ from postgres/postgres:
#   TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/smartparking_test" npm test

# Frontend component tests
cd frontend
npm test

# End-to-end tests (seed first; starts backend and frontend automatically if they are not running)
cd backend && npm run seed
cd ../frontend
npx playwright install chromium     # first time only
npm run test:e2e
```

The API tests refuse to run unless the database name contains `test`, so they can never wipe development data.

## Test case table

Status legend: **Passed** = executed by the automated suite and passing; **To Be Executed** = manual test, run it
during your demonstration and fill in the result.

### Authentication

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-01 | Registration | Valid name, e-mail, password | 201; token and user returned; no password in response | As expected | Passed |
| TC-02 | Registration | E-mail already registered (different letter case) | 409 `EMAIL_TAKEN`; "An account with this email already exists." | As expected | Passed |
| TC-03 | Login | Correct e-mail and password | 200; token; `/auth/me` returns the profile | As expected | Passed |
| TC-04 | Invalid login | Wrong password; unknown e-mail | 401 with the same message for both | As expected | Passed |
| TC-16 | Unauthorized access | No token; garbage token; expired token | 401 `UNAUTHORIZED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | As expected | Passed |
| TC-17 | Profile | New name and phone; wrong then correct current password | Profile updated; wrong password rejected; new password works | As expected | Passed |
| TC-18 | Vehicles | Add `ts09 ab 1234`; add again; delete | Stored as `TS09AB1234`; duplicate 409; delete 204 | As expected | Passed |
| TC-28 | Input validation | Name "x", e-mail "nope", password "123"; malformed UUID in URL | 400 `VALIDATION_ERROR` listing each field; 400 for bad id; no stack trace | As expected | Passed |

### Parking search and slots

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-05 | Parking search | `GET /parking`; `?q=lakeside`; `?q=nowhere` | All active areas with slot counts and price; matching area only; empty list | As expected | Passed |
| TC-19 | Filters and sorting | `vehicleType=CAR`; `maxPrice=30`; `sort=distance&lat&lng` | Counts and price for cars only; no result under ₹30; nearest first with distance in km | As expected | Passed |
| TC-06 | Slot availability | `GET /parking/:id/slots` (optionally `vehicleType=BIKE`) | Every slot with status, type, effective price, `bookable` | As expected | Passed |

### Reservation

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-23 | Price quote | Car slot ₹40/h, 2 hours | base 80, tax 14.40, total 94.40 | As expected | Passed |
| TC-07 | Reservation | Available slot, valid future window | 201; status `PENDING`; booking ref `SPK-XXXXXX`; `payBy` set | As expected | Passed |
| TC-08 | Double booking prevention | Second user, same slot, overlapping window | 409 `SLOT_ALREADY_RESERVED`; back-to-back window is accepted | As expected | Passed |
| TC-22 | Double booking (concurrent) | 8 users book the same slot and window at the same instant | Exactly one 201, seven 409; one row in the database | As expected | Passed |
| TC-20 | Invalid time range | End before start; start in the past; 6 minutes; 30 hours; missing times; unknown slot; maintenance slot | 400 `INVALID_TIME_RANGE`; 400; 404; 409 `SLOT_UNAVAILABLE` | As expected | Passed |
| TC-21 | Parking closed | Area open 08:00–20:00; windows 10–12, 06–09, 19–21 | First accepted; others 400 `PARKING_CLOSED` | As expected | Passed |
| TC-24 | Reservation expiry | Pending reservation older than the 10-minute hold | No longer blocks others; cannot be paid; job marks it `EXPIRED` | As expected | Passed |
| TC-25 | Reservation lifecycle | Booking starting in 12 minutes; then start and end times pass | Slot `RESERVED`; one reminder; `ACTIVE` at start; `COMPLETED` and slot `AVAILABLE` at end | As expected | Passed |

### Payment and notifications

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-09 | Payment success | Create order, verify with success | Payment `SUCCESS`; reservation `CONFIRMED`; appears under "upcoming"; dashboard totals updated | As expected | Passed |
| TC-10 | Payment failure | Verify before order; verify with failure; another user tries to pay; retry with success; pay twice | 400 `NO_ORDER`; 402 `PAYMENT_FAILED` and reservation stays `PENDING`; 403; `CONFIRMED`; 409 | As expected | Passed |
| TC-15 | Notifications | After TC-09 | Two unread notifications (`BOOKING_CONFIRMATION`, `PAYMENT_SUCCESS`); mark one read; mark all read; other users cannot touch them | As expected | Passed |
| TC-11 | Cancellation | Cancel 5 h before start; cancel 30 min before start; cancel twice; cancel after start | 100% refund; 50% refund; 409; 409; slot bookable again; cancellation notifications | As expected | Passed |

### Administration

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-14 | Unauthorized access | Customer or anonymous calls admin endpoints | 403 / 401 | As expected | Passed |
| TC-12 | Admin access | Admin opens dashboard | Correct counts of areas and slots, today's revenue, 14-day series | As expected | Passed |
| TC-13 | Occupancy updates | Admin marks one slot `OCCUPIED`, one `MAINTENANCE`; tries `RESERVED` | Counts 5/0/1/1 of 7; occupancy 14.3%; maintenance slot not bookable; `RESERVED` rejected (400) | As expected | Passed |
| TC-26 | Parking management | Create area; set rates; set hours; add slot; duplicate slot; edit slot; deactivate | Defaults applied; updates saved; duplicate 409; hidden from customers, visible to admin | As expected | Passed |
| TC-27 | Admin management | Revenue report; filter and search reservations; cancel one; list payments and users; deactivate and reactivate a user; broadcast | Net = gross − refunds; filters correct; full refund; no passwords in output; deactivated user locked out at once; all customers notified | As expected | Passed |

### Unit tests

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-U1 | Price calculation | ₹40/h, 2 h, 18% tax | 80 + 14.40 = 94.40 | As expected | Passed |
| TC-U2 | Billing rounding | 1 h 10 min; 30 min; 31 min | Billed as 1.5 h; 0.5 h; 1 h | As expected | Passed |
| TC-U3 | Cancellation policy | 2 h, 30 min and −1 min before start | 100%; 50%; not allowed | As expected | Passed |
| TC-U4 | Distance | CBIT to HITEC City | Between 8 and 9 km | As expected | Passed |
| TC-U5 | Occupancy formula | 20 available, 10 reserved, 18 occupied, 2 maintenance | 56% | As expected | Passed |
| TC-U6 | Vehicle fit | EV in car slot; car in EV slot; bike in car slot | Allowed; rejected; rejected | As expected | Passed |
| TC-U7 | Time zone | 20:00 UTC on 1 Jan | 01:30 on 2 Jan IST, a Wednesday | As expected | Passed |

### Frontend component tests

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-F1 | Formatting | 80; 94.4; 1.5 hours | "₹80"; "₹94.40"; "1 h 30 min" | As expected | Passed |
| TC-F2 | Date helpers | Date and time inputs; 10:05 and 10:25 | Correct date; next half hour 10:30 and 11:00 | As expected | Passed |
| TC-F3 | Slot grid | Available, booked, occupied and maintenance slots | Only the available bay can be clicked; selection is marked | As expected | Passed |
| TC-F4 | Price breakdown | Amounts from the server | Shown unchanged with tax label | As expected | Passed |
| TC-F5 | Login form | Empty form; invalid e-mail | Field errors before any request is sent | As expected | Passed |
| TC-F6 | Route protection | Anonymous visitor opens `/bookings` | Redirected to the login page | As expected | Passed |

### End-to-end tests (browser)

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-E1 | Customer journey | Register → search "hitec" → open area → select slot → review → confirm → fail payment → retry → success | Booking confirmed with `SPK-` reference; 3 unread notifications; receipt with QR; booking listed; the slot is no longer selectable; `/admin` shows "Access denied" | As expected | Passed |
| TC-E2 | Admin journey | Admin login → dashboard → occupancy → mark a bay occupied → reservations → users → payments → reports → parking areas | Bay turns red and overall occupancy rises; the customer's booking, account and payment are listed | As expected | Passed |

### Manual tests

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-M1 | Map | Open `/parking`; allow, then block, location | Map tiles and markers show; popup has name, address, free slots, price, distance, "View details"; when blocked the map centres on Hyderabad | | To Be Executed |
| TC-M2 | Real-time update | Customer on a parking page in one browser; admin marks a bay occupied in another | The bay changes colour on the customer's screen within 2 seconds, no reload | | To Be Executed |
| TC-M3 | E-mail | Configure SMTP in `.env`; register and book | Welcome, confirmation and payment e-mails arrive | | To Be Executed |
| TC-M4 | Receipt | Booking details → "Print / download receipt" | Print preview shows only the receipt; can be saved as PDF | | To Be Executed |
| TC-M5 | Confirmation dialogs | Deactivate an area; delete a slot; deactivate a user; cancel a booking | Each asks for confirmation and explains the consequence | | To Be Executed |
| TC-M6 | Report export | Reports → "Export CSV" | CSV with date, revenue, reservations downloads | | To Be Executed |
| TC-M7 | Razorpay test mode | Set Razorpay test keys; pay with a Razorpay test card / UPI ID | Razorpay window opens; success confirms the booking; failure shows an error | | To Be Executed |
| TC-M8 | Responsive layout | Use the app at phone, tablet and desktop widths | No horizontal scrolling; navigation collapses to a menu; admin sidebar becomes a drawer | | To Be Executed |
| TC-M9 | Reminder | Book a slot starting in about 35 minutes; wait | A "Parking starts soon" notification arrives about 30 minutes before start | | To Be Executed |

## Summary of the automated run

| Suite | Tests | Result |
|---|---|---|
| Backend unit + API (Vitest, Supertest, PostgreSQL 16) | 39 | 39 passed |
| Frontend components (Vitest, React Testing Library) | 10 | 10 passed |
| End-to-end (Playwright, Chromium) | 2 | 2 passed |

The automated suites were run with the simulated payment gateway and without SMTP. The Razorpay hosted
checkout, real e-mail delivery and map tiles are covered by the manual tests above (TC-M1, TC-M3, TC-M7)
and have not been executed.
