# Software Requirements Specification

**Project:** Smart Parking Management System
**Type:** Software Engineering case study
**Version:** 1.0
**Standard followed:** structure adapted from IEEE 830 / ISO/IEC/IEEE 29148

---

## 1. Introduction

Finding parking in a busy city wastes time and fuel and adds to congestion, while parking operators
often cannot see how full their facilities are. This document specifies a Smart Parking Management
System that lets drivers find, reserve and pay for a parking slot from a web or mobile browser, and lets
parking administrators monitor occupancy and manage parking areas.

### Problem statement

> A city plans to develop a Smart Parking Management System that allows users to locate available parking
> spaces through a mobile/web application. Users can reserve a parking slot, make payments, and receive
> notifications. Parking administrators can monitor occupancy and manage parking areas.

## 2. Purpose

This SRS defines what the system must do (functional requirements) and how well it must do it
(non-functional requirements). It is the agreed reference for design, implementation, testing and
evaluation. Intended readers: the project team, the course instructor and evaluators, and future maintainers.

## 3. Scope

**In scope**

- Customer web application: registration, login, parking search with map, slot availability, reservation, online payment, notifications, booking history and receipts.
- Administrator web application: dashboard, parking area and slot management, rates and operating hours, occupancy monitoring, reservation, user and payment management, reports.
- REST API, real-time updates, relational database, automated reservation lifecycle.

**Out of scope for this version**

- Physical IoT sensors, barrier gates and number plate recognition (occupancy is simulated by the administrator).
- Native Android/iOS apps (the web application is responsive and works in mobile browsers).
- Real-money payments (Razorpay test mode or a simulated gateway only).
- Turn-by-turn navigation, dynamic pricing and monthly passes.

## 4. Definitions

| Term | Meaning |
|---|---|
| Parking area | A parking facility at one address, containing slots. |
| Slot / bay | One parking space for one vehicle. |
| Reservation / booking | A user's right to use one slot for a time window. |
| Pending hold | An unpaid reservation that blocks its slot for a limited time (default 10 minutes). |
| Occupancy | (Occupied + Reserved slots) ÷ Total slots × 100. |
| Double booking | Two reservations of the same slot for overlapping times. Must never happen. |
| JWT | JSON Web Token, the signed session token sent with each API request. |
| RBAC | Role-based access control (roles: USER, ADMIN). |
| Simulation mode | Admin screen where slot occupancy is changed by hand in place of sensors. |
| SRS, FR, NFR | Software Requirements Specification, Functional / Non-functional Requirement. |

## 5. Stakeholders

### Primary stakeholders

| | **Customer / User** | **Parking Administrator** |
|---|---|---|
| **Role** | Driver who needs a parking space. | Staff member who runs one or more parking areas. |
| **Responsibilities** | Provide correct account and booking details; pay for reservations; arrive and leave within the booked time. | Keep parking areas, slots, rates and hours accurate; monitor occupancy; resolve booking problems. |
| **Interests** | Find parking quickly; be sure the slot is really reserved; clear price; easy cancellation; timely reminders. | High utilisation and revenue; accurate live picture of occupancy; little manual work; reliable records. |
| **System interaction** | Customer web app on phone or laptop. | Admin web app (separate interface behind admin login). |
| **Requirements** | FR-01 to FR-33, FR-52 | FR-34 to FR-52 |

### Secondary stakeholders

| Stakeholder | Role | Responsibilities | Interests | System interaction | Requirements |
|---|---|---|---|---|---|
| **Payment gateway** (Razorpay) | External payment processor | Create orders, collect payment, report the result, process refunds | Correct, secure API usage; valid signatures | Backend calls its API; the browser opens its checkout window | FR-22 to FR-25, NFR-S6 |
| **City / parking management authority** | Owner and regulator of the parking infrastructure | Set parking policy and tariffs; fund and oversee the system | Less congestion, transparent revenue, usage statistics for planning | Receives reports produced by administrators | FR-49 to FR-51 |
| **Notification / e-mail service** | Delivery channel (Socket.IO, SMTP) | Deliver in-app and e-mail messages | Valid recipients; acceptable sending volume | Backend sends messages through it | FR-26 to FR-29 |
| **System administrators** | Technical operators | Deploy, configure, back up and monitor the system | Easy configuration, clear logs, security, no secrets in code | Environment variables, database, hosting platform | NFR-S5, NFR-M1 to NFR-M4 |
| **Maintenance staff** | People who repair and clean bays | Report and fix unusable bays | Bays under repair must not be booked | Indirect: an administrator marks slots as MAINTENANCE | FR-39 |

