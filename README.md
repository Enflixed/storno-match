# StornoMatch

**B2B White Label Zweitmarkt für Reiseveranstalter**

> Ermöglicht Reiseveranstaltern, ihren Kunden einen automatisierten Weiterverkauf von stornierten Buchungen anzubieten — ohne manuelle Bearbeitung.

---

## Das Problem

- Kunden: Buchungen sind illiquide. Stornogebühren liegen bei **50-80%**. Reiserücktrittsversicherungen decken nur Härtefälle ab.
- Veranstalter: Manuelle Stornierung + Support + keine Einnahmen aus informellem Weiterverkauf.
- Marktlücke: Kein White-Label-SaaS für genau dieses Problem.

## Die Lösung

Ein Widget, das Veranstalter auf ihrer Website einbinden:

1. **Kunde A** klickt "Reise anbieten" → Widget erstellt anonymisiertes Listing
2. **Kunde B** findet Listing → Stripe Checkout → Zahlung in Treuhand
3. **Veranstalter** wird benachrichtigt → Umpersonalisierung → Payout
   
---

## Quick Start

### Voraussetzungen

- Node.js 18+
- PostgreSQL 14+
- Stripe Account

### Backend starten

```bash
cd server
cp .env.example .env
# Edit .env with your credentials
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend (Dashboard) starten

```bash
cd dashboard
npm install
npm run dev
```

### Widget einbetten

```html
<script src="https://deine-domain.com/widget.js"></script>
<div id="storno-match-widget" data-org="mein-reiseveranstalter"></div>
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + Prisma |
| Database | PostgreSQL |
| Frontend | React + Vite |
| Payments | Stripe Connect |
| Email | Resend |
| Hosting | Railway (Backend) + Vercel (Frontend) |

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    STORNOMATCH PLATFORM                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   Widget     │     │   Dashboard  │     │    API      │  │
│  │  (VanillaJS) │     │    (React)   │     │  (REST)     │  │
│  └──────────────┘     └──────────────┘     └─────────────┘  │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                    ┌─────────▼─────────┐                    │
│                    │     Express API    │                   │
│                    │  (Authentication)  │                   │
│                    └─────────┬─────────┘                    │
│                              │                              │
│          ┌───────────────────┼───────────────────┐          │
│          │                   │                   │          │
│  ┌───────▼───────┐   ┌───────▼───────┐   ┌──────▼──────┐    │
│  │  PostgreSQL    │   │    Stripe     │   │   Resend    │   │
│  │   (Prisma)     │   │   Connect     │   │   (Email)   │   │
│  └───────────────┘   └───────────────┘   └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new organization |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |

### Listings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/listings` | List active listings |
| GET | `/api/listings/:id` | Get listing details |
| POST | `/api/listings` | Create listing (API key) |
| PUT | `/api/listings/:id` | Update listing |
| DELETE | `/api/listings/:id` | Cancel listing |

### Transfers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transfers` | List transfers |
| GET | `/api/transfers/:id` | Get transfer details |
| POST | `/api/transfers` | Initiate purchase |
| POST | `/api/transfers/:id/complete` | Confirm reassignment |
| POST | `/api/transfers/:id/reject` | Reject transfer |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

---

## Lizenz

Proprietary — Alle Rechte vorbehalten (Enflixed GmbH)

---

## Kontakt

- Website: [storno-match.com](https://storno-match.com)
- GitHub: [github.com/Enflixed/storno-match](https://github.com/Enflixed/storno-match)
