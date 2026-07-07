# Drova — Last-Mile Delivery Platform

Drova is a last-mile logistics platform built on top of the **Nomba** payment infrastructure. It connects **businesses** (senders), **riders** (couriers), and **customers** (recipients) into a single end-to-end delivery workflow — from order creation and payment to real-time tracking and payout.

Built for the **Nomba Hackathon 2026**.

---

## What Drova Does

- Businesses create delivery orders with quoted pricing or fixed-fee direct dispatch
- Customers pay securely via Nomba-powered checkout links — funds are held in escrow until delivery is confirmed
- Available riders receive order offers and are assigned to deliveries
- A 6-digit delivery PIN confirms receipt at handoff
- Businesses and riders withdraw earnings directly to their bank accounts via Nomba transfer

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS v11 (TypeScript) |
| Database | PostgreSQL via Neon (TypeORM, `synchronize: true` in dev) |
| Queues | BullMQ (Redis-backed) |
| Payments | Nomba API (checkout, webhooks, bank transfers) |
| WhatsApp | Neuron.ng Bot API |
| Email | Nodemailer + BullMQ queue |
| Auth | JWT (access + refresh tokens) |

---

## Key Features

### Orders
- **Quoted flow** — business creates a quotation, platform sends invoice, customer pays via Nomba link
- **Direct/manual flow** — business dispatches immediately with cash, bank transfer, or online payment
- Full status lifecycle: `pending → invoiced → payment_confirmed → offer_pending → assigned → en_route_pickup → picked_up → in_transit → arrived_at_delivery → completed`
- Sender/recipient cross-field validation (different phone, email, address, and coordinates required)
- Order tracking link: `https://drova-hackathon-mcun.vercel.app/track/<referenceCode>`

### Payments & Wallets
- Nomba escrow hold on payment → released to business wallet on delivery completion
- Double-entry ledger: every naira is tracked with balanced journal entries across `BUSINESS`, `RIDER`, `PLATFORM`, and `CLEARING` wallets
- Transfer fee (₦20) recorded as a `TRANSFER_FEE` journal — debits user wallet, credits clearing
- Business and rider withdrawals via Nomba bank transfer API

### Notifications
- **WhatsApp** (via Neuron.ng): OTP login for riders, delivery PIN, all order status transitions to sender and recipient
- **Email**: payment confirmation, invoice, order status updates — all with tracking/dashboard links

### Rider Management
- WhatsApp OTP-based login (no password)
- Real-time location and availability tracking
- Gamification: 6 tier levels (Bronze → Platinum) and 40+ badges across delivery milestones, speed, ratings, streaks, and earnings

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Redis (for BullMQ queues)
- PostgreSQL (or a Neon connection string)

### Installation

```bash
npm install
```


### Run the Application

```bash
# development (watch mode)
npm run start:dev

# production
npm run start:prod

# background workers (email + payout queues)
npm run start:worker
```

### Seed System Wallets

On first run, seed the platform and clearing wallets:

```bash
npm run seed:system-wallets
```

---

## API Documentation

Swagger UI is available at:

```
http://localhost:3000/api/v1/docs
```

> Requires `ENABLE_SWAGGER=true` in your environment.

All authenticated endpoints require a `Bearer <token>` header. Obtain a token via:

- `POST /api/v1/auth/login` — business/staff login
- `POST /api/v1/auth/login` with `userType: rider` — rider login (initiates WhatsApp OTP)
- `POST /api/v1/auth/validate-rider-otp` — complete rider login with OTP

---

## Test Credentials

### Business Account

| Field | Value |
|-------|-------|
| Email | `abdulafeezadeyemo92@gmail.com` |
| Password | `StrongPassword123!` |
| User Type | `business` |

**Login:**
```bash
POST /api/v1/auth/login
{
  "email": "abdulafeezadeyemo92@gmail.com",
  "password": "StrongPassword123!",
  "userType": "business"
}
```

---

### Rider Account

Rider login uses a two-step WhatsApp OTP flow.

| Field | Value |
|-------|-------|
| Phone Number | `+2348146604258` |
| Test OTP | `123456` |

**Step 1 — Initiate login (sends OTP via WhatsApp):**
```bash
POST /api/v1/auth/login
{
  "telephoneNumber": "+2348146604258",
  "userType": "rider"
}
```

**Step 2 — Validate OTP:**
```bash
POST /api/v1/auth/validate-rider-otp
{
  "tempToken": "<token from step 1>",
  "otp": "123456",
  "deviceId": "any-unique-device-id"
}
```

> The `123456` bypass applies only to `+2348146604258`. All other numbers must use the real OTP delivered via WhatsApp.

---

## Project Structure

```
src/
├── api/
│   ├── authentication/   # JWT auth, OTP, rider login
│   ├── business/         # Business profiles, settings
│   ├── order/            # Order lifecycle, pricing, payments
│   ├── rider/            # Rider profiles, location, availability
│   ├── transactions/     # Wallets, journals, payouts, withdrawals
│   ├── account/          # Nomba virtual account management
│   ├── analytics/        # Dashboard analytics
│   ├── webhooks/         # Nomba webhook handler
│   └── reviews/          # Business and rider reviews
├── services/
│   ├── nomba.service.ts  # Nomba API client
│   ├── neuron.service.ts # WhatsApp (Neuron.ng) client
│   └── email.service.ts  # Email delivery
├── constants/            # Enums and shared constants
├── helpers/              # Utilities (phone normalization, etc.)
└── scripts/              # One-off scripts (wallet seeding)
```

---

## Order Flow Overview

```
Customer                 Business                  Platform                Rider
   |                        |                          |                     |
   |── Place Order ────────>|                          |                     |
   |                        |── Create Quotation ─────>|                     |
   |<─────────── Invoice ───|<─────────────────────────|                     |
   |── Pay via Nomba ──────────────────────────────────>|                     |
   |                        |<── Payment Confirmed ────|                     |
   |                        |                          |── Offer to Riders ──>|
   |                        |                          |<── Rider Accepts ───|
   |<── Delivery PIN ───────|                          |                     |
   |                        |                          |    [Rider delivers]  |
   |── Confirm PIN ─────────────────────────────────────────────────────────>|
   |                        |<── Funds Released ───────|                     |
   |                        |                          |── Rider Payout ─────>|
```

---

## License

Private — Nomba Hackathon 2026 submission.
