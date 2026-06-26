# StornoMatch — Vollständige Technische & Konzeptionelle Dokumentation

**Version:** 1.0  
**Datum:** 25.06.2026  
**Status:** Konzeption + Backend in Arbeit  
**Letzter Stand Backend:** ~80% fertig

---

## 1. Das Projekt

**Name:** StornoMatch  
**Typ:** B2B White-Label SaaS (Software-as-a-Service)  
**Website:** storno-match.com  
**GitHub:** github.com/Enflixed/storno-match  

### Das Problem

Pauschalreisen sind illiquide — wenn Kunden stornieren, verlieren sie **50-80% des Reisepreises** als Stornogebühr. Die Reise selbst hat aber noch vollen Wert. Es gibt keinen automatisierten Markt, sie weiterzuverkaufen.

**Ergebnis:**
- Kunden zahlen drauf — 50-80% Stornogebühr
- Reise bleibt leer — kein Revenue für Veranstalter
- Niemand profitiert

### Die Lösung

Ein **White-Label-Widget**, das Reiseveranstalter auf ihrer Website einbetten. Kunden können ihre stornierten Reisen anonymisiert anbieten; andere Kunden können sie kaufen — alles automatisiert über Stripe Connect.

**Keine Blockchain. Keine Token. Keine regulatorischen Hürden.**

### Warum jetzt?

- ✅ **Stripe Connect** macht Payment + Escrow + Payout trivial
- ✅ **Kein vergleichbares Produkt** am Markt
- ✅ Reiseveranstalter suchen aktiv nach **Revenue-Retention** Tools
- ✅ White-Label = keine Brandingskills nötig, nur Integration

---

## 2. Geschäftsmodell

### Revenue Streams

| Einnahme | Betrag | Beschreibung |
|----------|--------|--------------|
| **SaaS (monatlich)** | €149–299/Monat | Nach Plan (Starter/Professional/Enterprise) |
| **Setup-Fee (einmalig)** | €499 | Onboarding & Konfiguration |
| **Transaktions-Gebühr** | €39/Trade | Pro erfolgreichem Weiterverkauf |
| **Creator Royalty (optional)** | 5% | Anteil am Wiederverkaufspreis |

### Preispläne

| Plan | Monatlich | Trades/Monat | Features |
|------|-----------|--------------|---------|
| **Starter** | €149 | 20 | Basic Widget |
| **Professional** | €199 | 50 | Advanced Analytics |
| **Enterprise** | €299 | Unlimited | Custom Branding |

### Beispiel Jahr 1

> 5 Kunden × €149 + 20 Trades × €39 = **~€19.000 Umsatz**  
> **Fixkosten:** ~€11–15/Monat (Server, DB, Stripe-Gebühren)

---

## 3. Produktübersicht

### 3.1 Widget (Vanilla JS — für Reiseveranstalter)

Einbettbarer JavaScript-Code auf der Website des Reiseveranstalters:

```html
<script src="https://storno-match.com/widget.js"></script>
<div id="storno-match-widget" data-org="mein-reiseveranstalter"></div>
```

**Funktionen:**
- "Reise anbieten"-Formular für Kunden
- Listing-Anzeige mit Suchfunktion
- Stripe Checkout Integration
- Benachrichtigungs-Overlay

**Status:** ⚠️ Noch nicht implementiert

### 3.2 Dashboard (React — für Reiseveranstalter)

Admins Interface zum Verwalten von:
- Listings (alle Angebote)
- Transfers (Transaktionen)
- Statistiken (Umsatz, Trades)
- Organisationseinstellungen (Stripe-Onboarding, Preisspannen)

**Status:** ⚠️ React + Vite Scaffold vorhanden, UI nicht implementiert

### 3.3 API (Express.js — Backend)

RESTful API für alle Operationen:
- Widget ↔ API Kommunikation (API-Key Auth)
- Dashboard ↔ API Kommunikation (JWT Auth)

**Status:** ✅ ~80% fertig

---

## 4. Technischer Stack