### Future stakeholders

| Stakeholder | Role | Responsibilities | Interests | System interaction | Requirements |
|---|---|---|---|---|---|
| **IoT sensor providers** | Supply bay sensors and a gateway | Report vehicle presence per bay | A simple, stable integration interface | Would call the slot-status API in place of the simulation | FR-40, NFR-SC3 |
| **Traffic management systems** | City traffic control | Use parking availability to guide traffic | Open, real-time availability data | Would consume the public availability API | FR-08, NFR-SC3 |

## 6. Product perspective

The product is a new, self-contained web system with a three-tier architecture: a React single-page
application, a Node.js/Express REST API with a Socket.IO channel, and a PostgreSQL database. It depends
on three external services: OpenStreetMap (map tiles), Razorpay (payments, test mode) and an SMTP server
(e-mail). All three have fallbacks so the system runs on a single laptop with no accounts.
See `ARCHITECTURE.md` for diagrams.

## 7. Product functions

1. **Account management**: register, log in/out, profile, vehicles.
2. **Parking discovery**: search, filter, sort, list view, map view, parking details.
3. **Availability**: live slot status and availability for a chosen time window.
4. **Reservation**: select slot and time, server-side validation, price calculation, pending hold.
5. **Payment**: order creation, checkout, verification, refunds.
6. **Notifications**: in-app (real time) and e-mail for confirmation, payment, reminder, cancellation.
7. **Booking management**: current and past bookings, details, QR reference, receipt, cancellation.
8. **Administration**: parking areas, slots, rates, operating hours, reservations, users, payments.
9. **Monitoring and reporting**: dashboard, occupancy monitoring, revenue and usage reports.

## 8. User classes

| Class | Description | Technical skill | Frequency | Access |
|---|---|---|---|---|
| Visitor | Not logged in. Can browse parking areas and availability. | Any | Occasional | Public pages |
| Customer (USER) | Registered driver. | Basic smartphone use | A few times a week | Customer app |
| Administrator (ADMIN) | Parking staff. | Comfortable with web dashboards | Daily | Admin app |

A `PARKING_MANAGER` role (administrator restricted to assigned areas) is a possible future class.

## 9. Functional requirements

Priority: **H** = must have, **M** = should have, **L** = nice to have.

### Authentication and account

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The system shall allow users to register with name, e-mail, password and optional phone number. | H |
| FR-02 | The system shall reject registration with an e-mail that is already registered. | H |
| FR-03 | The system shall authenticate registered users by e-mail and password and issue a time-limited token. | H |
| FR-04 | The system shall allow users to log out. | H |
| FR-05 | The system shall allow users to view and update their profile and change their password. | M |
| FR-06 | The system shall allow users to add and remove vehicles (registration number and type). | M |
| FR-07 | The system shall restrict each function to the roles permitted to use it. | H |

### Locating parking

| ID | Requirement | Priority |
|---|---|---|
| FR-08 | The system shall display parking areas with address, price per hour, total slots and currently available slots. | H |
| FR-09 | The system shall allow users to search parking areas by name or location. | H |
| FR-10 | The system shall allow users to filter parking areas by vehicle type, maximum price and availability. | H |
| FR-11 | The system shall allow users to sort parking areas by price, availability and distance. | M |
| FR-12 | The system shall display parking areas as markers on an interactive map, with a popup showing name, address, available slots, price, distance and a link to details. | H |
| FR-13 | The system shall show the user's own location on the map when permission is granted and fall back to the city centre otherwise. | M |
| FR-14 | The system shall display parking details: description, operating hours, rates, slot layout, slot status, vehicle type and EV charging availability. | H |
| FR-15 | The system shall display each slot's availability for the date and time selected by the user. | H |

### Reservation

| ID | Requirement | Priority |
|---|---|---|
| FR-16 | The system shall allow a logged-in user to select a slot, date, start time and end time. | H |
| FR-17 | The system shall verify on the server that the slot exists, is not under maintenance, the time range is valid and the parking area is open. | H |
| FR-18 | The system shall prevent two reservations of the same slot for overlapping time periods, including when requests arrive simultaneously. | H |
| FR-19 | The system shall calculate the parking cost on the server as hourly rate × billed hours, plus configured tax, and show base amount, tax and total. | H |
| FR-20 | The system shall create a pending reservation that holds the slot while the user pays. | H |
| FR-21 | The system shall release a pending reservation that is not paid within the configured hold time. | H |

