# Forensic Findings — dossier “muster-verpackungen”

Generated 2026-02-04T00:00:00.000Z · model: offline-deterministic

**Method.** Structured accounting records were parsed deterministically; every affected record carries
a source row, sheet, or page reference (32926/32926 records verified).
Optional AI review is kept separate from engine detection. **No number without a source.**

**Financial impact.** Reported profit: EUR 2,599,841.80. Adjusted profit after detected profit-overstatement findings: EUR 2,257,041.80.

**Source integrity:** passed (18/18 checks).
- Warning: The 2024 prior-year balance workbook contains headings but no data rows.
- Warning: The Steuercodes directory is empty.

## Detected — pending independent review (4)

### 6 repair and maintenance costs capitalized as fixed assets

*capitalized_repairs · tier: corroborated · severity: high · amount: EUR 150,800.00*

6 asset additions carry repair-type descriptions and were posted as acquisitions to fixed-asset classes. Their EUR 150800.00 net cost overstates both assets and profit.

**Evidence:**
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.49** — “"040000-000191";20.11.2025;"ER901421";28000,00;"EUR";28000,00;"Acquisition";"";"040000";"Current"”
> **Anlagen.txt · Anlagen!r.191** — “"040000-000191";"Reparatur Konfektioniermaschine Linie 2";"040000";"Tangible";"";"";"";"";"Aktiv"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2563** — “"200056";"ER901421";20.11.2025;"";20.11.2025;"Reparatur Konfektioniermaschine Linie 2";-33320,00;"EUR";-33320,00;"";"";"Purch";"Yes"”
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.50** — “"040000-000192";04.03.2025;"ER901422";34000,00;"EUR";34000,00;"Acquisition";"";"040000";"Current"”
> **Anlagen.txt · Anlagen!r.192** — “"040000-000192";"Austausch Hydraulikaggregat Presse 3";"040000";"Tangible";"";"";"";"";"Aktiv"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2564** — “"200059";"ER901422";04.03.2025;"";04.03.2025;"Austausch Hydraulikaggregat Presse 3";-40460,00;"EUR";-40460,00;"";"";"Purch";"Yes"”
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.51** — “"060000-000193";13.03.2025;"ER901423";15500,00;"EUR";15500,00;"Acquisition";"";"060000";"Current"”
> **Anlagen.txt · Anlagen!r.193** — “"060000-000193";"Instandsetzung Förderband Halle II";"060000";"Tangible";"";"";"";"";"Aktiv"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2565** — “"200127";"ER901423";13.03.2025;"";13.03.2025;"Instandsetzung Förderband Halle II";-18445,00;"EUR";-18445,00;"";"";"Purch";"Yes"”
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.52** — “"040000-000194";26.11.2025;"ER901424";41000,00;"EUR";41000,00;"Acquisition";"";"040000";"Current"”
> **Anlagen.txt · Anlagen!r.194** — “"040000-000194";"Generalüberholung Stanzautomat";"040000";"Tangible";"";"";"";"";"Aktiv"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2566** — “"200118";"ER901424";26.11.2025;"";26.11.2025;"Generalüberholung Stanzautomat";-48790,00;"EUR";-48790,00;"";"";"Purch";"Yes"”
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.53** — “"060000-000195";23.05.2025;"ER901425";12800,00;"EUR";12800,00;"Acquisition";"";"060000";"Current"”
> **Anlagen.txt · Anlagen!r.195** — “"060000-000195";"Reparatur Kälteanlage Lager";"060000";"Tangible";"";"";"";"";"Aktiv"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2567** — “"200101";"ER901425";23.05.2025;"";23.05.2025;"Reparatur Kälteanlage Lager";-15232,00;"EUR";-15232,00;"";"";"Purch";"Yes"”
> **Anlagenbuchungen.txt · Anlagenbuchungen!r.54** — “"040000-000196";20.11.2025;"ER901426";19500,00;"EUR";19500,00;"Acquisition";"";"040000";"Current"”

**Calculations:**
- Capitalized repair cost: 6 asset acquisitions = EUR 150,800.00

**Affected records (6):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 2025-11-20 | ER901421 | Nova Technik GmbH | EUR 28,000.00 net |
| 2025-03-04 | ER901422 | Lupus Handel SE | EUR 34,000.00 net |
| 2025-03-13 | ER901423 | Ost Systeme e.K. | EUR 15,500.00 net |
| 2025-11-26 | ER901424 | Nova Chemie GmbH & Co. KG | EUR 41,000.00 net |
| 2025-05-23 | ER901425 | Prisma Etiketten SE | EUR 12,800.00 net |
| 2025-11-20 | ER901426 | Kranich Druck e.K. | EUR 19,500.00 net |