| Layer | Technology | Verwendung |
|-------|------------|------------|
| **Backend** | Node.js + Express | API Server |
| **ORM** | Prisma | Datenbank-Abstraktion |
| **Datenbank** | PostgreSQL (Railway) | Persistenz |
| **Frontend (Dashboard)** | React + Vite | Admin Interface |
| **Frontend (Widget)** | Vanilla JS | Einbettbarer Code |
| **Payments** | Stripe Connect | Zahlungen + Payouts + Escrow |
| **Email** | Resend | Transaktionale Emails |
| **Auth (API)** | API Keys (SHA-256) | Widget-Auth |
| **Auth (Dashboard)** | JWT (Access + Refresh) | Dashboard-Login |
| **Hosting** | Railway (Backend) + Vercel (Frontend) | Deployment |

---

## 5. Flow: Wie ein Weiterverkauf funktioniert

### Flow 1: Kunde A verkauft seine Reise

```
1. Kunde A geht auf Reiseveranstalter-Website
2. Klickt "Reise anbieten" im Widget
3. Füllt Formular aus:
   - Buchungsreferenz
   - Reiseziel + Datum
   - Originalpreis
   - Wunschpreis (50-100% erlaubt)
   - Name + Email
4. Widget sendet POST /api/listings (API Key Auth)
5. Listing wird erstellt:
   - Status: ACTIVE
   - sellerNameAnonymous: "Thomas M."
   - expiresAt: +7 Tage
6. Kunde A bekommt Bestätigung
```

### Flow 2: Kunde B kauft die Reise

```
1. Kunde B sieht Listing im Widget
2. Klickt "Jetzt kaufen"
3. Stripe Checkout öffnet sich
4. Kunde B bezahlt (Betrag geht in Stripe Escrow)
5. Stripe Webhook: payment_intent.succeeded
6. POST /api/transfers/:id/confirm-payment wird aufgerufen
7. Transfer.status = PAID
8. Listing.status = SOLD
9. Reiseveranstalter bekommt Email-Benachrichtigung
```

### Flow 3: Reiseveranstalter personalisiert um

```
1. Reiseveranstalter loggt sich ins Dashboard ein
2. Sieht neuen Transfer unter "Transfers"
3. Klickt "Bestätigen" oder "Ablehnen"
4. Bei Bestätigen:
   - POST /api/transfers/:id/complete
   - Stripe Transfer an Verkäufer (sellerPayoutCents)
   - Transfer.status = COMPLETED
5. Bei Ablehnen:
   - POST /api/transfers/:id/reject
   - Automatische Rückerstattung an Käufer
   - Listing wird wieder ACTIVE
```

---

## 6. Time-Lock Regeln

| Regel | Wert | Konfigurierbar |
|-------|------|----------------|
| **Kein Transfer** | <72h vor Abflug | ✅ Ja (timeLockHours) |
| **Mindestpreis** | 50% des Originalpreises | ✅ Ja (minPricePercent) |
| **Höchstpreis** | 100% (kein Aufschlag) | ✅ Ja (maxPricePercent) |

---

## 7. Datenmodell (Prisma Schema)

### 7.1 Organization (Reiseveranstalter)

```prisma
model Organization {
  id                String   @id @default(uuid())
  name              String           // "Condor Holidays"
  subdomain         String   @unique // "condor-holidays"
  logoUrl           String?
  
  // Stripe Connect
  stripeAccountId   String?  // Connected Stripe Account
  stripeOnboarded   Boolean  @default(false)
  
  contactEmail      String
  contactName       String
  phone             String?
  website           String?
  
  // Plan & Billing
  plan              PlanType @default(STARTER)
  subscriptionEnds  DateTime?
  
  // Regeln (vom Veranstalter konfigurierbar)
  minPricePercent   Int      @default(50)   // Min 50% des Originalpreises
  maxPricePercent   Int      @default(100)  // Max 100%
  timeLockHours     Int      @default(72)   // Kein Transfer <72h vor Abflug
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  users             User[]
  listings          Listing[]
  transfers         Transfer[]
}

enum PlanType {
  STARTER      // €149/mo
  PROFESSIONAL // €199/mo
  ENTERPRISE   // €299/mo
}
```

### 7.2 User (Mitarbeiter des Veranstalters)

```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String
  name           String
  role           UserRole @default(STAFF)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  emailVerified  Boolean  @default(false)
  lastLogin      DateTime?
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

enum UserRole {
  OWNER      // Voller Zugriff
  ADMIN      // Verwaltung + Einstellungen
  STAFF      // Listings & Transfers
  SUPPORT    // Read-only + Support
}
```

### 7.3 Customer (Kunde des Reiseveranstalters)

