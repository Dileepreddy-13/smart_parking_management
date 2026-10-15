# Sequence Diagram: Find, Reserve and Pay for a Parking Slot

This is the required sequence diagram for the case study. It follows the code path exactly
(`frontend → REST API → service layer → PostgreSQL`), including the two alternative outcomes
(slot already taken, payment failed).

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express API)
    participant DB as Database (PostgreSQL)
    participant PG as Payment Gateway (Razorpay test / simulated)
    participant NS as Notification Service (Socket.IO + e-mail)

    rect rgb(238, 244, 255)
    Note over User,DB: 1. Find parking
    User->>FE: Search parking (location, vehicle type, price)
    FE->>BE: GET /api/parking?q=...&vehicleType=...
    BE->>DB: Query parking areas, slots and rates
    DB-->>BE: Parking areas with slot counts
    BE-->>FE: Areas with availability, price and distance
    FE-->>User: Show list and map markers
    end

    rect rgb(240, 253, 244)
    Note over User,DB: 2. Select parking, slot and time
    User->>FE: Select parking area
    FE->>BE: GET /api/parking/:id
    BE-->>FE: Details, hours and rates
    User->>FE: Select date, start time and end time
    FE->>BE: GET /api/parking/:id/slots?start=...&end=...
    BE->>DB: Find reservations overlapping the window
    DB-->>BE: Conflicting slot IDs
    BE-->>FE: Slots marked bookable / unavailable
    FE-->>User: Show slot grid
    User->>FE: Select slot
    FE->>BE: POST /api/reservations/quote
    BE->>DB: Verify slot, hours and overlaps
    BE->>BE: Calculate price (rate x billed hours + tax)
    BE-->>FE: Price breakdown
    FE-->>User: Show booking review and total
    end

    rect rgb(255, 251, 235)
    Note over User,DB: 3. Reserve
    User->>FE: Confirm reservation
    FE->>BE: POST /api/reservations
    BE->>DB: BEGIN, lock slot row (SELECT ... FOR UPDATE)
    BE->>DB: Re-check for overlapping reservations
    alt Slot already reserved for that time
        DB-->>BE: Overlap found
        BE->>DB: ROLLBACK
        BE-->>FE: 409 Slot already reserved
        FE-->>User: Ask the user to choose another slot
    else Slot is free
        BE->>DB: INSERT reservation (status PENDING), COMMIT
        DB-->>BE: Reservation created
        BE-->>FE: 201 Pending reservation (held for 10 minutes)
    end
    end

    rect rgb(245, 243, 255)
    Note over User,NS: 4. Pay
    FE->>BE: POST /api/payments/create-order
    BE->>PG: Create order (amount in paise, receipt)
    PG-->>BE: Order ID
    BE->>DB: Save payment (status PENDING, order ID)
    BE-->>FE: Order ID, amount, public key
    FE->>PG: Open payment interface
    User->>PG: Complete payment
    PG-->>FE: Payment ID and signature
    FE->>BE: POST /api/payments/verify
    BE->>BE: Verify signature (HMAC-SHA256 with key secret)
    alt Payment failed or signature invalid
        BE->>DB: UPDATE payment SET status = FAILED
        BE-->>FE: 402 Payment failed
        FE-->>User: Show error, offer retry or cancel
    else Payment verified
        BE->>DB: BEGIN, lock reservation
        BE->>DB: UPDATE payment SET status = SUCCESS
        BE->>DB: UPDATE reservation SET status = CONFIRMED, COMMIT
        BE->>DB: Sync slot status (RESERVED when the booking is near)
        BE->>NS: Booking confirmed and payment successful
        NS->>DB: INSERT notifications
        NS-->>User: In-app notification and e-mail
        BE-->>NS: Broadcast slots changed
        NS-->>FE: slots:changed event (all clients refresh availability)
        BE-->>FE: 200 Confirmed reservation
        FE-->>User: Show booking confirmation and QR reference
    end
    end
```

> Rendered image for submission: [`diagrams/sequence-diagram.png`](diagrams/sequence-diagram.png) (also available as `.svg`).

## Where each step is implemented

| Step in the case study | Realised by |
|---|---|
| User searches; frontend requests parking; backend queries database; database returns areas | `GET /api/parking` → `parking.service.listAreas` |
| User selects parking; backend returns available slots; user selects slot/time | `GET /api/parking/:id`, `GET /api/parking/:id/slots` → `slot.service.listSlots` |
| Backend verifies availability and calculates price | `POST /api/reservations/quote` → `reservation.service.quote`, `utils/pricing.calculatePrice` |
| User confirms; backend creates pending reservation | `POST /api/reservations` → `reservation.service.createReservation` |
| Payment gateway processes payment | `POST /api/payments/create-order` → `payment.service.createOrder` |
| Backend verifies payment | `POST /api/payments/verify` → `payment.service.verifyPayment`, `payment.gateway.isValidSignature` |
| Database updates reservation | transaction inside `verifyPayment` |
| Notification service sends confirmation | `notification.service.notify`, `sockets.emitToUser` |
| Frontend displays success | `frontend/src/pages/Booking.tsx` (`SuccessStep`) |