---

### 8 December costs omitted from the 2025 close

*cutoff_failure · tier: corroborated · severity: high · amount: EUR 192,000.00*

8 invoices booked in 2026 have 2025 service dates and matching December receipts marked as still open. No matching 2025 posting exists, leaving EUR 192000.00 unaccrued and overstating profit.

**Evidence:**
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.2** — “ER901427;Rechnung;209130;Nord Transport GmbH;15.01.2026;21.12.2025;22000,00;EUR;Frachten Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.842** — “WE400840;21.12.2025;;209130;Nord Transport GmbH;22000,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.3** — “ER901428;Rechnung;209131;Delta Energie GmbH;03.01.2026;26.12.2025;38000,00;EUR;Energie Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.843** — “WE400841;26.12.2025;;209131;Delta Energie GmbH;38000,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.4** — “ER901429;Rechnung;209132;Atlas Werkstoffe GmbH;15.01.2026;22.12.2025;41000,00;EUR;Materiallieferung 22.12.2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.844** — “WE400842;22.12.2025;;209132;Atlas Werkstoffe GmbH;41000,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.5** — “ER901430;Rechnung;209133;Vega Technik GmbH;11.01.2026;22.12.2025;17000,00;EUR;Wartung Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.845** — “WE400843;22.12.2025;;209133;Vega Technik GmbH;17000,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.6** — “ER901431;Rechnung;209134;Orion Logistik GmbH;13.01.2026;25.12.2025;26000,00;EUR;Logistik Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.846** — “WE400844;25.12.2025;;209134;Orion Logistik GmbH;26000,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.7** — “ER901432;Rechnung;209135;Kronos Druck GmbH;13.01.2026;19.12.2025;14500,00;EUR;Druckleistung Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.847** — “WE400845;19.12.2025;;209135;Kronos Druck GmbH;14500,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.8** — “ER901433;Rechnung;209136;Prisma Chemie GmbH;14.01.2026;20.12.2025;20500,00;EUR;Rohstoffe 27.12.2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.848** — “WE400846;20.12.2025;;209136;Prisma Chemie GmbH;20500,00;Dez-Lieferung, Rechnung offen”
> **Fakturajournal_Januar_2026_Kreditoren.csv · Fakturajournal_Januar_2026_Kreditoren!r.9** — “ER901434;Rechnung;209137;Helios Systeme GmbH;06.01.2026;20.12.2025;13000,00;EUR;IT-Leistung Dez 2025”
> **Wareneingangsliste_2025.csv · Wareneingangsliste_2025!r.849** — “WE400847;20.12.2025;;209137;Helios Systeme GmbH;13000,00;Dez-Lieferung, Rechnung offen”

**Calculations:**
- Unaccrued prior-period cost: 8 next-period invoices = EUR 192,000.00

**Affected records (8):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 2025-12-21 | ER901427 | Nord Transport GmbH | EUR 22,000.00 net |
| 2025-12-26 | ER901428 | Delta Energie GmbH | EUR 38,000.00 net |
| 2025-12-22 | ER901429 | Atlas Werkstoffe GmbH | EUR 41,000.00 net |
| 2025-12-22 | ER901430 | Vega Technik GmbH | EUR 17,000.00 net |
| 2025-12-25 | ER901431 | Orion Logistik GmbH | EUR 26,000.00 net |
| 2025-12-19 | ER901432 | Kronos Druck GmbH | EUR 14,500.00 net |
| 2025-12-20 | ER901433 | Prisma Chemie GmbH | EUR 20,500.00 net |
| 2025-12-20 | ER901434 | Helios Systeme GmbH | EUR 13,000.00 net |

---

### Castor Papier GmbH: 4 same-day payments split below the EUR 10000 approval threshold

*threshold_avoidance · tier: corroborated · severity: high · amount: EUR 39,040.00*

4 general-ledger payments (BUCHUNGSTYP Zahlung) on 2025-10-14 to Castor Papier GmbH (200007) were each placed just below the second-approval threshold but total EUR 39040.00 under beleg SAMMEL-200007.