```prisma
model Customer {
  id             String @id @default(uuid())
  email          String
  name           String
  phone          String?
  organizationId String
  emailHash      String @unique  // SHA-256 für Anonymisierung
  phoneHash      String? @unique
  createdAt      DateTime @default(now())
}
```

### 7.4 Listing (Angebotene Reise)

```prisma
model Listing {
  id               String   @id @default(uuid())
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  // Original Booking (anonymisiert)
  originalBookingRef String  // Interne Ref, nie öffentlich
  destination        String  // "Mallorca, Spanien"
  departureDate      DateTime
  returnDate         DateTime
  originalPriceCents Int     // z.B. 59900 = €599.00
  
  // Verkäufer-Preis
  askingPriceCents   Int
  currency           String @default("EUR")
  
  description        String?
  
  status             ListingStatus @default(ACTIVE)
  
  // Anonymisierung
  sellerNameAnonymous String    // "Thomas M."
  sellerEmailHash    String     // SHA-256 Hash
  
  stripePaymentIntentId String?
  
  expiresAt          DateTime?  // Default: 7 Tage
  
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  transfers          Transfer[]
}

enum ListingStatus {
  ACTIVE       // Sichtbar und kaufbar
  PENDING      // Zahlung läuft
  SOLD         // Verkauft
  EXPIRED      // Abgelaufen
  CANCELLED    // Verkäufer hat abgebrochen
}
```

### 7.5 Transfer (Abgeschlossene Transaktion)

```prisma
model Transfer {
  id               String   @id @default(uuid())
  listingId        String
  listing          Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  // Verkäufer
  sellerId         String
  sellerCustomerId String
  sellerEmailHash  String
  
  // Käufer
  buyerId          String
  buyerCustomerId  String
  buyerEmailHash   String
  
  // Zahlung
  amountCents      Int
  currency         String @default("EUR")
  
  // Gebühren
  platformFeeCents Int       // €39 = 3900 cents
  creatorRoyaltyCents Int?   // 5% Anteil
  sellerPayoutCents Int      // Was Verkäufer bekommt
  
  // Stripe IDs
  stripePaymentIntentId String?
  stripeTransferId      String?
  stripeChargeId        String?
  
  status              TransferStatus @default(PENDING)
  reassignmentStatus   ReassignmentStatus @default(PENDING)
  reassignmentNotes    String?
  
  paidAt           DateTime?
  completedAt       DateTime?
  refundedAt        DateTime?
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

enum TransferStatus {
  PENDING      // Zahlung ausstehend
  PAID         // Bezahlt, in Treuhand
  COMPLETED    // Abgeschlossen
  REFUNDED     // Rückerstattet
  DISPUTED     // Streitfall
  CANCELLED    // Abgebrochen
}

enum ReassignmentStatus {
  PENDING           // Wartet auf Reiseveranstalter
  IN_PROGRESS       // In Bearbeitung
  COMPLETED         // Erfolgreich umgebucht
  REJECTED          // Abgelehnt
  FAILED            // Technischer Fehler
}
```

### 7.6 ApiKey (Widget Authentifizierung)

```prisma
model ApiKey {
  id              String @id @default(uuid())
  organizationId  String
  keyHash         String @unique  // SHA-256 Hash
  keyPrefix       String          // Erste 8 Zeichen zur Identifikation
  name            String          // "Production", "Test"
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  active          Boolean @default(true)
  createdAt       DateTime @default(now())
}
```

### 7.7 WebhookEvent (Audit Trail)

```prisma
model WebhookEvent {
  id              String @id @default(uuid())
  stripeEventId   String @unique
  type            String
  processed       Boolean @default(false)
  processedAt     DateTime?
  payload         Json
  error           String?
  createdAt       DateTime @default(now())
}
```

---

## 8. API Endpoints

### 8.1 Authentication

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| POST | `/api/auth/register` | — | Organisation + Owner registrieren |
| POST | `/api/auth/login` | — | Login (JWT zurück) |
| POST | `/api/auth/refresh` | Refresh Token | Token erneuern |
| POST | `/api/auth/logout` | JWT | Logout |
| GET | `/api/auth/me` | JWT | Aktueller User |

**POST /api/auth/register Request:**
```json
{
  "name": "Max Mustermann",
  "email": "max@reiseveranstalter.de",
  "password": "sicherespasswort",
  "organizationName": "Condor Holidays",
  "subdomain": "condor-holidays"
}
```

