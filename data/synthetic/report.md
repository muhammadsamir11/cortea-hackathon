# Forensic Findings — dossier “synthetic”

Generated 2026-07-18T10:47:40.468Z · model: offline-fixture

**Method.** Structured accounting records were parsed deterministically; every affected record carries
a source row, sheet, or page reference (23/23 records verified).
Optional AI review is kept separate from engine detection. **No number without a source.**

## Detected — pending independent review (9)

### Account DE55100400001234567800: books differ from bank confirmation by EUR 100,000.00

*balance_manipulation · tier: proven · severity: high · amount: EUR 100,000.00*

For account DE55100400001234567800 as of 2024-12-31, the dossier asserts irreconcilable balances: EUR 412,350.22 per bank_confirmation vs EUR 512,350.22 per trial_balance/financial_statement. The bank's own confirmation is the authoritative external evidence — the difference of EUR 100,000.00 in the books has no support from the bank.

**Evidence:**
> **bank-confirmation-2024.pdf · p.1** — “Saldo per 31.12.2024: EUR 412.350,22”
> **trial-balance-2024.xlsx · SuSa 2024!r.1-10** — “Bank (Commerzbank Kontokorrent DE55 1004 0000 1234 5678 00) | 512.350,22”
> **annual-report-extract.txt · l.1-22** — “Kassenbestand, Guthaben bei Kreditinstituten: EUR 512.350,22”

---

### Document RE-2024-041 paid 2× (Nordwind Consulting GmbH)

*duplicate_payment · tier: proven · severity: medium · amount: EUR 18,400.00*

The ledger shows 2 outgoing payments referencing the same document number RE-2024-041 to Nordwind Consulting GmbH, each over EUR 18,400.00. Payment dates: 2024-03-15, 2024-03-28. No correcting entry or credit note referencing this number was found in the dossier.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “15.03.2024;RE-2024-041;Nordwind Consulting GmbH;Beratungsleistungen März;-18.400,00”
> **ledger-2024.csv · l.1-16** — “28.03.2024;RE-2024-041;Nordwind Consulting Ltd.;Beratungsleistungen März;-18.400,00”

---

### Document RE-2024-033 paid 2× (Druckerei Held GmbH)

*duplicate_payment · tier: proven · severity: medium · amount: EUR 6,200.00*

The ledger shows 2 outgoing payments referencing the same document number RE-2024-033 to Druckerei Held GmbH, each over EUR 6,200.00. Payment dates: 2024-02-08, 2024-02-15. A correcting entry or credit note referencing this number exists in the dossier — the tribunal must weigh whether it fully neutralizes the duplicate.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “08.02.2024;RE-2024-033;Druckerei Held GmbH;Druckkosten Broschüren;-6.200,00”
> **ledger-2024.csv · l.1-16** — “15.02.2024;RE-2024-033;Druckerei Held GmbH;Druckkosten Broschüren;-6.200,00”
> **ledger-2024.csv · l.1-16** — “20.02.2024;GS-2024-008;Druckerei Held GmbH;Gutschrift – Stornierung Doppelbuchung RE-2024-033;6.200,00”
> **credit-note-gs-2024-008.txt · l.1-25** — “Gutschriftsbetrag: EUR 6.200,00”
> **credit-note-gs-2024-008.txt · l.1-25** — “versehentlich doppelt in Ihrem System erfasst”

---

### Payment to Nordwind Consulting GmbH sent to undeclared account

*payment_redirect · tier: corroborated · severity: high · amount: EUR 18,400.00*

A payment of EUR 18,400.00 on 2024-03-28 to Nordwind Consulting GmbH went to IBAN DE44500105175407324931, which does not match any bank account this vendor declared in the dossier (declared: DE89370400440532013000). Redirecting vendor payments to a different account is a classic payment-diversion pattern.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “28.03.2024;RE-2024-041;Nordwind Consulting Ltd.;Beratungsleistungen März;-18.400,00”
> **ledger-2024.csv · l.1-16** — “15.03.2024;RE-2024-041;Nordwind Consulting GmbH;Beratungsleistungen März;-18.400,00”
> **invoice-re-2024-041.txt · l.1-20** — “IBAN: DE89 3704 0044 0532 0130 00”
> **invoice-re-2024-041.txt · l.1-20** — “Pauschalhonorar gemäß Angebot: EUR 18.400,00”

---

### Payment to TechServe Solutions GmbH sent to undeclared account

*payment_redirect · tier: corroborated · severity: high · amount: EUR 12,750.00*