**Evidence:**
> **Pruefungsplanung_JET_2025.docx · l.1-15** — “Zahlungsfreigaben ab 10.000 EUR erfordern eine zweite Freigabe (Vier-Augen-Prinzip).”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20207** — “"330000-200007";"Periode 10";"";"Vortrag";"Zahlung";"Nein";"Nein";9780,00;"EUR";9780,00;"Teilzahlung Lieferantenrechnung";14.10.2025;"AZ6602865";14.10.2025;"SAMMEL-200007";"Aktuell";"";"";7708373;"SAMMEL-200007";"MV-U11";14.10.2025;"08:59:37";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20209** — “"330000-200007";"Periode 10";"";"Vortrag";"Zahlung";"Nein";"Nein";9820,00;"EUR";9820,00;"Teilzahlung Lieferantenrechnung";14.10.2025;"AZ6602866";14.10.2025;"SAMMEL-200007";"Aktuell";"";"";7708374;"SAMMEL-200007";"MV-U11";14.10.2025;"07:28:30";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20211** — “"330000-200007";"Periode 10";"";"Vortrag";"Zahlung";"Nein";"Nein";9750,00;"EUR";9750,00;"Teilzahlung Lieferantenrechnung";14.10.2025;"AZ6602867";14.10.2025;"SAMMEL-200007";"Aktuell";"";"";7708375;"SAMMEL-200007";"MV-U11";14.10.2025;"09:57:16";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20213** — “"330000-200007";"Periode 10";"";"Vortrag";"Zahlung";"Nein";"Nein";9690,00;"EUR";9690,00;"Teilzahlung Lieferantenrechnung";14.10.2025;"AZ6602868";14.10.2025;"SAMMEL-200007";"Aktuell";"";"";7708376;"SAMMEL-200007";"MV-U11";14.10.2025;"18:55:07";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2569** — “"200007";"SAMMEL-200007";14.10.2025;"";14.10.2025;"Teilzahlung Lieferantenrechnung";9780,00;"EUR";9780,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2570** — “"200007";"SAMMEL-200007";14.10.2025;"";14.10.2025;"Teilzahlung Lieferantenrechnung";9820,00;"EUR";9820,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2571** — “"200007";"SAMMEL-200007";14.10.2025;"";14.10.2025;"Teilzahlung Lieferantenrechnung";9750,00;"EUR";9750,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2572** — “"200007";"SAMMEL-200007";14.10.2025;"";14.10.2025;"Teilzahlung Lieferantenrechnung";9690,00;"EUR";9690,00;"";"";"Purch";"Yes"”

**Calculations:**
- Same-day aggregate: 9780.00 + 9820.00 + 9750.00 + 9690.00 = EUR 39,040.00

**Affected records (4):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 2025-10-14 | SAMMEL-200007 | Castor Papier GmbH | EUR 9,780.00 control |
| 2025-10-14 | SAMMEL-200007 | Castor Papier GmbH | EUR 9,820.00 control |
| 2025-10-14 | SAMMEL-200007 | Castor Papier GmbH | EUR 9,750.00 control |
| 2025-10-14 | SAMMEL-200007 | Castor Papier GmbH | EUR 9,690.00 control |

---

### Ratio Consulting GmbH: vendor creation and payments bypass segregation of duties

*vendor_control_breach · tier: corroborated · severity: high · amount: EUR 248,000.00*

Ratio Consulting GmbH (209101) was created and approved by MV-U05. The same user can book, create vendors, and run payments, posted both the invoices and payments, and the goods-receipt register contains no fulfillment for this vendor. The records support EUR 248000.00 of net expense and EUR 295120.00 of gross cash paid.

