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
| Frontend | Vanilla JS (Dashboard + Widget, kein Framework) |
| Payments | Stripe Connect |
| Email | Resend |
| Hosting | Railway + Vercel |

---

## Next Steps

1. ✅ **MVP fertig** — Backend + Widgets + Dashboard
2. 🎯 **3 Pilotkunden** gewinnen (kleine bis mittlere Veranstalter)
3. 💳 **Echtes Stripe Connect** — DEMO_MODE deaktivieren
4. 📧 **Email-Benachrichtigungen** — Resend Integration
5. 🚀 **Railway Deployment** — PostgreSQL + Production

---
## WIN WIN WIN?

Für den ursprünglichen Kunden, also den Verkäufer, ist der Gewinn offensichtlich: Er bekommt bei einer Stornierung nicht nur die klassische Storno-Option, bei der oft ein großer Teil des Reisepreises verloren geht, sondern eine zweite Chance, noch Geld zurückzubekommen. Gerade bei teuren Pauschalreisen kann das emotional und finanziell ein riesiger Unterschied sein. Statt „Pech gehabt, Stornokosten zahlen“ entsteht eine Alternative: „Vielleicht übernimmt jemand meine Reise.“

Für den neuen Kunden, also den Käufer, entsteht ebenfalls ein Vorteil: Er bekommt Zugang zu Reisen, die eventuell günstiger sind als der aktuelle Marktpreis oder kurzfristig sonst gar nicht mehr verfügbar wären. Besonders bei beliebten Hotels, Ferienzeiten oder kurzfristigen Abreisen kann das attraktiv sein. Er kauft nicht irgendein anonymes Schnäppchen, sondern ein konkretes Reisepaket, das bereits existiert.

Für den Reiseveranstalter ist es spannend, weil er aus einer Storno-Situation wieder einen aktiven Vorgang mit Umsatz-, Service- und Kundenbindungspotenzial macht. Ohne Plattform wäre der ursprüngliche Kunde frustriert, der Platz/Reisebestand eventuell kompliziert zu verwerten, und der Veranstalter hätte trotzdem manuellen Aufwand. Mit StornoMatch könnte der Veranstalter kontrolliert moderieren: Welche Reisen dürfen angeboten werden, welche Fristen gelten, welche Umbuchungsgebühren fallen an, wie läuft die Umpersonalisierung?

Der eigentliche Hebel ist: Du verwandelst eine negative Customer Journey in eine neutrale oder sogar positive.

Normalerweise ist Storno für alle unangenehm:
Kunde verliert Geld.
Reiseveranstalter hat Support-Aufwand.
Potenzielle Käufer sehen die Reise nie.

Mit den Modell wird daraus:

Kunde bekommt Geld zurück.
Käufer bekommt ein attraktives Angebot.
Veranstalter behält Kontrolle, reduziert Frust und kann den Vorgang strukturiert abwickeln.

## Kontakt

**Dennis**  
Head of E-Commerce, Condor Holidays  
[Email] | [LinkedIn]

---

*MVP fertig — Backend + Buyer Widget + Seller Widget + Admin Dashboard. Stripe in Demo Mode.*
