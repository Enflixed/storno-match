# StornoMatch — Vollständige Technische Dokumentation

**Version:** 2.0
**Datum:** 26.06.2026
**Status:** MVP fertig — Backend + Widgets + Dashboard

---

## Inhaltsverzeichnis

1. [Das Projekt](#1-das-projekt)
2. [Geschäftsmodell](#2-geschäftsmodell)
3. [Produktübersicht](#3-produktübersicht)
4. [Flow: Wie ein Weiterverkauf funktioniert](#4-flow-wie-ein-weiterverkauf-funktioniert)
5. [Technischer Stack](#5-technischer-stack)
6. [Datenmodell (Prisma Schema)](#6-datenmodell-prisma-schema)
7. [API Endpoints](#7-api-endpoints)
8. [Authentifizierung](#8-authentifizierung)
9. [Sicherheit](#9-sicherheit)
10. [Fee-Berechnung](#10-fee-berechnung)
11. [Implementierungsstand](#11-implementierungsstand)
12. [Dateistruktur](#12-dateistruktur)
13. [Quick Reference](#13-quick-reference)
14. [ Glossar](#14-glossar)

---

## 1. Das Projekt

**Name:** StornoMatch
**Typ:** B2B White-Label SaaS
**GitHub:** github.com/Enflixed/storno-match

### Das Problem

Pauschalreisen sind illiquide — wenn Kunden stornieren, verlieren sie **50–80% des Reisepreises** als Stornogebühr. Die Reise selbst hat aber noch vollen Wert. Es gibt keinen automatisierten Markt, sie weiterzuverkaufen.

**Ergebnis:**
- Kunden zahlen drauf — 50–80% Stornogebühr
- Reise bleibt leer — kein Revenue für Veranstalter
- Niemand profitiert

### Die Lösung

Ein **White-Label-Widget**, das Reiseveranstalter auf ihrer Website einbetten. Kunden können ihre stornierten Reisen anbieten; andere Kunden können sie kaufen — gesteuert über Stripe Connect.

**Keine Blockchain. Keine Token. Stripe Connect übernimmt Payment + Escrow + Payout.**

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

### 3.1 Buyer Widget (`/widget/widget.js`)

Einbettbarer JavaScript-Code auf der Website des Reiseveranstalters:

```html
<script src="https://storno-match.com/widget/widget.js"></script>
<div id="storno-match-widget"></div>
<script>window.STORNOMATCH_ORG = 'mein-reiseveranstalter';</script>
```

**Funktionen:**
- Anzeige aller ACTIVE Listings einer Organisation
- Anonymisierte Seller-Daten (kein Name, keine Kontaktdaten)
- Vollständiges Kauf-Formular mit Flugbuchungsdaten (Buyer B)
- Stripe Checkout (Demo Mode)
- Responsive, keine externen Abhängigkeiten

**Status:** ✅ Fertig

### 3.2 Seller Widget (`/widget/seller.html`)

Standalone-HTML-Seite für Verkäufer (kein Login nötig):

```html
<script src="https://storno-match.com/widget/seller.js" data-seller-api-key="sk_test_..."></script>
```

**Flow:**
1. Verkäufer gibt Buchungsreferenz + Hotel-Info + Wunschpreis ein
2. Request wird als `PENDING_APPROVAL` gespeichert
3. Admin fügt Flugdaten hinzu → freigeben → `ACTIVE`

**Eingabefelder:**
- Buchungsreferenz, Reiseziel, Reisedaten
- Originalpreis + Wunschpreis (50–100% validiert)
- Hoteldetails (Name, Sterne, Adresse, Zimmer, Verpflegung)
- Transfer-Info
- Persönliche Daten (Name, E-Mail für Benachrichtigung)
- Stornogrund (optional, wird anonymisiert angezeigt)

**Status:** ✅ Fertig

### 3.3 Admin Dashboard (`/dashboard/`)

Admins Interface (Vanilla JS + HTML) zum Verwalten von:
- **Listings:** Erstellen, bearbeiten (alle Felder inkl. Flugdaten), freigeben, ablehnen, wieder öffnen
- **Transfers:** Alle Kauf-Transaktionen, vollständige Buyer-Daten, abschließen/ablehnen
- **Statistiken:** Wochenübersicht, Tagesanalysen

**Status:** ✅ Fertig

### 3.4 API (Express.js)

RESTful API für alle Operationen:
- Widget ↔ API Kommunikation (API-Key Auth)
- Dashboard ↔ API Kommunikation (JWT Auth)

**Status:** ✅ Fertig

---

## 4. Flow: Wie ein Weiterverkauf funktioniert

### Flow 1: Seller reicht Reise ein (kein Login)

```
1. Kunde A geht auf /widget/seller.html
2. Füllt Formular aus:
   - Buchungsreferenz
   - Reiseziel + Datum
   - Originalpreis + Wunschpreis (50-100% Regel)
   - Hotel-Details
   - Name + Email
   - Stornogrund (optional)
3. POST /api/listings (Widget API Key Auth)
4. Listing wird erstellt als: status = PENDING_APPROVAL
5. Admin sieht neues Listing im Dashboard
```

### Flow 2: Admin bearbeitet und gibt frei

```
1. Admin loggt sich ins Dashboard ein (JWT)
2. Sieht neues Listing unter "Listings"
3. Klickt "Ansehen" → Edit-Formular öffnet sich
4. Trägt Flugdaten ein:
   - Abflughafen/Ankunftsairport
   - Flugdatum + Uhrzeit
   - Airline + Flugnummer
   - Gepäck
   - Transfer-Typ
5. Klickt "Speichern & Freigeben"
6. POST /api/listings/:id/approve
7. Listing.status = ACTIVE
```

### Flow 3: Kunde B kauft die Reise

```
1. Kunde B sieht ACTIVE Listing im Buyer Widget
2. Klickt "Jetzt kaufen"
3. Füllt vollständiges Kauf-Formular aus (Buyer B Daten)
4. Stripe Checkout öffnet sich (Demo Mode)
5. Bezahlt (Betrag geht in Stripe Escrow)
6. Stripe Webhook: payment_intent.succeeded
7. Transfer erstellt mit status = PAID
8. Listing.status = PENDING (da Reise in Bearbeitung)
```

### Flow 4: Admin schließt Umpersonalisierung ab

```
1. Admin siegels neuen Transfer im Dashboard
2. Klickt "Bestätigen" oder "Ablehnen"
3. Bei Bestätigen:
   - POST /api/transfers/:id/complete
   - Stripe Transfer an Verkäufer (sellerPayoutCents)
   - Transfer.status = COMPLETED
   - Listing.status = SOLD
4. Bei Ablehnen:
   - POST /api/transfers/:id/reject
   - Automatische Rückerstattung an Käufer
   - Listing.status = ACTIVE (wird wieder angeboten)
```

---

## 5. Technischer Stack

| Layer | Technology | Verwendung |
|-------|------------|----------|
| **Backend** | Node.js + Express | API Server |
| **ORM** | Prisma | Datenbank-Abstraktion |
| **Datenbank** | SQLite (dev) / PostgreSQL (prod) | Persistenz |
| **Frontend (Dashboard)** | Vanilla JS + HTML | Admin Interface |
| **Frontend (Widget)** | Vanilla JS | Einbettbarer Code |
| **Payments** | Stripe Connect | Zahlungen + Payouts + Escrow |
| **Maps** | OpenStreetMap / Nominatim | Hotel-Karten (kein API Key nötig) |
| **Email** | Mock (Nodemailer) | Logs to console |
| **Auth (API)** | API Keys (SHA-256) | Widget-Auth |
| **Auth (Dashboard)** | JWT (7 Tage) | Dashboard-Login |
| **Hosting** | Railway (Backend) | Deployment |

---

## 6. Datenmodell (Prisma Schema)

### 6.1 Organization

```prisma
model Organization {
  id                String   @id @default(uuid())
  name              String               // "Mallorca Tours"
  subdomain         String   @unique    // "mallorca"
  logoUrl           String?

  // Stripe Connect
  stripeAccountId   String?
  stripeOnboarded   Boolean  @default(false)

  contactEmail      String
  contactName       String
  phone             String?
  website           String?

  // Billing
  plan              String   @default("STARTER")
  subscriptionEnds  DateTime?

  // Regeln
  minPricePercent   Int      @default(50)   // Min 50% des Originalpreises
  maxPricePercent   Int      @default(100)  // Max 100%
  timeLockHours     Int      @default(72)   // Kein Transfer <72h vor Abflug

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  users             User[]
  listings          Listing[]
  transfers         Transfer[]
}
```

### 6.2 User

```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String
  name           String
  role           String   @default("STAFF")  // OWNER | ADMIN | STAFF | SUPPORT
  organizationId String
  organization   Organization @relation(...)

  emailVerified  Boolean  @default(false)
  lastLogin      DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 6.3 Customer

```prisma
model Customer {
  id             String   @id @default(uuid())
  email          String
  name           String
  phone          String?
  organizationId String

  // Hashed for privacy
  emailHash      String   @unique
  phoneHash      String?  @unique

  // ─── BUYER B — Vollständige Daten für Flugbuchung ───
  gender         String?    // male | female | diverse
  firstName      String?
  lastName       String?
  birthDate      DateTime?
  birthPlace     String?
  title          String?    // Dr., Prof., etc.
  street         String?
  houseNumber    String?
  postalCode     String?
  city           String?
  country        String?
  nationality    String?    // "DE", "AT", "CH"

  createdAt      DateTime @default(now())

  buyerOf        Transfer[] @relation("BuyerCustomer")
  sellerOf       Transfer[] @relation("SellerCustomer")
}
```

### 6.4 Listing

```prisma
model Listing {
  id               String   @id @default(uuid())
  organizationId   String
  organization     Organization @relation(...)

  // Original Booking
  originalBookingRef String  // Interne Ref, nie öffentlich
  destination        String  // "Mallorca, Spanien"
  departureDate       DateTime?  // Optional (Seller weiß ggf. Datum nicht)
  returnDate          DateTime?  // Optional
  originalPriceCents  Int     // z.B. 59900 = €599.00

  // Verkäufer-Preis
  askingPriceCents   Int
  currency           String @default("EUR")

  description        String?

  // Status
  status             String @default("DRAFT")
  // DRAFT | PENDING_APPROVAL | ACTIVE | PENDING | SOLD | EXPIRED | CANCELLED | REJECTED

  rejectionReason    String?

  // Anonymisierung
  sellerNameAnonymous String  // "Thomas M."
  sellerEmailHash     String
  sellerReason        String?  // Warum storniert

  // ─── FLIGHT DETAILS (vom Admin ausgefüllt) ───
  departureAirport    String?
  arrivalAirport     String?
  flightOutboundDate DateTime?
  flightOutboundTime String?
  flightReturnDate   DateTime?
  flightReturnTime   String?
  airline            String?
  flightNumber       String?
  baggage            String?   // "1x23kg + Handgepäck"

  // ─── HOTEL DETAILS ───
  hotelName          String?
  hotelStars         Int?      // 1-5
  hotelStarsVerified Int?      // 1-5 (vom Admin verifiziert)
  hotelAddress       String?
  hotelMapEmbed      String?   // OpenStreetMap iframe URL
  roomCategory       String?   // "Deluxe, Meerblick, 32m²"
  boardType          String?   // AI | HP | BB | SC

  // ─── TRANSFER ───
  transferIncluded   Boolean @default(false)
  transferType       String?   // PRIVAT | SHUTTLE | SELBST

  stripePaymentIntentId String?

  expiresAt          DateTime?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  transfers          Transfer[]
}
```

### 6.5 Transfer

```prisma
model Transfer {
  id               String   @id @default(uuid())
  listingId        String
  listing          Listing  @relation(...)
  organizationId   String
  organization     Organization @relation(...)

  // Verkäufer
  sellerId         String
  sellerCustomerId String
  sellerEmailHash  String

  // Käufer
  buyerId          String
  buyerCustomerId  String
  buyerEmailHash   String

  // Relations
  buyerCustomer    Customer? @relation("BuyerCustomer", ...)
  sellerCustomer   Customer? @relation("SellerCustomer", ...)

  // Zahlung
  amountCents      Int
  currency         String @default("EUR")

  // Gebühren
  platformFeeCents      Int   // €39 fix
  creatorRoyaltyCents   Int?  // Optional 5%
  sellerPayoutCents     Int   // Was Verkäufer bekommt

  // Stripe
  stripePaymentIntentId String?
  stripeTransferId      String?
  stripeChargeId        String?

  status              String @default("PENDING")
  // PENDING | PAID | COMPLETED | REFUNDED | DISPUTED | CANCELLED

  reassignmentStatus   String @default("PENDING")
  // PENDING | IN_PROGRESS | COMPLETED | REJECTED | FAILED

  reassignmentNotes    String?

  paidAt       DateTime?
  completedAt   DateTime?
  refundedAt   DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 6.6 ApiKey

```prisma
model ApiKey {
  id              String @id @default(uuid())
  organizationId  String
  keyHash         String @unique  // SHA-256 Hash
  keyPrefix       String           // Erste 8 Zeichen
  name            String           // "Production", "Test"
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  active          Boolean @default(true)

  createdAt       DateTime @default(now())
}
```

### 6.7 WebhookEvent

```prisma
model WebhookEvent {
  id              String @id @default(uuid())
  stripeEventId  String @unique
  type            String
  processed       Boolean @default(false)
  processedAt     DateTime?
  payload         String   // JSON als String
  error           String?

  createdAt       DateTime @default(now())
}
```

---

## 7. API Endpoints

### 7.1 Authentication

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Organisation + Owner registrieren |
| POST | `/api/auth/login` | — | Login (JWT zurück) |
| POST | `/api/auth/refresh` | Refresh Token | Token erneuern |
| POST | `/api/auth/logout` | JWT | Logout |
| GET | `/api/auth/me` | JWT | Aktueller User |

**POST /api/auth/login Request:**
```json
{ "email": "admin@mallorca-tours.de", "password": "admin123" }
```

**POST /api/auth/login Response:**
```json
{
  "success": true,
  "organization": { "id": "...", "name": "...", "subdomain": "mallorca" },
  "user": { "id": "...", "name": "...", "email": "...", "role": "OWNER" },
  "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

### 7.2 Listings

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|-------------|
| GET | `/api/listings` | — | Listings (öffentlich, nur ACTIVE) |
| GET | `/api/listings/:id` | **JWT** | Listing Details (Admin: alle Status) |
| POST | `/api/listings` | **API Key** | Listing erstellen (Seller Widget) |
| PUT | `/api/listings/:id` | **JWT** | Listing aktualisieren (Admin) |
| POST | `/api/listings/:id/approve` | **JWT** | Listing freigeben |
| POST | `/api/listings/:id/reject` | **JWT** | Listing ablehnen |
| DELETE | `/api/listings/:id` | **JWT** | Listing löschen |
| GET | `/api/listings/seller/my` | **JWT** | Meine Listings als Verkäufer |

**GET /api/listings Query-Parameter:**
```
?org=mallorca           # Subdomain der Organisation
?status=ACTIVE          # Filter nach Status (nur ACTIVE für öffentlich)
?status=all             # Admin: alle Status anzeigen
?limit=50&offset=0      # Pagination
```

**GET /api/listings Response (Public):**
```json
{
  "listings": [
    {
      "id": "uuid",
      "destination": "Mallorca, Spanien",
      "departureDate": "2026-07-15T00:00:00Z",
      "returnDate": "2026-07-22T00:00:00Z",
      "originalPriceCents": 59900,
      "originalPriceEur": "599.00",
      "askingPriceCents": 42000,
      "askingPriceEur": "420.00",
      "sellerNameAnonymous": "Thomas M.",
      "sellerReason": "Terminkollision",
      "departureAirport": "München (MUC)",
      "arrivalAirport": "Palma de Mallorca (PMI)",
      "flightOutboundDate": "2026-07-15T00:00:00Z",
      "flightOutboundTime": "08:30",
      "airline": "TUIfly",
      "flightNumber": "X3 1234",
      "hotelName": "Hotel Bell Port",
      "hotelStars": 4,
      "hotelAddress": "Carrer de la Platja 45...",
      "googleMapsLink": "https://www.google.com/maps/search/?api=1&query=...",
      "roomCategory": "Doppelzimmer, Meerblick",
      "boardType": "AI",
      "boardTypeLabel": "All Inclusive",
      "transferIncluded": true,
      "transferType": "PRIVAT",
      "transferTypeLabel": "Privater Transfer inklusive",
      "organization": {
        "name": "Mallorca Tours",
        "subdomain": "mallorca",
        "logoUrl": "https://..."
      }
    }
  ],
  "total": 1
}
```

**POST /api/listings Request (Seller Widget):**
```json
{
  "originalBookingRef": "BK-2026-12345",
  "destination": "Mallorca, Spanien",
  "departureDate": "2026-07-15T00:00:00Z",
  "returnDate": "2026-07-22T00:00:00Z",
  "originalPriceCents": 59900,
  "askingPriceCents": 42000,
  "description": "Schöne 7-Tage Pauschalreise",
  "sellerName": "Thomas Müller",
  "sellerEmail": "thomas@example.com",
  "sellerReason": "Terminkollision - leider doppelt gebucht",
  "hotelName": "Hotel Bell Port",
  "hotelStars": 4,
  "hotelAddress": "Carrer de la Platja 45, 07660 Cala Rajada",
  "roomCategory": "Doppelzimmer, Meerblick",
  "boardType": "AI",
  "transferIncluded": true,
  "transferType": "PRIVAT"
}
```

### 7.3 Transfers

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|-------------|
| GET | `/api/transfers` | **JWT** | Alle Transfers der Org |
| GET | `/api/transfers/:id` | **JWT** | Transfer Details (inkl. Buyer B) |
| POST | `/api/transfers` | **API Key** | Kauf initiieren (Widget) |
| POST | `/api/transfers/:id/confirm-payment` | — | Zahlung bestätigen (Stripe WH) |
| POST | `/api/transfers/:id/complete` | **JWT** | Umpersonalisierung abschließen |
| POST | `/api/transfers/:id/reject` | **JWT** | Transfer ablehnen |
| POST | `/api/transfers/:id/confirm-seller` | **JWT** | Seller-Bestätigung |

**POST /api/transfers Request (Buyer Widget):**
```json
{
  "listingId": "uuid",
  "buyer": {
    "gender": "female",
    "firstName": "Lisa",
    "lastName": "Schmidt",
    "birthDate": "1992-03-15",
    "birthPlace": "Hamburg",
    "title": null,
    "street": "Hauptstraße",
    "houseNumber": "23",
    "postalCode": "20359",
    "city": "Hamburg",
    "country": "Deutschland",
    "nationality": "DE"
  },
  "email": "lisa@example.com",
  "phone": "+491701234567"
}
```

### 7.4 Organizations

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|-------------|
| GET | `/api/organizations` | **JWT** | Meine Organisation |
| PUT | `/api/organizations` | **JWT** (Owner/Admin) | Einstellungen ändern |
| POST | `/api/organizations/stripe/connect` | **JWT** (Owner) | Stripe Onboarding starten |
| GET | `/api/organizations/stripe/status` | **JWT** (Owner) | Stripe Status |
| GET | `/api/organizations/stats` | **JWT** | Statistiken |
| GET | `/api/organizations/:subdomain` | — | Org Info (öffentlich) |

### 7.5 Webhooks

| Method | Endpoint | Auth | Beschreibung |
|--------|----------|------|-------------|
| POST | `/api/webhooks/stripe` | Stripe Signature | Stripe Events |

---

## 8. Authentifizierung

### Dashboard → API (JWT)

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **Access Token:** 7 Tage gültig
- **Refresh Token:** 7 Tage gültig
- **Login:** `POST /api/auth/login`
- **Logout:** `POST /api/auth/logout`

### Widget → API (API Key)

```http
X-API-Key: sk_test_mallorca_widget_12345678
```

- Key wird in DB als SHA-256 Hash gespeichert
- Widget-Auth hat **keinen** `req.user` — nur `organizationId`
- `isAdminSubmission = !!req.user` — Widget-Submissions umgehen Time-Lock

---

## 9. Sicherheit

### 9.1 Anonymisierung

- **Käufer sieht:** Nur `sellerNameAnonymous` (z.B. "Thomas M.")
- **Email/Phone:** NIEMALS in Listings — nur SHA-256 Hashes
- **Buchungsreferenz:** Nur intern, nie öffentlich
- **Buyer-Daten:** Vollständige PII nur für Admin sichtbar, Email nicht in Transfer-Liste

### 9.2 Security-Maßnahmen

| Maßnahme | Status | Details |
|----------|--------|---------|
| **Passwort-Hashing** | ✅ | bcrypt, 12 Rounds |
| **JWT** | ✅ | 7 Tage, proper expiry |
| **API Key Hashing** | ✅ | SHA-256 in DB |
| **Stripe Webhook** | ✅ | Signatur-Verifikation wenn Secret gesetzt |
| **CORS** | ✅ | Whitelist-Origins |
| **Helmet CSP** | ✅ | Security Headers aktiv |
| **Rate Limiting** | ✅ | 100 req/15min/IP |
| **SQL Injection** | ✅ | Prisma ORM (parameterized queries) |
| **XSS** | ✅ | `escapeHtml()` + `sanitizeListing()` |
| **Org Isolation** | ✅ | Jede Org sieht nur eigene Daten |
| **Status Exposure** | ✅ | `GET /:id` nur ACTIVE öffentlich, alle für Admin |

### 9.3 Seller Widget API Key

⚠️ **Demo-Limitierung:** Der API Key ist in `seller.html` als `data-` Attribut sichtbar. Für Produktion: Reisebüro betreibt einen Backend-Proxy, der den Key serverseitig hält.

---

## 10. Fee-Berechnung

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

### Backend ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Express App | ✅ | `src/index.js` |
| Auth Middleware | ✅ | JWT (7d) + API Key |
| Listings CRUD | ✅ | + approve/reject/reopen |
| Transfers CRUD | ✅ | + complete/reject/confirm-payment |
| Organizations | ✅ | + Stripe Connect (Demo) |
| Webhooks | ✅ | Stripe Webhook Handler |
| Maps Service | ✅ | OpenStreetMap/Nominatim |
| Stripe Service | ✅ | DEMO_MODE=true |
| Email Service | ⚠️ | Mock (logs to console) |
| Prisma Schema | ✅ | SQLite, PostgreSQL-ready |
| Seed Script | ✅ | Idempotent, `npm run db:seed` |

### Frontend ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Buyer Widget | ✅ | Vanilla JS, iframe-ready |
| Seller Widget | ✅ | Standalone HTML+JS |
| Admin Dashboard | ✅ | Vollständiges Edit-Formular |
| Widget Overview | ✅ | `/widget/index.html` |

### Fehlende Features

| Feature | Priorität | Notes |
|---------|----------|-------|
| Echte Stripe Connect Flows | Hoch | DEMO_MODE=true |
| Email-Versand (Resend) | Mittel | Aktuell nur Mock |
| Subscription Billing | Mittel | Stripe Billing oder extern |
| Refresh Token Blacklist | Niedrig | Logout currently stateless |
| PostgreSQL Migration | Mittel | Schema fertig, nur Provider wechseln |

---

## 12. Dateistruktur

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
│   │   ├── schema.prisma       # Vollständiges DB Schema
│   │   ├── seed.js             # Testdaten (idempotent)
│   │   └── dev.db              # Lokale SQLite (gitignored)
│   └── src/
│       ├── index.js            # Express App + Middleware
│       ├── middleware/
│       │   └── auth.js         # JWT + API Key Auth
│       ├── routes/
│       │   ├── auth.js         # Register, Login, Refresh, Logout, Me
│       │   ├── listings.js     # CRUD + approve/reject/reopen
│       │   ├── transfers.js    # Kauf + complete/reject/confirm-payment
│       │   ├── organizations.js # Org + Stripe Connect + Stats
│       │   └── webhooks.js     # Stripe Webhook Handler
│       └── services/
│           ├── stripe.js       # Stripe Connect Wrapper
│           └── maps.js         # OpenStreetMap / Nominatim
│
├── widget/
│   ├── index.html              # Widget-Übersicht + Demo-Links
│   ├── buyer-embed.html         # Iframe-Content für Buyer Widget
│   ├── widget.js               # Buyer Widget (Vanilla JS)
│   ├── seller.html             # Seller Widget (Standalone HTML)
│   └── seller.js               # Seller Widget JS
│
└── dashboard/
    ├── index.html              # Dashboard HTML + CSS
    └── dashboard.js            # Dashboard JS (Vollständiges Edit-Formular)
```

---

## 13. Quick Reference

### Server starten

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run db:seed    # Testdaten
npm run dev        # Dev Server auf Port 3000
```

### URLs

| URL | Beschreibung |
|-----|--------------|
| `http://localhost:3000/` | API Health Check |
| `http://localhost:3000/api/listings?org=mallorca` | Listings |
| `http://localhost:3000/widget/` | Widget Übersicht |
| `http://localhost:3000/widget/seller.html` | Seller Widget |
| `http://localhost:3000/dashboard/` | Admin Dashboard |

### Test Credentials

| | |
|---|---|
| Org | `mallorca` |
| Admin Login | `admin@mallorca-tours.de` / `admin123` |
| Widget API Key | `sk_test_mallorca_widget_12345678` |

### Env-Variablen (.env)

```
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="dev-secret-..."
JWT_REFRESH_SECRET="dev-refresh-..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET=""
DEMO_MODE="true"
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
```

### npm Scripts

```bash
npm run dev          # Server starten (nodemon)
npm start            # Server starten (production)
npm run db:generate   # Prisma Client generieren
npm run db:push       # Schema in DB schreiben
npm run db:seed       # Testdaten einsäen
npm run db:studio     # Prisma Studio öffnen
```

### Listing Status Flow

```
DRAFT → PENDING_APPROVAL → ACTIVE → PENDING → SOLD
                  ↓                ↑
              REJECTED          CANCELLED
                  ↓
            (reopen) → PENDING_APPROVAL
```

### Transfer Status Flow

```
PENDING → PAID → COMPLETED
           ↓         ↓
        REFUNDED  REJECTED
           ↓
        DISPUTED
```

---

## 14. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **White-Label** | Produkt, das ein Anbieter unter eigener Marke anbieten kann |
| **Stripe Connect** | Stripe-Service für Marktplätze — Escrow, Payouts, Multi-Party Payments |
| **DEMO_MODE** | Modus ohne echte Stripe-API — erstellt Mock Payment Intents |
| **Time-Lock** | Regel, die Transfers nur bis X Stunden vor Abflug erlaubt |
| **Escrow** | Treuhandkonto — Geld wird gehalten bis Bedingungen erfüllt |
| **Creator Royalty** | Optionaler Anteil (5%) für den Reiseveranstalter |
| **Buyer B / Buyer B Data** | Vollständige personenbezogene Daten für Flugbuchung (Name, Geburtsdatum, Adresse etc.) |
| **API Key Auth** | Auth für Widget → Server (SHA-256 Hash in DB) |
| **JWT** | JSON Web Token — Access Token für Dashboard-Auth |
| **Prisma** | ORM für Node.js — vereinfacht DB-Zugriff |
| **Nominatim** | OpenStreetMap Geocoding API — keine API Key nötig |
| **Seller Widget** | Standalone HTML-Seite für Verkäufer (kein Login) |
| **Buyer Widget** | Einbettbares JS-Widget für Käufer |
| **Admin Submission** | Seller-Submission, bei der Admin Flugdaten hinzufügt und dann freigibt |
| **isAdminSubmission** | Flag das unterscheidet ob eine Submission vom Admin direkt oder vom Seller kam |

---

*Letztes Update: 26.06.2026 — MVP Stand*