**Evidence:**
> **Stammdatenaenderungen_2025.csv · Stammdatenaenderungen_2025!r.8** — “12.05.2025;Kreditor;209101;Ratio Consulting GmbH;Neuanlage Kreditor;;angelegt inkl. Bankverbindung;MV-U05;MV-U05;Ja”
> **Berechtigungsauswertung_2025.xlsx · Berechtigungen!r.7** — “MV-U05 | Einkauf | X |  | X | X |  |  |  | ”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2553** — “"209101";"ER901416";19.05.2025;"";19.05.2025;"Beratungsleistungen lt. Rahmenvertrag";-53550,00;"EUR";-53550,00;"";"";"Purch";"Yes"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20162** — “"673000";"Periode 5";"";"Vortrag";"Kreditorenrechnung";"Nein";"Nein";45000,00;"EUR";45000,00;"Beratungsleistungen lt. Rahmenvertrag";19.05.2025;"ER901416";19.05.2025;"ER901416";"Aktuell";"";"";7708356;"ER901416";"MV-U05";19.05.2025;"18:25:18";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2555** — “"209101";"ER901417";04.07.2025;"";04.07.2025;"Beratungsleistungen lt. Rahmenvertrag";-71400,00;"EUR";-71400,00;"";"";"Purch";"Yes"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20167** — “"673000";"Periode 7";"";"Vortrag";"Kreditorenrechnung";"Nein";"Nein";60000,00;"EUR";60000,00;"Beratungsleistungen lt. Rahmenvertrag";04.07.2025;"ER901417";04.07.2025;"ER901417";"Aktuell";"";"";7708358;"ER901417";"MV-U05";04.07.2025;"07:12:20";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2557** — “"209101";"ER901418";15.09.2025;"";15.09.2025;"Beratungsleistungen lt. Rahmenvertrag";-45220,00;"EUR";-45220,00;"";"";"Purch";"Yes"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20172** — “"673000";"Periode 9";"";"Vortrag";"Kreditorenrechnung";"Nein";"Nein";38000,00;"EUR";38000,00;"Beratungsleistungen lt. Rahmenvertrag";15.09.2025;"ER901418";15.09.2025;"ER901418";"Aktuell";"";"";7708360;"ER901418";"MV-U05";15.09.2025;"07:05:53";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2559** — “"209101";"ER901419";10.11.2025;"";10.11.2025;"Beratungsleistungen lt. Rahmenvertrag";-61880,00;"EUR";-61880,00;"";"";"Purch";"Yes"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20177** — “"673000";"Periode 11";"";"Vortrag";"Kreditorenrechnung";"Nein";"Nein";52000,00;"EUR";52000,00;"Beratungsleistungen lt. Rahmenvertrag";10.11.2025;"ER901419";10.11.2025;"ER901419";"Aktuell";"";"";7708362;"ER901419";"MV-U05";10.11.2025;"13:11:16";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2561** — “"209101";"ER901420";18.12.2025;"";18.12.2025;"Beratungsleistungen lt. Rahmenvertrag";-63070,00;"EUR";-63070,00;"";"";"Purch";"Yes"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.20182** — “"673000";"Periode 12";"";"Vortrag";"Kreditorenrechnung";"Nein";"Nein";53000,00;"EUR";53000,00;"Beratungsleistungen lt. Rahmenvertrag";18.12.2025;"ER901420";18.12.2025;"ER901420";"Aktuell";"";"";7708364;"ER901420";"MV-U05";18.12.2025;"06:20:12";"Ja"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2554** — “"209101";"ER901416";21.05.2025;"";21.05.2025;"Zahlungsausgang Beratung";53550,00;"EUR";53550,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2556** — “"209101";"ER901417";06.07.2025;"";06.07.2025;"Zahlungsausgang Beratung";71400,00;"EUR";71400,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2558** — “"209101";"ER901418";17.09.2025;"";17.09.2025;"Zahlungsausgang Beratung";45220,00;"EUR";45220,00;"";"";"Purch";"Yes"”
> **Lieferantenbuchungen.txt · Lieferantenbuchungen!r.2560** — “"209101";"ER901419";12.11.2025;"";12.11.2025;"Zahlungsausgang Beratung";61880,00;"EUR";61880,00;"";"";"Purch";"Yes"”

**Calculations:**
- Net expense: 5 matched expense postings = EUR 248,000.00
- Gross cash paid: 5 matched outgoing payments = EUR 295,120.00

**Affected records (5):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 2025-05-19 | ER901416 | Ratio Consulting GmbH | EUR 45,000.00 net |
| 2025-07-04 | ER901417 | Ratio Consulting GmbH | EUR 60,000.00 net |
| 2025-09-15 | ER901418 | Ratio Consulting GmbH | EUR 38,000.00 net |
| 2025-11-10 | ER901419 | Ratio Consulting GmbH | EUR 52,000.00 net |
| 2025-12-18 | ER901420 | Ratio Consulting GmbH | EUR 53,000.00 net |

## Confirmed findings (0)

_none_

## Requires auditor judgment (0)

_none_

## Examined and acquitted (0)

Items that looked suspicious but have a documented innocent explanation — reported for transparency.

_none_
