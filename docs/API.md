# REST API Reference

Base URL (development): `http://localhost:5000/api`

- Requests and responses are JSON.
- Protected endpoints need `Authorization: Bearer <token>` (the token from login or register).
- **Access** column: `Public` = no token, `User` = any signed-in account, `Admin` = administrator only.

## Errors

Every error has the same shape. Stack traces are never returned.

```json
{ "error": { "code": "SLOT_ALREADY_RESERVED", "message": "This slot is already reserved for the selected time.", "details": [] } }
```

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input; `details` lists `{ field, message }` |
| 400 | `INVALID_TIME_RANGE`, `PARKING_CLOSED`, `PARKING_UNAVAILABLE`, `VEHICLE_MISMATCH` | Booking rule broken |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | Not signed in / bad login / expired JWT |
| 402 | `PAYMENT_FAILED` | Gateway declined or signature invalid |
| 403 | `FORBIDDEN`, `ACCOUNT_INACTIVE` | Wrong role, someone else's resource, deactivated account |
| 404 | `NOT_FOUND` | Unknown resource |
| 409 | `EMAIL_TAKEN`, `SLOT_ALREADY_RESERVED`, `SLOT_UNAVAILABLE`, `NOT_PAYABLE`, `CANNOT_CANCEL`, `SLOT_EXISTS`, `SLOT_IN_USE` | Conflict with current state |
| 429 | `RATE_LIMITED` | Too many requests (production only) |
| 500 | `INTERNAL_ERROR` | Unexpected error |
| 502 | `PAYMENT_GATEWAY_ERROR` | Razorpay did not respond |

## Auth and account

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create an account. Body: `name, email, password, phone?`. Returns `{ token, user }`. |
| POST | `/auth/login` | Public | Body: `email, password`. Returns `{ token, user }`. |
| POST | `/auth/logout` | User | Ends the session (the client discards its token). |
| GET | `/auth/me` | User | Current user. |
| PUT | `/auth/profile` | User | Update `name, phone`. |
| PUT | `/auth/password` | User | Body: `currentPassword, newPassword`. |
| GET | `/vehicles` | User | List my vehicles. |
| POST | `/vehicles` | User | Body: `vehicleNumber, vehicleType`. |
| DELETE | `/vehicles/:id` | User | Remove a vehicle. |
| GET | `/dashboard` | User | Active and upcoming reservation, statistics, recent payments and notifications. |

Password rule: at least 8 characters with a letter and a digit.

## Parking areas

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/parking` | Public | Search areas. Query: `q, vehicleType, maxPrice, availableOnly, evOnly, sort, lat, lng`. Admins may add `includeInactive=true`. |
| GET | `/parking/:id` | Public | One area with rates, hours and slot counts. Query: `lat, lng` for distance. |
| POST | `/parking` | Admin | Create. Body: `name, description, address, city, latitude, longitude, is24x7, rates?, operatingHours?`. |
| PUT | `/parking/:id` | Admin | Update any of the above, or `status`. |
| DELETE | `/parking/:id` | Admin | Deactivate (soft delete; history is kept). |
| PUT | `/parking/:id/rates` | Admin | Body: `{ rates: [{ vehicleType, hourlyRate }] }`. |
| PUT | `/parking/:id/hours` | Admin | Body: `{ is24x7?, operatingHours: [7 × { dayOfWeek, openTime, closeTime, isClosed }] }`. |

`sort`: `name` (default), `price_asc`, `price_desc`, `availability`, `distance` (needs `lat`/`lng`).

Example area (abridged):

```json
{
  "id": "…", "name": "HITEC City Parking", "address": "Cyber Towers Road, HITEC City, Hyderabad 500081",
  "latitude": 17.4474, "longitude": 78.3762, "is24x7": true, "status": "ACTIVE",
  "rates": [{ "vehicleType": "BIKE", "hourlyRate": 20 }, { "vehicleType": "CAR", "hourlyRate": 60 }],
  "pricePerHour": 20, "totalSlots": 30, "availableSlots": 23,
  "counts": { "AVAILABLE": 23, "RESERVED": 1, "OCCUPIED": 4, "MAINTENANCE": 2 },
  "occupancyPercent": 16.7, "isOpenNow": true, "todayHours": "Open 24 hours", "distanceKm": 0.4
}
```

## Slots

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/parking/:id/slots` | Public | Slots of an area. Query: `start, end` (ISO date-times), `vehicleType`. With a window, `bookable` says whether the slot can be reserved for that period. |
| POST | `/parking/:id/slots` | Admin | Body: `slotNumber, floor, vehicleType, price?, isEv`. |
| PUT | `/slots/:id` | Admin | Edit a slot. `price: null` means "use the area rate". |
| PATCH | `/slots/:id/status` | Admin | Body: `{ status: "AVAILABLE" \| "OCCUPIED" \| "MAINTENANCE" }`. Used by the occupancy simulation. |
| DELETE | `/slots/:id` | Admin | Delete a slot that has no booking history. |