**POST /api/auth/register Response:**
```json
{
  "organization": {
    "id": "uuid",
    "name": "Condor Holidays",
    "subdomain": "condor-holidays",
    "plan": "STARTER"
  },
  "user": {
    "id": "uuid",
    "name": "Max Mustermann",
    "email": "max@reiseveranstalter.de",
    "role": "OWNER"
  },
  "apiKey": "**************", 
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### 8.2 Listings

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| GET | `/api/listings` | — | Aktive Listings (öffentlich) |
| GET | `/api/listings/:id` | — | Listing Details |
| POST | `/api/listings` | **API Key** | Listing erstellen (Widget) |
| PUT | `/api/listings/:id` | JWT | Listing aktualisieren |
| DELETE | `/api/listings/:id` | JWT | Listing stornieren |
| GET | `/api/listings/seller/my` | JWT | Meine Listings als Verkäufer |

**POST /api/listings Request:**
```json
{
  "originalBookingRef": "BK-2024-12345",
  "destination": "Mallorca, Spanien",
  "departureDate": "2024-07-15T00:00:00Z",
  "returnDate": "2024-07-22T00:00:00Z",
  "originalPriceCents": 59900,
  "askingPriceCents": 45000,
  "description": "Familienzimmer, Halbpension",
  "sellerName": "Thomas Müller",
  "sellerEmail": "thomas@example.com",
  "sellerPhone": "+49 170 1234567"
}
```

**GET /api/listings Response (Public):**
```json
{
  "listings": [
    {
      "id": "uuid",
      "destination": "Mallorca, Spanien",
      "departureDate": "2024-07-15T00:00:00Z",
      "returnDate": "2024-07-22T00:00:00Z",
      "originalPriceCents": 59900,
      "originalPriceEur": "599.00",
      "askingPriceCents": 45000,
      "askingPriceEur": "450.00",
      "sellerNameAnonymous": "Thomas M.",
      "status": "ACTIVE",
      "organization": {
        "name": "Condor Holidays",
        "subdomain": "condor-holidays",
        "logoUrl": "https://..."
      }
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### 8.3 Transfers

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| GET | `/api/transfers` | JWT | Alle Transfers (Org) |
| GET | `/api/transfers/:id` | JWT | Transfer Details |
| POST | `/api/transfers` | **API Key** | Kauf initiieren (Widget) |
| POST | `/api/transfers/:id/confirm-payment` | — | Zahlung bestätigen (Stripe Webhook) |
| POST | `/api/transfers/:id/complete` | JWT | Umpersonalisierung abschließen |
| POST | `/api/transfers/:id/reject` | JWT | Transfer ablehnen |

**POST /api/transfers Request:**
```json
{
  "listingId": "uuid",
  "buyerName": "Sabine Schmidt",
  "buyerEmail": "sabine@example.com",
  "buyerPhone": "+49 160 9876543"
}
```

**POST /api/transfers Response:**
```json
{
  "transfer": {
    "id": "uuid",
    "amountCents": 45000,
    "amountEur": "450.00",
    "platformFeeCents": 3900,
    "sellerPayoutCents": 41100
  },
  "clientSecret": "pi_xxx_secret_xxx"
}
```

### 8.4 Organizations

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| GET | `/api/organizations/:subdomain` | — | Org Info (öffentlich) |
| GET | `/api/organizations` | JWT | Meine Organisation |
| PUT | `/api/organizations` | JWT (Owner/Admin) | Einstellungen ändern |
| POST | `/api/organizations/stripe/connect` | JWT (Owner) | Stripe Onboarding starten |
| GET | `/api/organizations/stripe/status` | JWT (Owner) | Stripe Status |
| GET | `/api/organizations/stats` | JWT | Statistiken |

### 8.5 Webhooks

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| POST | `/api/webhooks/stripe` | Stripe Signature | Stripe Events |

### 8.6 Admin

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|---------------|
| GET | `/api/admin/stats` | JWT (Owner) | Plattform-weite Statistiken |
| GET | `/api/admin/organizations` | JWT (Owner) | Alle Organisationen |
| GET | `/api/admin/transfers` | JWT (Owner/Admin) | Alle Transfers |

---

## 9. Security & Datenschutz

### 9.1 Anonymisierung

- **Käufer sieht:** Nur `sellerNameAnonymous` (z.B. "Thomas M.")
- **Email/Phone:** NIEMALS in Listings — nur SHA-256 Hashes
- **Buchungsreferenz:** Nur intern, nie öffentlich

### 9.2 Authentifizierung

| Context | Method | Details |
|---------|--------|---------|
| Widget → API | API Key | `X-API-Key: ***` Header, SHA-256 Hash in DB |
| Dashboard | JWT Access Token | 15min, Bearer Token |
| Dashboard | JWT Refresh Token | 7 Tage, in HttpOnly Cookie |
| Stripe Webhooks | Stripe Signature | `stripe-signature` Header, Webhook Secret |

### 9.3 Rate Limiting

- **General:** 100 Requests / 15 Min pro IP
- **Auth Routes:** 5 Requests / 15 Min

---

## 10. Gebührenberechnung

**Beispiel: Reise mit €450 Wiederverkaufspreis:**

| Position | Betrag |
|----------|--------|
| Käufer zahlt | €450,00 |
| Platform Fee | -€39,00 (fix) |
| Creator Royalty (5%) | -€22,50 (optional) |
| **Verkäufer erhält** | **€388,50** |

**Bei 20 Trades/Monat:**
> 20 × €39 = €780 Plattform-Einnahmen/Monat

---

## 11. Implementierungsstand

### Backend ✅ (~80%)

| File | Status | Beschreibung |
|------|--------|--------------|
| `server/src/index.js` | ✅ Fertig | Express App, Middleware, Routes |
| `server/src/middleware/auth.js` | ✅ Fertig | JWT + API Key Auth |
| `server/src/middleware/errorHandler.js` | ✅ Fertig | Global Error Handler |
| `server/src/routes/auth.js` | ✅ Fertig | Register, Login, Refresh |
| `server/src/routes/listings.js` | ✅ Fertig | CRUD + Suche |
| `server/src/routes/transfers.js` | ✅ Fertig | Kauf, Bestätigen, Ablehnen |
| `server/src/routes/organizations.js` | ✅ Fertig | Org-Verwaltung + Stripe Connect |
| `server/src/routes/webhooks.js` | ✅ Fertig | Stripe Webhook Handler |
| `server/src/routes/admin.js` | ✅ Fertig | Plattform-Statistiken |
| `server/src/services/stripe.js` | ✅ Fertig | Stripe Connect Wrapper |
| `server/src/services/email.js` | ✅ Fertig | Email Templates (Mock) |
| `server/prisma/schema.prisma` | ✅ Fertig | Komplettes Datenmodell |
| `server/package.json` | ✅ Fertig | Dependencies |
| `server/.env.example` | ✅ Fertig | Environment Template |

### Frontend ⚠️

| Component | Status | Beschreibung |
|-----------|--------|--------------|
| `dashboard/` | ⚠️ Leere Hülle | React + Vite, noch nicht implementiert |
| `widget/` | ⚠️ Leere Hülle | Vanilla JS Widget, noch nicht implementiert |

### Dokumentation ✅

| File | Status | Beschreibung |
|------|--------|--------------|
| `README.md` | ✅ Fertig | Überblick + Tech Stack |
| `ONEPAGER.md` | ✅ Fertig | One-Pager für Pitch |
| `DOKUMENTATION.md` | ✅ Neu | Diese Datei |

---

## 12. Was noch fehlt

### Backend

- [ ] **Stripe Connect Onboarding Flow** (Authorization + Account Creation)
- [ ] **Subscription Billing** (in Stripe oder extern)
- [ ] **Email Versand** (Resend Integration — aktuell nur Mock)
- [ ] **Refresh Token Blacklist** (für Logout)
- [ ] **Mehr Validierung** (Preisbereich, Time-Lock Checks)

### Frontend

- [ ] **React Dashboard** (Dashboard UI vollständig)
- [ ] **Widget Code** (Vanilla JS Widget für Website-Einbettung)
- [ ] **Stripe Checkout** (Integration in Widget)

### Infrastructure

- [ ] **Railway Deployment** konfigurieren
- [ ] **PostgreSQL** auf Railway einrichten
- [ ] **Vercel** Deployment für Dashboard
- [ ] **Domain** aufsetzen (storno-match.com)
- [ ] **Stripe Dashboard** (Live/Test-Modus)

### Accounts die noch erstellt werden müssen

- [ ] **Stripe Account** (stripe.com)
- [ ] **Stripe Connect** aktivieren
- [ ] **Railway Account** (railway.app)
- [ ] **Resend Account** (resend.com)
- [ ] **Domain** (storno-match.com)

---

## 13. Dateistruktur

```
storno-match/
├── README.md                    ✅
├── ONEPAGER.md                  ✅
├── DOKUMENTATION.md             ✅ (diese Datei)
├── .gitignore                   ✅
│
├── server/                      ✅ Backend (Node.js + Express)
│   ├── package.json             ✅
│   ├── .env.example             ✅
│   │
│   ├── prisma/
│   │   └── schema.prisma        ✅ Komplettes DB Schema
│   │
│   └── src/
│       ├── index.js             ✅ Express App
│       │
│       ├── middleware/
│       │   ├── auth.js          ✅ JWT + API Key Auth
│       │   └── errorHandler.js  ✅ Global Error Handler
│       │
│       ├── routes/
│       │   ├── auth.js          ✅ Register, Login, Refresh
│       │   ├── listings.js      ✅ CRUD + Suche
│       │   ├── transfers.js     ✅ Kauf + Bestätigen + Ablehnen
│       │   ├── organizations.js ✅ Org-Verwaltung + Stripe Connect
│       │   ├── webhooks.js      ✅ Stripe Webhook Handler
│       │   └── admin.js         ✅ Plattform-Statistiken
│       │
│       └── services/
│           ├── stripe.js        ✅ Stripe Connect Wrapper
│           └── email.js         ✅ Email Templates (Mock)
│
├── dashboard/                   ⚠️ React Dashboard (LEER)
│   └── (React + Vite Scaffold)
│
└── widget/                      ⚠️ Vanilla JS Widget (LEER)
    └── (Einbettbarer Code)
```

---

## 14. Architektur Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                    STORNOMATCH PLATFORM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Widget     │     │   Dashboard  │     │    API      │ │
│  │  (VanillaJS) │     │    (React)   │     │  (REST)     │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│         │                    │                    │         │
│         │    API Key         │      JWT Auth      │         │
│         └────────────────────┼────────────────────┘         │
│                              │                                │
│                    ┌─────────▼─────────┐                     │
│                    │     Express API    │                     │
│                    │  (Authentication)  │                     │
│                    └─────────┬─────────┘                     │
│                              │                                │
│          ┌───────────────────┼───────────────────┐           │
│          │                   │                   │           │
│  ┌───────▼───────┐   ┌───────▼───────┐   ┌──────▼──────┐   │
│  │  PostgreSQL    │   │    Stripe     │   │   Resend    │   │
│  │   (Prisma)     │   │   Connect     │   │   (Email)   │   │
│  │   Railway      │   │  + Escrow     │   │             │   │
│  └───────────────┘   └───────────────┘   └─────────────┘   │
│                                                              │
│                    Railway              Vercel               │
│                  (Backend)           (Frontend)              │
└──────────────────────────────────────────────────────────────┘
```

---

## 15. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **White-Label** | Produkt, das ein anderer Anbieter unter eigener Marke anbieten kann |
| **Stripe Connect** | Stripe-Service für Marktplätze — Escrow, Payouts, Multi-Party Payments |
| **Time-Lock** | Regel, die Transfers nur bis X Stunden vor Abflug erlaubt |
| **Escrow** | Treuhandkonto — Geld wird gehalten bis Bedingungen erfüllt |
| **Creator Royalty** | Optionaler Anteil (5%) für den Reiseveranstalter |
| **API Key Auth** | Auth für Widget → Server (API Key statt JWT) |
| **JWT** | JSON Web Token — standardisierter Access Token |
| **Prisma** | ORM für Node.js — vereinfacht DB-Zugriff |
| **Railway** | Platform-as-a-Service für Node.js Apps + PostgreSQL |
| **Subdomain** | Subdomain pro Reiseveranstalter (z.B. condor-holidays.storno-match.com) |

---

## 16. Next Steps

1. 🔍 **Validierung** mit Branchenexperten
2. 🏗️ **MVP fertigstellen** (Dashboard + Widget)
3. 🎯 **3 Pilotkunden** gewinnen (kleine bis mittlere Veranstalter)
4. 📈 **Skalieren** über Peakwork-Netzwerk

---

## 17. Kontakt

**Dennis Magli**  
E-Commerce Manager

---

*Dies ist ein Konzept — MVP-Entwicklung kann kurzfristig starten.*