### Payment

| ID | Requirement | Priority |
|---|---|---|
| FR-22 | The system shall create a payment order for a pending reservation using the amount stored on the server. | H |
| FR-23 | The system shall verify each payment on the server before confirming the reservation. | H |
| FR-24 | The system shall record each payment with reservation, amount, currency, status, gateway order ID, gateway payment ID and timestamps. | H |
| FR-25 | The system shall handle payment failure by leaving the reservation unconfirmed and allowing retry or cancellation. | H |

### Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-26 | The system shall create an in-app notification for booking confirmation, payment success, booking reminder and booking cancellation. | H |
| FR-27 | The system shall show unread notifications in the navigation bar with an unread count, updated in real time. | H |
| FR-28 | The system shall allow users to mark one or all notifications as read. | M |
| FR-29 | The system shall send e-mails for registration, booking confirmation, payment success, cancellation and reminder when e-mail is configured, and continue to work when it is not. | M |

### Booking management

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | The system shall list the user's bookings grouped as upcoming, active, completed and cancelled, with parking name, slot, date, times, amount, payment status, reservation status and booking ID. | H |
| FR-31 | The system shall show booking details with a QR-style booking reference and a printable receipt. | M |
| FR-32 | The system shall allow users to cancel a booking according to the cancellation policy and shall calculate the refund. | H |
| FR-33 | The system shall automatically mark reservations active at their start time and completed at their end time, and free the slot. | H |

### Administration

| ID | Requirement | Priority |
|---|---|---|
| FR-34 | The administrator shall log in through a separate admin interface. | H |
| FR-35 | The administrator shall view a dashboard with total parking areas, total, available, occupied, reserved and maintenance slots, today's reservations, today's revenue and total users. | H |
| FR-36 | The administrator shall add, edit and deactivate parking areas. | H |
| FR-37 | The administrator shall set parking rates per vehicle type and operating hours per day. | H |
| FR-38 | The administrator shall add, edit and delete parking slots. | H |
| FR-39 | The administrator shall mark slots as available, occupied or under maintenance. | H |
| FR-40 | The administrator shall monitor occupancy for each parking area (total, available, reserved, occupied, maintenance, occupancy percentage), updated in real time. | H |
| FR-41 | The administrator shall view, search and filter reservations by status and parking area. | H |
| FR-42 | The administrator shall view booking details and payment status and cancel a reservation when necessary. | M |
| FR-43 | The administrator shall view users with name, e-mail, phone, registration date, number of bookings and status. | H |
| FR-44 | The administrator shall activate and deactivate user accounts. | M |
| FR-45 | The system shall never display user passwords to anyone. | H |
| FR-46 | The administrator shall view all payments with status, amounts, refunds and gateway references. | H |
| FR-47 | The administrator shall send system notifications to users and view sent notifications. | M |
| FR-48 | The system shall ask for confirmation before destructive administrative actions. | M |

### Reports and real-time behaviour

| ID | Requirement | Priority |
|---|---|---|
| FR-49 | The administrator shall view revenue statistics over a selectable period, by day, parking area and vehicle type. | H |
| FR-50 | The administrator shall view occupancy and reservation statistics as charts. | H |
| FR-51 | The administrator shall export report data. | L |
| FR-52 | The system shall push slot availability changes to all connected clients without a page reload. | H |

## 10. Non-functional requirements

Detailed in sections 15 to 19. Summary:

| Category | Requirement IDs |
|---|---|
| Security | NFR-S1 to NFR-S8 |
| Performance | NFR-P1 to NFR-P4 |
| Availability and reliability | NFR-A1 to NFR-A4 |
| Usability | NFR-U1 to NFR-U6 |
| Scalability | NFR-SC1 to NFR-SC3 |
| Maintainability | NFR-M1 to NFR-M4 |

**Maintainability**

| ID | Requirement |
|---|---|
| NFR-M1 | The backend shall separate routes, controllers, services and data access. |
| NFR-M2 | The codebase shall use TypeScript in strict mode and pass linting with no errors. |
| NFR-M3 | All configuration shall come from environment variables, with a documented example file. |
| NFR-M4 | Core business rules shall be covered by automated tests. |

## 11. External interface requirements

### User interfaces

- Responsive web UI for desktop, laptop, tablet and mobile (minimum width 360 px).
- Customer app: top navigation bar with notification bell. Admin app: sidebar navigation.
- Slot status is shown by colour **and** icon/label: green = available, amber = reserved, red = occupied, grey hatched = maintenance.
- Every data view has loading, empty and error states. Destructive actions use confirmation dialogs.

