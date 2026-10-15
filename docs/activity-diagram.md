# Activity Diagram: Booking a Parking Slot

```mermaid
flowchart TD
    Start([Start]) --> Login[Login]
    Login --> Search[Search parking]
    Search --> SelectArea[Select parking area]
    SelectArea --> SelectTime[Select date, start time and end time]
    SelectTime --> Check[System checks availability for that time]
    Check --> Avail{Slot available?}
    Avail -- No --> Another[Select another slot or time]
    Another --> Check
    Avail -- Yes --> SelectSlot[Select slot]
    SelectSlot --> Price[System calculates price]
    Price --> Review[Review booking]
    Review --> Confirm[Confirm booking]
    Confirm --> Lock{Still free at the moment of booking?}
    Lock -- No, someone booked first --> Another
    Lock -- Yes --> Pending[Create PENDING reservation and hold slot for 10 min]
    Pending --> Pay[Payment]
    Pay --> Paid{Payment successful?}
    Paid -- No --> Retry{Retry or cancel?}
    Retry -- Retry --> Pay
    Retry -- Cancel / hold expires --> Release[Release slot: reservation CANCELLED or EXPIRED]
    Release --> End2([End])
    Paid -- Yes --> Confirmed[Confirm reservation: status CONFIRMED]
    Confirmed --> Notify[Send notification: in-app and e-mail]
    Notify --> Show[Show confirmation on dashboard]
    Show --> End([End])
```

> Rendered image for submission: [`diagrams/activity-diagram-1.png`](diagrams/activity-diagram-1.png) (also available as `.svg`).

## Reservation state machine

The activity above moves a reservation through these states. Transitions on the right-hand side
are made automatically by the scheduled job (`backend/src/jobs/reservationLifecycle.ts`, every minute).

```mermaid
stateDiagram-v2
    [*] --> PENDING: reservation created
    PENDING --> CONFIRMED: payment verified
    PENDING --> ACTIVE: payment verified after start time
    PENDING --> EXPIRED: not paid within 10 minutes (job)
    PENDING --> CANCELLED: user cancels
    CONFIRMED --> ACTIVE: start time reached (job)
    CONFIRMED --> CANCELLED: user or admin cancels (refund)
    ACTIVE --> COMPLETED: end time passed (job), slot freed
    ACTIVE --> CANCELLED: admin cancels (full refund)
    CONFIRMED --> COMPLETED: end time passed (job)
    COMPLETED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
```

> Rendered image for submission: [`diagrams/activity-diagram-2.png`](diagrams/activity-diagram-2.png) (also available as `.svg`).