A payment of EUR 12,750.00 on 2024-03-12 to TechServe Solutions GmbH went to IBAN DE75512108001245126199, which does not match any bank account this vendor declared in the dossier (declared: DE02120300000000202051). Redirecting vendor payments to a different account is a classic payment-diversion pattern.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “12.03.2024;RE-2024-055;TechServe Solutions GmbH;Wartungsvertrag Q1;-12.750,00;EUR;DE75512108001245126199”
> **invoice-re-2024-055.txt · l.1-19** — “IBAN: DE02 1203 0000 0000 2020 51”
> **invoice-re-2024-055.txt · l.1-19** — “Rechnungsdatum: 10.03.2024”
> **contract-techserve.txt · l.1-27** — “IBAN: DE02 1203 0000 0000 2020 51, BIC: BYLADEM1001”

---

### "Nordwind Consulting GmbH" / "Nordwind Consulting Ltd." — one vendor, 2 bank accounts

*entity_identity_game · tier: corroborated · severity: medium*

Name variants (Nordwind Consulting GmbH, Nordwind Consulting Ltd.) that resolve to the same vendor appear with 2 different IBANs (DE89370400440532013000, DE44500105175407324931). Splitting one vendor identity across name variants and accounts is used to slip duplicate or diverted payments past controls.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “15.03.2024;RE-2024-041;Nordwind Consulting GmbH;Beratungsleistungen März;-18.400,00”
> **ledger-2024.csv · l.1-16** — “28.03.2024;RE-2024-041;Nordwind Consulting Ltd.;Beratungsleistungen März;-18.400,00”
> **invoice-re-2024-041.txt · l.1-20** — “IBAN: DE89 3704 0044 0532 0130 00”
> **invoice-re-2024-041.txt · l.1-20** — “Pauschalhonorar gemäß Angebot: EUR 18.400,00”
> **purchase-orders.csv · l.1-7** — “PO-2024-11;01.03.2024;Nordwind Consulting GmbH;18.400,00”

---

### Baltic Media UG: EUR 24,900.00 paid without purchase order — just below approval threshold

*threshold_avoidance · tier: corroborated · severity: high · amount: EUR 24,900.00*

Invoice RE-2024-077 from Baltic Media UG over EUR 24,900.00 was paid (2024-11-05) but no matching purchase order exists in the dossier. The amount sits 100.00 below the EUR 25,000.00 approval threshold documented in the dossier — a pattern consistent with deliberate threshold avoidance.

**Evidence:**
> **invoice-re-2024-077.txt · l.1-20** — “Total amount due: EUR 24,900.00”
> **invoice-re-2024-077.txt · l.1-20** — “No purchase order reference provided.”
> **ledger-2024.csv · l.1-16** — “05.11.2024;RE-2024-077;Baltic Media UG;Kampagnenmanagement Q4;-24.900,00”
> **approval-policy.txt · l.1-17** — “above EUR 25,000: CFO approval, PO mandatory”

---

### Invoice RE-2024-055 predates its own purchase order PO-2024-19

*backdating · tier: proven · severity: medium · amount: EUR 12,750.00*

Invoice RE-2024-055 is dated 2024-03-10 and references purchase order PO-2024-19, which was only issued on 2024-03-22. An invoice cannot legitimately reference a purchase order that did not exist yet — this indicates the PO was created after the fact.

**Evidence:**
> **invoice-re-2024-055.txt · l.1-19** — “IBAN: DE02 1203 0000 0000 2020 51”
> **invoice-re-2024-055.txt · l.1-19** — “Rechnungsdatum: 10.03.2024”
> **purchase-orders.csv · l.1-7** — “PO-2024-19;22.03.2024;TechServe Solutions GmbH;12.750,00”

---

### Money round-trip: PayFlux GmbH → Aurora Ventures GmbH → Meridian Holding AG → PayFlux GmbH

*round_tripping · tier: corroborated · severity: high · amount: EUR 50,000.00*

Funds leave PayFlux GmbH and return via Aurora Ventures GmbH and Meridian Holding AG: PayFlux GmbH paid Aurora Ventures GmbH EUR 50,000.00 on 2024-06-10; Aurora Ventures GmbH paid Meridian Holding AG EUR 48,000.00 on 2024-06-05; Meridian Holding AG paid PayFlux GmbH EUR 47,500.00 on 2024-06-22. Amounts shrink only marginally along the loop — the signature of round-tripping used to fabricate revenue or other income.

**Evidence:**
> **ledger-2024.csv · l.1-16** — “10.06.2024;AV-2024-003;Aurora Ventures GmbH;Strategische Beratung lt. Vertrag;-50.000,00”
> **email-cfo-aurora.eml · body.l.1-15** — “Aurora leitet davon 48.000 EUR an die Meridian Holding”
> **ledger-2024.csv · l.1-16** — “22.06.2024;LZ-2024-011;Meridian Holding AG;Lizenzgebühr Softwareplattform;47.500,00”

## Confirmed findings (0)

_none_

## Requires auditor judgment (0)

_none_

## Examined and acquitted (0)

Items that looked suspicious but have a documented innocent explanation — reported for transparency.

_none_