### Software interfaces

| Interface | Direction | Protocol | Purpose |
|---|---|---|---|
| REST API | Frontend ↔ Backend | HTTPS, JSON | All application data (see `API.md`) |
| Socket.IO | Backend → Frontend | WebSocket | Live availability and notifications |
| PostgreSQL | Backend ↔ Database | TCP, SQL via Drizzle ORM | Persistence |
| Razorpay Orders / Checkout / Refunds | Backend and browser ↔ Razorpay | HTTPS | Test-mode payments |
| SMTP | Backend → mail server | SMTP/TLS via Nodemailer | E-mail notifications |
| OpenStreetMap tile server | Browser → OSM | HTTPS | Map tiles (Leaflet) |
| Browser Geolocation API | Browser | JavaScript API | User's position, with permission |

### Hardware interfaces

None in this version. A future sensor gateway would use the slot-status REST endpoint.

### Communication interfaces

HTTPS for all traffic in production; WebSocket (with HTTP long-polling fallback) for real-time events.

## 12. Hardware requirements

| | Minimum |
|---|---|
| **Client** | Any smartphone, tablet or computer with a modern browser and an internet connection |
| **Development machine** | Dual-core CPU, 4 GB RAM, 2 GB free disk |
| **Server (small deployment)** | 1 vCPU, 512 MB RAM application server; managed PostgreSQL with 1 GB storage |

## 13. Software requirements

| Component | Requirement |
|---|---|
| Client | Chrome, Edge, Firefox or Safari (current and previous major version); JavaScript enabled |
| Runtime | Node.js 20 or newer, npm 10 or newer |
| Database | PostgreSQL 14 or newer |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Leaflet, Recharts, Socket.IO client |
| Backend | Express, TypeScript, Drizzle ORM, jsonwebtoken, bcryptjs, Zod, Socket.IO, Nodemailer, Razorpay SDK, node-cron, Helmet |
| Testing | Vitest, Supertest, React Testing Library, Playwright |
| Operating system | Windows, macOS or Linux |

## 14. Database requirements

| ID | Requirement |
|---|---|
| DR-1 | Data shall be stored in a normalised relational database (PostgreSQL). |
| DR-2 | Entities: User, Vehicle, ParkingArea, ParkingSlot, ParkingRate, OperatingHour, Reservation, Payment, Notification. |
| DR-3 | Every table shall have a UUID primary key; relationships shall be enforced with foreign keys. |
| DR-4 | E-mail, booking reference, (area, slot number) and (area, vehicle type) shall be unique. |
| DR-5 | Monetary values shall be stored as exact decimals; times as timestamps with time zone. |
| DR-6 | Reservation and payment records shall never be deleted by normal operation. |
| DR-7 | Creating a reservation and confirming a payment shall each be atomic (database transactions). |
| DR-8 | Schema changes shall be applied through versioned migrations; seed data shall be provided. |

See `database-design.md` for the ER diagram and table definitions.

## 15. Security requirements

| ID | Requirement |
|---|---|
| NFR-S1 | Passwords shall be stored only as bcrypt hashes and never returned by the API. |
| NFR-S2 | Protected endpoints shall require a valid, unexpired JWT. |
| NFR-S3 | Administrative endpoints shall be accessible only to the ADMIN role; users shall access only their own bookings, payments and notifications. |
| NFR-S4 | All input shall be validated on the server; database access shall use parameterised queries. |
| NFR-S5 | Secrets shall be supplied through environment variables and never committed to version control. |
| NFR-S6 | Payment secrets shall never reach the browser; payment signatures shall be verified on the server. |
| NFR-S7 | The API shall set secure HTTP headers (Helmet), restrict cross-origin requests (CORS) and rate-limit requests in production. |
| NFR-S8 | Error responses shall not reveal stack traces or internal details. |

## 16. Performance requirements

| ID | Requirement |
|---|---|
| NFR-P1 | Under normal load, 95% of API requests shall complete within 1 second. |
| NFR-P2 | The parking search page shall be usable within 3 seconds on a 4G connection. |
| NFR-P3 | A slot status change shall appear on other connected clients within 2 seconds. |
| NFR-P4 | The system shall support at least 100 concurrent users on the small deployment in section 12. |

## 17. Availability requirements

