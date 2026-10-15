# Class Diagram

The classes below are the domain model of the Smart Parking Management System. Attributes map
one-to-one to the database columns defined in `backend/src/db/schema.ts`; operations map to the
functions of the service layer (`backend/src/services/*.service.ts`), listed in the table at the end.

```mermaid
classDiagram
    direction LR

    class User {
        +UUID id
        +String name
        +String email
        -String passwordHash
        +String phone
        +UserRole role
        +AccountStatus status
        +DateTime createdAt
        +DateTime updatedAt
        +register() Session
        +login() Session
        +logout() void
        +updateProfile() User
        +changePassword() void
    }

    class Vehicle {
        +UUID id
        +UUID userId
        +String vehicleNumber
        +VehicleType vehicleType
        +DateTime createdAt
        +add() Vehicle
        +remove() void
    }

    class ParkingArea {
        +UUID id
        +String name
        +String description
        +String address
        +String city
        +Float latitude
        +Float longitude
        +Boolean is24x7
        +AccountStatus status
        +DateTime createdAt
        +DateTime updatedAt
        +getAvailableSlots() ParkingSlot[]
        +getOccupancy() Float
        +isOpenAt(time) Boolean
        +updateDetails() void
        +deactivate() void
    }

    class ParkingSlot {
        +UUID id
        +UUID parkingAreaId
        +String slotNumber
        +String floor
        +VehicleType vehicleType
        +SlotStatus status
        +Decimal price
        +Boolean isEv
        +DateTime createdAt
        +DateTime updatedAt
        +isAvailable(start, end) Boolean
        +effectivePrice() Decimal
        +updateStatus(status) void
    }

    class ParkingRate {
        +UUID id
        +UUID parkingAreaId
        +VehicleType vehicleType
        +Decimal hourlyRate
        +update(rate) void
    }

    class OperatingHour {
        +UUID id
        +UUID parkingAreaId
        +Int dayOfWeek
        +String openTime
        +String closeTime
        +Boolean isClosed
        +contains(start, end) Boolean
    }

    class Reservation {
        +UUID id
        +String bookingRef
        +UUID userId
        +UUID parkingSlotId
        +UUID vehicleId
        +DateTime startTime
        +DateTime endTime
        +Decimal billedHours
        +Decimal hourlyRate
        +Decimal baseAmount
        +Decimal taxAmount
        +Decimal amount
        +ReservationStatus status
        +Boolean reminderSent
        +DateTime cancelledAt
        +String cancelReason
        +DateTime createdAt
        +quote() PriceBreakdown
        +create() Reservation
        +confirm() void
        +cancel(reason) Decimal
        +expire() void
        +complete() void
    }

    class Payment {
        +UUID id
        +UUID reservationId
        +UUID userId
        +Decimal amount
        +String currency
        +PaymentStatus status
        +String provider
        +String razorpayOrderId
        +String razorpayPaymentId
        +Decimal refundAmount
        +String failureReason
        +DateTime paidAt
        +DateTime createdAt
        +createOrder() String
        +verify(signature) Boolean
        +refund(amount) void
    }

    class Notification {
        +UUID id
        +UUID userId
        +NotificationType type
        +String title
        +String message
        +Boolean isRead
        +UUID reservationId
        +DateTime createdAt
        +send() void
        +markAsRead() void
    }

    class UserRole {
        <<enumeration>>
        USER
        ADMIN
    }
    class SlotStatus {
        <<enumeration>>
        AVAILABLE
        RESERVED
        OCCUPIED
        MAINTENANCE
    }
    class ReservationStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        ACTIVE
        COMPLETED
        CANCELLED
        EXPIRED
    }
    class PaymentStatus {
        <<enumeration>>
        PENDING
        SUCCESS
        FAILED
        REFUNDED
    }
    class VehicleType {
        <<enumeration>>
        BIKE
        CAR
        EV
    }
    class NotificationType {
        <<enumeration>>
        BOOKING_CONFIRMATION
        PAYMENT_SUCCESS
        BOOKING_REMINDER
        BOOKING_CANCELLED
        SYSTEM
    }

    User "1" *-- "0..*" Vehicle : owns
    User "1" --> "0..*" Reservation : makes
    User "1" --> "0..*" Payment : pays
    User "1" *-- "0..*" Notification : receives
    ParkingArea "1" *-- "0..*" ParkingSlot : contains
    ParkingArea "1" *-- "1..3" ParkingRate : priced by
    ParkingArea "1" *-- "7" OperatingHour : open during
    ParkingSlot "1" --> "0..*" Reservation : booked by
    Vehicle "0..1" <-- "0..*" Reservation : for
    Reservation "1" *-- "0..1" Payment : paid by
    Reservation "0..1" <-- "0..*" Notification : about

    User ..> UserRole
    ParkingSlot ..> SlotStatus
    ParkingSlot ..> VehicleType
    Reservation ..> ReservationStatus
    Payment ..> PaymentStatus
    Notification ..> NotificationType
```

> Rendered image for submission: [`diagrams/class-diagram.png`](diagrams/class-diagram.png) (also available as `.svg`).

## Relationships and multiplicity

| Relationship | Multiplicity | Kind | Meaning |
|---|---|---|---|
| User – Vehicle | 1 to 0..* | Composition | A vehicle belongs to exactly one user and is deleted with the user. |
| User – Reservation | 1 to 0..* | Association | A user makes many reservations; a reservation has exactly one user. |
| User – Notification | 1 to 0..* | Composition | Notifications exist only for their user. |
| User – Payment | 1 to 0..* | Association | Every payment records who paid. |
| ParkingArea – ParkingSlot | 1 to 0..* | Composition | A slot cannot exist without its parking area. |
| ParkingArea – ParkingRate | 1 to 1..3 | Composition | One hourly rate per vehicle type offered. |
| ParkingArea – OperatingHour | 1 to 7 | Composition | One row per day of the week. |
| ParkingSlot – Reservation | 1 to 0..* | Association | A slot is booked many times, never for overlapping periods. |
| Reservation – Payment | 1 to 0..1 | Composition | A reservation has at most one payment record (retries update it). |
| Reservation – Vehicle | 0..* to 0..1 | Association | The vehicle is optional. |
| Notification – Reservation | 0..* to 0..1 | Association | Booking notifications link to their reservation. |

## Where each operation is implemented

| Class | Operation | Implementation |
|---|---|---|
| User | register, login, updateProfile, changePassword | `auth.service.ts` |
| Vehicle | add, remove | `vehicle.service.ts` |
| ParkingArea | getAvailableSlots, getOccupancy, updateDetails, deactivate | `parking.service.ts` |
| ParkingArea | isOpenAt | `availability.ts` (`isOpenAt`, `assertWithinOperatingHours`) |
| ParkingSlot | isAvailable | `availability.ts` (`conflictingSlotIds`) |
| ParkingSlot | updateStatus | `slot.service.ts` (`changeSlotStatus`), `availability.ts` (`syncSlotStatuses`) |
| Reservation | quote, create, cancel | `reservation.service.ts` |
| Reservation | expire, complete | `jobs/reservationLifecycle.ts` |
| Payment | createOrder, verify | `payment.service.ts`, `payment.gateway.ts` |
| Payment | refund | `reservation.service.ts` (`cancelReservation`), `payment.gateway.ts` (`refundOnGateway`) |
| Notification | send, markAsRead | `notification.service.ts` |

> The backend is written in a functional service style rather than with ES classes, which is
> idiomatic for Express + TypeScript. The class diagram is the conceptual (analysis-level) model:
> each class is a database entity plus the service functions that operate on it.