## Reservations

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/reservations/quote` | User | Validate a booking and return the price, without saving. |
| POST | `/reservations` | User | Create a `PENDING` reservation (holds the slot for the payment window). |
| GET | `/reservations` | User | My reservations. Query: `tab` = `upcoming \| active \| completed \| cancelled \| all`, `page`, `pageSize`. |
| GET | `/reservations/:id` | User | One reservation (owner or admin). |
| PATCH | `/reservations/:id/cancel` | User | Cancel under the cancellation policy. Body: `reason?`. |

Booking body: `{ "slotId": "uuid", "vehicleId": "uuid (optional)", "startTime": "ISO", "endTime": "ISO" }`

Quote response:

```json
{ "billedHours": 2, "hourlyRate": 40, "baseAmount": 80, "taxPercent": 18, "taxAmount": 14.4, "totalAmount": 94.4, "currency": "INR" }
```

Rules enforced on the server: slot exists and is not under maintenance; start not in the past; 30 minutes
to 24 hours long; at most 30 days ahead; inside operating hours; no overlapping reservation; vehicle type fits the slot.

## Payments

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/create-order` | User | Body: `{ reservationId }`. Creates the gateway order. Returns `orderId, amount, amountInPaise, currency, provider, keyId`. |
| POST | `/payments/verify` | User | Verifies the payment and confirms the reservation. Razorpay: `reservationId, razorpayOrderId, razorpayPaymentId, razorpaySignature`. Simulated gateway: `reservationId, mockOutcome` (`success` or `failure`). |
| GET | `/payments` | User | My recent payments. |
| GET | `/payments/:id` | User | One payment (owner or admin). |

## Notifications

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/notifications` | User | `{ items, unread }` |
| PATCH | `/notifications/:id/read` | User | Mark one as read. |
| PATCH | `/notifications/read-all` | User | Mark all as read. |

## Admin

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Totals (areas, slots by status, today's reservations and revenue, users) and chart data. |
| GET | `/admin/occupancy` | Per-area total / available / reserved / occupied / maintenance and occupancy %. |
| GET | `/admin/revenue?days=30` | Revenue report: totals, per day, per area, per vehicle type, by status, peak hours. |
| GET | `/admin/users` | Users with booking counts. Query: `q, page, pageSize`. Never includes passwords. |
| GET | `/admin/users/:id` | One user with vehicles and total spent. |
| PATCH | `/admin/users/:id/status` | Body: `{ status: "ACTIVE" \| "INACTIVE" }`. |
| GET | `/admin/reservations` | All reservations. Query: `q, status, areaId, page, pageSize`. |
| PATCH | `/admin/reservations/:id/cancel` | Cancel any pending / confirmed / active reservation with a full refund. |
| GET | `/admin/payments` | All payments. Query: `q, status, page, pageSize`. |
| GET | `/admin/slots` | All slots. Query: `areaId`. |
| GET | `/admin/notifications` | Latest 100 notifications across users. |
| POST | `/admin/notifications` | Send a system notification. Body: `title, message, userId?` (omit to reach all customers). |

## Utility

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness check. |
| GET | `/config` | Public | Non-secret settings: payment provider, tax %, hold minutes, cancellation policy. |

## Socket.IO events (server → client)

Connect to the backend origin with `auth: { token }` (optional).

| Event | Payload | Audience |
|---|---|---|
| `slots:changed` | `{ areaId }` | Everyone |
| `notification:new` | the notification | The user it belongs to |
| `admin:activity` | `{ kind, at }` | Administrators |

## Trying it with curl

```bash
# Log in as the demo user and keep the token
TOKEN=$(curl -s localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"user@smartparking.local","password":"User@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s "localhost:5000/api/parking?vehicleType=CAR&sort=price_asc"
curl -s localhost:5000/api/reservations -H "Authorization: Bearer $TOKEN"
```