| ID | Requirement |
|---|---|
| NFR-A1 | The system shall be available during parking operating hours, with a target of 99% monthly uptime. |
| NFR-A2 | Failure of the e-mail service or map tile server shall not prevent searching, booking or paying. |
| NFR-A3 | Confirmed reservations and payments shall not be lost on application restart. |
| NFR-A4 | A failed or abandoned payment shall never leave a slot blocked beyond the hold time. |

## 18. Usability requirements

| ID | Requirement |
|---|---|
| NFR-U1 | A first-time user shall be able to complete a booking without instructions. |
| NFR-U2 | A booking shall take no more than 6 steps from search to payment. |
| NFR-U3 | Error messages shall be in plain language and say what to do next. |
| NFR-U4 | The interface shall work on screens from 360 px wide, with navigation adapted for mobile. |
| NFR-U5 | Interactive elements shall be keyboard-operable and labelled for screen readers; status shall not be conveyed by colour alone. |
| NFR-U6 | Every screen that loads data shall show loading, empty and error states. |

## 19. Scalability requirements

| ID | Requirement |
|---|---|
| NFR-SC1 | Adding parking areas, slots and users shall require no code changes. |
| NFR-SC2 | The API shall be stateless (JWT), so more application instances can be added behind a load balancer. |
| NFR-SC3 | The architecture shall allow sensors and third-party systems to integrate through the existing API. |

## 20. Constraints

- Academic project: limited time and no budget, so only free and open-source components and free service tiers.
- No paid map API: OpenStreetMap with Leaflet is used.
- Payments must use test mode; no real money.
- No physical sensors are available; occupancy is simulated and labelled as such.
- Technology stack fixed by the course brief: React, Node.js/Express, PostgreSQL, TypeScript.
- A single time zone (configurable, default Asia/Kolkata) is used for operating hours and daily statistics.

## 21. Assumptions

- Users have an internet-connected device with a modern browser.
- Users arrive and leave within their booked time; overstays are not detected in this version.
- Each slot holds one vehicle of one type; an EV may use a car slot.
- Parking areas that are not open 24 hours accept bookings only within one day's opening hours.
- Administrators enter correct locations, rates and hours.
- One currency (INR) and one tax rate apply to all parking areas.

## 22. Dependencies

| Dependency | Needed for | If unavailable |
|---|---|---|
| PostgreSQL | All data | System cannot run |
| Razorpay test account | Real gateway flow | Built-in simulated gateway is used |
| SMTP server | E-mail notifications | E-mails are logged; in-app notifications still work |
| OpenStreetMap tile servers | Map background | Markers still show; list view unaffected |
| Browser geolocation | Distance and "nearest" sorting | Falls back to the city centre |
| npm registry | Installing libraries | Needed at install time only |

## 23. Acceptance criteria

The system is accepted when all of the following are demonstrated.

| # | Criterion | Requirements |
|---|---|---|
| AC-1 | A new user can register, log in and log out; a duplicate e-mail and a wrong password are rejected with clear messages. | FR-01 to FR-04 |
| AC-2 | A user can search parking by location, filter by vehicle type, price and availability, and see results in a list and on a map. | FR-08 to FR-13 |
| AC-3 | A user can open a parking area and see each slot's status for a chosen time. | FR-14, FR-15 |
| AC-4 | A user can select a slot and time, see the price calculated by the system, and confirm the reservation. | FR-16 to FR-20 |
| AC-5 | Two users cannot book the same slot for overlapping times; the second is told the slot is taken. | FR-18 |
| AC-6 | A successful test payment confirms the reservation; a failed payment does not, and can be retried. | FR-22 to FR-25 |
| AC-7 | After payment the user receives confirmation and payment notifications, and the unread count updates. | FR-26 to FR-28 |
| AC-8 | The user can see the booking under "My bookings", view its receipt and cancel it with the correct refund. | FR-30 to FR-32 |
| AC-9 | An administrator can log in and see a dashboard with correct live figures. | FR-34, FR-35 |
| AC-10 | An administrator can add, edit and deactivate a parking area and add, edit and change the status of slots. | FR-36 to FR-39 |
| AC-11 | When an administrator changes a slot's status, occupancy figures and customer availability update without reloading. | FR-40, FR-52 |
| AC-12 | An administrator can view and filter reservations, users and payments, and view reports. | FR-41 to FR-51 |
| AC-13 | A customer cannot open admin pages or call admin APIs. | FR-07, NFR-S3 |
| AC-14 | All automated tests pass. | NFR-M4 |
