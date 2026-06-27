# StornoMatch

**B2B White Label Zweitmarkt für Pauschalreisen**

> Ermöglicht Reiseveranstaltern, ihren Kunden einen automatisierten Weiterverkauf von stornierten Buchungen anzubieten — ohne manuelle Bearbeitung.

---

## Das Problem

- **Kunden:** Buchungen sind illiquide. Stornogebühren liegen bei **50–80%**. Reiserücktrittsversicherungen decken nur Härtefälle ab.
- **Veranstalter:** Manuelle Stornierung + Support + keine Einnahmen aus informellem Weiterverkauf.
- **Marktlücke:** Kein White-Label-SaaS für genau dieses Problem.

## Die Lösung

Ein Widget, das Veranstalter auf ihrer Website einbinden:

1. **Kunde A** klickt "Reise anbieten" → Formular ausfüllen → Request geht zur Freigabe
2. **Admin** des Reiseveranstalters füllt Flugdaten ein → Listing freigeben
3. **Kunde B** findet Listing → Stripe Checkout → Zahlung in Treuhand
4. **Admin** bestätigt Umpersonalisierung → Payout an Kunde A

---

## Quick Start

### Voraussetzungen

- Node.js 18+
- npm

### Backend starten

```bash
cd server
cp .env.example .env   # Edit .env with your credentials
npm install
npx prisma generate
npx prisma db push
npm run db:seed        # Testdaten einsäen
npm run dev
```

**Test-Login:** `admin@mallorca-tours.de` / `admin123`

### Widgets öffnen

| URL | Beschreibung |
|-----|--------------|
| `http://localhost:3000/widget/` | Widget-Übersicht |
| `http://localhost:3000/widget/seller.html` | Seller Widget (Formular) |
| `http://localhost:3000/dashboard/` | Admin Dashboard |

### Buyer Widget einbetten

```html
<script src="https://deine-domain.com/widget/widget.js"></script>
<div id="storno-match-widget"></div>
<script>
  window.STORNOMATCH_ORG = 'mallorca';
  window.STORNOMATCH_API = 'https://deine-domain.com';
</script>
```

---

## Aktueller Stand

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API | ✅ Fertig | Express + Prisma |
| Buyer Widget | ✅ Fertig | Vanilla JS, iframe-ready |
| Seller Widget | ✅ Fertig | Standalone HTML |
| Admin Dashboard | ✅ Fertig | Vanilla JS/HTML |
| Database | ✅ Fertig | SQLite (dev), PostgreSQL (prod) |
| Stripe Connect | ⚠️ Demo Mode | DEMO_MODE=true, kein echter Transfer |
| Email | ⚠️ Mock | Logs to console |
| Maps | ✅ Fertig | OpenStreetMap/Nominatim, kein API Key |
| Seed Script | ✅ Fertig | `npm run db:seed` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + Prisma |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend (Dashboard) | Vanilla JS + HTML |
| Frontend (Widget) | Vanilla JS (kein Framework) |
| Payments | Stripe Connect (Demo Mode) |
| Maps | OpenStreetMap / Nominatim |
| Hosting | Railway (Backend) + Vercel (Frontend) |

---

## Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                    STORNOMATCH PLATFORM                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Buyer Widget │  │ Seller Widget│  │  Admin Dashboard  │  │
│  │ Vanilla JS   │  │ Standalone   │  │  Vanilla JS/HTML  │  │
│  │ iframe-ready │  │ HTML+JS      │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                    │              │
│         │   API Key       │    JWT Auth        │              │
│         └──────────────────┼────────────────────┘              │
│                            │                                   │
│                   ┌────────▼────────┐                          │
│                   │  Express API    │                          │
│                   │  Port 3000      │                          │
│                   └────────┬────────┘                          │
│                            │                                   │
│         ┌──────────────────┼──────────────────┐               │
│         │                  │                  │               │
│  ┌──────▼──────┐  ┌───────▼─────┐  ┌───────▼──────┐       │
│  │  SQLite /    │  │   Stripe    │  │  Nominatim   │       │
│  │  PostgreSQL  │  │  Connect    │  │  (Maps)      │       │
│  └──────────────┘  └─────────────┘  └──────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Dateistruktur

```
storno-match/
├── README.md
├── ONEPAGER.md
├── DOKUMENTATION.md
│
├── server/
│   ├── package.json
│   ├── .env
│   ├── prisma/
│   │   ├── schema.prisma       # Datenmodell (SQLite)
│   │   ├── seed.js            # Testdaten
│   │   └── dev.db             # Lokale SQLite DB (gitignored)
│   └── src/
│       ├── index.js            # Express App
│       ├── middleware/
│       │   └── auth.js         # JWT + API Key Auth
│       ├── routes/
│       │   ├── auth.js         # Register, Login, Refresh
│       │   ├── listings.js     # Listing CRUD + approve/reject
│       │   ├── transfers.js    # Kauf + Bestätigen + Ablehnen
│       │   ├── organizations.js # Org-Einstellungen + Stripe
│       │   └── webhooks.js     # Stripe Webhook Handler
│       └── services/
│           ├── stripe.js       # Stripe Connect Wrapper
│           └── maps.js         # OpenStreetMap / Nominatim
│
├── widget/
│   ├── index.html             # Widget-Übersicht
│   ├── buyer-embed.html       # Iframe-Content für Buyer Widget
│   ├── widget.js               # Buyer Widget JS
│   ├── seller.html             # Seller Widget (Standalone)
│   └── seller.js               # Seller Widget JS
│
└── dashboard/
    ├── index.html             # Dashboard HTML
    └── dashboard.js           # Dashboard JS
```

---

## Lizenz

Proprietary — Alle Rechte vorbehalten (Enflixed GmbH)

---

## Kontakt

- **GitHub:** github.com/Enflixed/storno-match

