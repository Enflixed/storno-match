# StornoMatch — One-Pager

**B2B White-Label Zweitmarkt für Pauschalreisen**

---

## Das Problem

Kunden stornieren ihre Pauschalreise und verlieren **50-80% des Reisepreises** als Stornogebühr. Die Reise selbst hat aber noch vollen Wert — es gibt keinen automatisierten Markt, um sie weiterzuverkaufen.

**Ergebnis:** Kunden zahlen drauf, Reise bleibt leer → niemand profitiert.

---

## Die Lösung

Ein **White-Label-Widget**, das Reiseveranstalter auf ihrer Website einbetten.

```
Kunde A (Verkäufer)
│
├── Klickt "Reise anbieten" im Widget
├── Erstellt Listing (anonymisiert)
└── Wartet auf Käufer

Kunde B (Käufer)
│
├── Findet Reise im Widget
├── Bezahlt über Stripe (Treuhand)
└── Reise wird umpersonalisert

Reiseveranstalter
│
├── Erhält Benachrichtigung
├── Personnalisiert um
└── Payout an Kunde A
```

**Keine Blockchain. Keine Token. Stripe Connect übernimmt Payment + Payout.**

---

## Time-Lock Regeln

- 🔒 Kein Transfer **<72h vor Reisebeginn**
- 📉 Mindestpreis: **50% des Originalpreises**
- 📈 Höchstpreis: **100%** (kein Aufschlag)

---

## Revenue Model

| Einnahmequelle | Betrag |
|-----------------|--------|
| SaaS-Gebühr (pro Veranstalter) | €149-299/Monat |
| Setup-Fee | €499 einmalig |
| Transaktions-Gebühr | €39/Trade |
| Creator Royalty (optional) | 5% |

**Beispiel Jahr 1:**
> 5 Kunden × €149 + 20 Trades × €39 = **~€19.000 Umsatz**

**Fixkosten:** ~€11-15/Monat (Server, DB, Stripe-Gebühren)

---

## Warum jetzt?

- ✅ **Stripe Connect** macht Payment+Escrow+Payout trivial
- ✅ **Kein vergleichbares Produkt** am Markt
- ✅ Reiseveranstalter suchen aktiv nach **Revenue-Retention** Tools
- ✅ White-Label = keine Brandingskills nötig, nur Integration

---

## Technischer Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + Prisma |
| Database | PostgreSQL (Railway) |
| Frontend | React (Dashboard) + Vanilla JS (Widget) |
| Payments | Stripe Connect |
| Email | Resend |
| Hosting | Railway + Vercel |

---

## Next Steps

1. 🔍 **Validierung** mit Branchenexperten
2. 🏗️ **MVP fertigstellen** (Backend + Widget)
3. 🎯 **3 Pilotkunden** gewinnen (kleine bis mittlere Veranstalter)
4. 📈 **Skalieren** über Peakwork-Netzwerk

---

## Kontakt

**Dennis**  
Head of E-Commerce, Condor Holidays  
[Email] | [LinkedIn]

---

*Dies ist ein Konzept — noch nicht implementiert. MVP-Entwicklung kann kurzfristig starten.*
