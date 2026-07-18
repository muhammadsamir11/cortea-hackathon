# Forensic Findings — dossier “beispiel-daemmstoffe”

Generated 2026-07-18T17:24:45.508Z · model: gpt-5

**Method.** Structured accounting records were parsed deterministically; every affected record carries
a source row, sheet, or page reference (0/0 records verified).
Optional AI review is kept separate from engine detection. **No number without a source.**

**Source integrity:** passed (24/24 checks).

## Detected — pending independent review (10)

### 1 year-end bill-and-hold sale lacks a dispatch reference

*revenue_recognition · tier: judgment · severity: high · amount: EUR 124,455.97*

The sales journal records 1 bill-and-hold invoice totaling EUR 124455.97 without a goods-dispatch reference. The agreement and transfer-of-control evidence require auditor judgment before recognizing revenue.

**Evidence:**
> **Fakturajournal_2025_erweitert.csv · Fakturajournal_2025_erweitert!r.21553** — “SI10073455;Rechnung;801677;SOLID ELEKTRO GMBH;C-DOM;31.12.2025;31.12.2025;;;Bill-and-Hold;124455,97;EUR;;;Bill-and-Hold-Vereinbarung vom 15.12.2025, Einlagerung Konsignationslager Werk Musterstadt, Gefahrenübergang mit Bereitstellungsanzeige”

**Calculations:**
- Bill-and-hold revenue: 1 invoices = EUR 124,455.97

**Affected records (1):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 31.12.2025 | SI10073455 | SOLID ELEKTRO GMBH | EUR 124,455.97 net |

---

### 34 prior-year sales invoiced after year-end

*cutoff_failure · tier: corroborated · severity: high · amount: EUR 175,563.41*

34 January invoices totaling EUR 175563.41 carry 2025 service dates and should be checked against the year-end revenue cut-off and dispatch evidence.

**Evidence:**
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.4** — “SI10074171;Rechnung;800768;SILVAGERÜSTBAU GMBH;02.01.2026;31.12.2025;6059,86;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.8** — “SI10074344;Rechnung;801015;TAUNUS BETON GMBH;02.01.2026;31.12.2025;968,93;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.9** — “SI10074363;Rechnung;802989;FLINT MONTAGEBAU;02.01.2026;31.12.2025;2866,03;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.11** — “SI10074550;Rechnung;802007;VULKAN TECHNIK;02.01.2026;31.12.2025;4669,79;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.12** — “SI10074670;Rechnung;803085;ARGUSPROFILE GMBH;02.01.2026;30.12.2025;2555,67;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.13** — “SI10074703;Rechnung;801199;PRISMA VERPACKUNG GMBH & CO. KG;02.01.2026;30.12.2025;6291,33;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.17** — “SI10074871;Rechnung;802328;NORDANLAGENBAU;02.01.2026;30.12.2025;6168,46;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.18** — “SI10074991;Rechnung;801839;MAIN FOLIEN GMBH;02.01.2026;20.12.2025;6441,90;EUR;Leistung Dezember 2025, in 2025 als unfakturierte Lieferung abgegrenzt (Konto 260000)”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.19** — “SI10075032;Rechnung;800004;SÜD PANEELE KG;02.01.2026;31.12.2025;3007,22;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.20** — “SI10075038;Rechnung;802532;WESTWERKZEUGE GMBH & CO. KG;02.01.2026;31.12.2025;9242,31;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.21** — “SI10075205;Rechnung;802106;WESER GEBÄUDETECHNIK GMBH;02.01.2026;31.12.2025;11798,74;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.23** — “SI10075311;Rechnung;800186;KORUND ELEKTRO GMBH;02.01.2026;31.12.2025;2123,35;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.32** — “SI10075686;Rechnung;801900;CERESELEKTRO;02.01.2026;30.12.2025;6692,15;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.34** — “SI10075994;Rechnung;800160;ATLAS SYSTEME GMBH;02.01.2026;31.12.2025;4518,39;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.35** — “SI10076076;Rechnung;802171;;02.01.2026;30.12.2025;5424,15;EUR;”
> **Fakturajournal_Januar_2026.csv · Fakturajournal_Januar_2026!r.38** — “SI10076172;Rechnung;802011;KOMPAKTBAUSTOFFE GMBH;02.01.2026;30.12.2025;4111,67;EUR;”

**Calculations:**
- Subsequent-period invoices: 34 invoices = EUR 175,563.41

**Affected records (34):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 31.12.2025 | SI10074171 | SILVAGERÜSTBAU GMBH | EUR 6,059.86 net |
| 31.12.2025 | SI10074344 | TAUNUS BETON GMBH | EUR 968.93 net |
| 31.12.2025 | SI10074363 | FLINT MONTAGEBAU | EUR 2,866.03 net |
| 31.12.2025 | SI10074550 | VULKAN TECHNIK | EUR 4,669.79 net |
| 30.12.2025 | SI10074670 | ARGUSPROFILE GMBH | EUR 2,555.67 net |
| 30.12.2025 | SI10074703 | PRISMA VERPACKUNG GMBH & CO. KG | EUR 6,291.33 net |
| 30.12.2025 | SI10074871 | NORDANLAGENBAU | EUR 6,168.46 net |
| 20.12.2025 | SI10074991 | MAIN FOLIEN GMBH | EUR 6,441.90 net |
| 31.12.2025 | SI10075032 | SÜD PANEELE KG | EUR 3,007.22 net |
| 31.12.2025 | SI10075038 | WESTWERKZEUGE GMBH & CO. KG | EUR 9,242.31 net |
| 31.12.2025 | SI10075205 | WESER GEBÄUDETECHNIK GMBH | EUR 11,798.74 net |
| 31.12.2025 | SI10075311 | KORUND ELEKTRO GMBH | EUR 2,123.35 net |
| 30.12.2025 | SI10075686 | CERESELEKTRO | EUR 6,692.15 net |
| 31.12.2025 | SI10075994 | ATLAS SYSTEME GMBH | EUR 4,518.39 net |
| 30.12.2025 | SI10076076 |  | EUR 5,424.15 net |
| 30.12.2025 | SI10076172 | KOMPAKTBAUSTOFFE GMBH | EUR 4,111.67 net |
| 30.12.2025 | SI10076320 | BASALTVERPACKUNG GMBH | EUR 3,183.98 net |
| 23.12.2025 | SI10074075 | GNEIS BAUELEMENTE GMBH | EUR 3,571.30 net |
| 31.12.2025 | SI10074377 | POLARIS GEBÄUDETECHNIK GMBH & CO. KG | EUR 8,549.59 net |
| 31.12.2025 | SI10074829 | CERESMASCHINEN GMBH | EUR 2,385.93 net |
| 31.12.2025 | SI10075640 | VULKAN CHEMIE | EUR 3,277.38 net |
| 31.12.2025 | SI10076041 | SÜD TRANSPORT GMBH | EUR 2,218.79 net |
| 31.12.2025 | SI10076094 | WEST GERÜSTBAU SA | EUR 10,071.36 net |
| 31.12.2025 | SI10076279 | ORIONHANDEL AG | EUR 6,315.47 net |
| 22.12.2025 | SI10074815 | ARGUSBAUSTOFFE GMBH & CO. KG | EUR 16,511.82 net |
| 26.12.2025 | SI10075176 | CERESMASCHINEN GMBH | EUR 6,826.23 net |
| 26.12.2025 | SI10074260 | KOMPAKT LOGISTIK GMBH | EUR 2,816.91 net |
| 23.12.2025 | SI10075693 | RHEINPROFILE GMBH | EUR 2,820.79 net |
| 28.12.2025 | SI10075359 | VULKAN TECHNIK | EUR 3,416.77 net |
| 29.12.2025 | SI10074448 | NOVAELEKTRO | EUR 3,650.38 net |
| 31.12.2025 | SI10076050 | MAIN TECHNIK | EUR 9,009.52 net |
| 25.12.2025 | SI10075529 | BOREALISBAU KG | EUR 1,651.82 net |
| 30.12.2025 | SI10074633 |  | EUR 3,318.36 net |
| 31.12.2025 | SI10075869 | HANSE TROCKENBAU | EUR 3,027.06 net |

---

### 1 debtor master-data change lacks independent approval

*master_data_control_breach · tier: corroborated · severity: medium*

1 debtor changes were self-approved or not marked approved. The affected fields and downstream transactions require manual authorization review.

**Evidence:**
> **Stammdatenaenderungen_Debitoren_2025.csv · Stammdatenaenderungen_Debitoren_2025!r.51** — “17.11.2025;800291;ALPEN TECHNIK;Bankverbindung;DE44500105175407324931;DE41700202700010843421;BSP-U08;;Nein”

**Affected records (1):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 17.11.2025 | — | ALPEN TECHNIK | EUR 0.00 control |

---

### 19 journals posted without independent approval

*journal_override · tier: corroborated · severity: high · amount: EUR 10,804,422.78*

The journal approval log contains 19 entries that were self-approved or posted without a valid independent release. The cited sample covers EUR 10804422.78 absolute journal movement and should be traced to authorization evidence.

**Evidence:**
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.133** — “5640393178;GL-393178;2;44,02;BSP-U02;03.02.2025;16:21:39;BSP-U02;03.02.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.150** — “5640393262;GL-393262;2;50,60;BSP-U02;03.02.2025;15:59:35;BSP-U02;03.02.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.300** — “5640455391;GL-455391;2;10076,38;BSP-U11;03.03.2025;09:26:56;BSP-U11;03.03.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.359** — “5640474595;GL-474595;2;95,72;BSP-U02;03.03.2025;09:13:47;BSP-U02;03.03.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.712** — “5640615992;GL-615992;2;73,00;BSP-U02;07.04.2025;11:55:26;BSP-U02;07.04.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1144** — “5640875549;GL-875549;2;47,66;BSP-U02;06.06.2025;17:58:39;BSP-U02;06.06.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1156** — “5640912249;GL-912249;2;74960,00;BSP-U10;09.06.2025;07:27:24;;;GEBUCHT OHNE FREIGABE”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1281** — “5640996802;GL-996802;136;48826,92;BSP-U10;03.07.2025;13:51:27;;;GEBUCHT OHNE FREIGABE”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1442** — “5641134798;GL-134798;2;116,28;BSP-U02;01.08.2025;14:43:19;BSP-U02;01.08.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1501** — “5641134840;GL-134840;2;191,26;BSP-U02;04.08.2025;13:40:11;BSP-U02;04.08.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.1956** — “5641359668;GL-359668;2;78,80;BSP-U02;03.10.2025;09:15:00;BSP-U02;03.10.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.2729** — “5641531863;GL-531863;2;9,40;BSP-U11;08.12.2025;14:13:46;;;GEBUCHT OHNE FREIGABE”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.2771** — “5641554383;GL-554383;2;275812,74;BSP-U11;12.12.2025;08:55:51;BSP-U11;12.12.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.2957** — “5641588319;GL-588319;2;40,00;BSP-U02;05.01.2026;12:42:19;BSP-U02;05.01.2026;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.3113** — “5640560001;GL-560001;2;1094600,00;BSP-U02;31.03.2025;10:42:17;BSP-U02;31.03.2025;Freigegeben (Ersteller=Freigeber)”
> **Freigabe-Log_Journale_2025.csv · Freigabe-Log_Journale_2025!r.3114** — “5640955001;GL-955001;2;1123700,00;BSP-U02;30.06.2025;11:15:03;BSP-U02;30.06.2025;Freigegeben (Ersteller=Freigeber)”

**Calculations:**
- Approval-breach journals (sample): 19 of 19 journals = EUR 10,804,422.78

**Affected records (19):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 03.02.2025 | — | 5640393178 | EUR 44.02 control |
| 03.02.2025 | — | 5640393262 | EUR 50.60 control |
| 03.03.2025 | — | 5640455391 | EUR 10,076.38 control |
| 03.03.2025 | — | 5640474595 | EUR 95.72 control |
| 07.04.2025 | — | 5640615992 | EUR 73.00 control |
| 06.06.2025 | — | 5640875549 | EUR 47.66 control |
| 09.06.2025 | — | 5640912249 | EUR 74,960.00 control |
| 03.07.2025 | — | 5640996802 | EUR 48,826.92 control |
| 01.08.2025 | — | 5641134798 | EUR 116.28 control |
| 04.08.2025 | — | 5641134840 | EUR 191.26 control |
| 03.10.2025 | — | 5641359668 | EUR 78.80 control |
| 08.12.2025 | — | 5641531863 | EUR 9.40 control |
| 12.12.2025 | — | 5641554383 | EUR 275,812.74 control |
| 05.01.2026 | — | 5641588319 | EUR 40.00 control |
| 31.03.2025 | — | 5640560001 | EUR 1,094,600.00 control |
| 30.06.2025 | — | 5640955001 | EUR 1,123,700.00 control |
| 30.09.2025 | — | 5641320001 | EUR 1,099,400.00 control |
| 29.12.2025 | — | 5641565001 | EUR 1,076,300.00 control |
| 30.12.2025 | — | 5641596001 | EUR 6,000,000.00 control |

---

### 4722 journal storno or rewrite events require authorization evidence

*journal_override · tier: judgment · severity: medium*

The change log contains 4722 storno, rewrite, or post-finalization events. Reconcile the cited sample to approval logs, original vouchers, and compensating entries.

**Evidence:**
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.2** — “5657382325;448020-XGGKTOP20 020-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.3** — “5657382331;448020-XGSFPLUS30 100-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.4** — “5657382339;448020-XGSFPRM30 120-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.5** — “5657382343;448020-XGSFPRM30 180-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.6** — “5657382373;448020-XGSFTOP50 040-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.7** — “5657382377;448020-XGSFTOP50 080-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.8** — “5657382387;448020-XGSFTOP70 050-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.9** — “5657382393;448020-XPGKPLUS 180-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.10** — “5657382421;448020-XPGKTOPTB 180-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.11** — “5657382423;448020-XPGKTOPTB 200-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.12** — “5657382336;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.13** — “5657382338;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.14** — “5657382396;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.15** — “5657382374;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.16** — “5657382638;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”
> **Aenderungsprotokoll_2025.csv · Aenderungsprotokoll_2025!r.17** — “5657382426;440020-BSP-802445----10--;30.01.2025;Stornobuchung (Generalstorno);BSP-U10;03.02.2025;07:24:55;Ursprungsbeleg storniert; Neubuchung im selben Journal;Ja”

**Affected records (100):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 03.02.2025 | — | 5657382325 | EUR 0.00 control |
| 03.02.2025 | — | 5657382331 | EUR 0.00 control |
| 03.02.2025 | — | 5657382339 | EUR 0.00 control |
| 03.02.2025 | — | 5657382343 | EUR 0.00 control |
| 03.02.2025 | — | 5657382373 | EUR 0.00 control |
| 03.02.2025 | — | 5657382377 | EUR 0.00 control |
| 03.02.2025 | — | 5657382387 | EUR 0.00 control |
| 03.02.2025 | — | 5657382393 | EUR 0.00 control |
| 03.02.2025 | — | 5657382421 | EUR 0.00 control |
| 03.02.2025 | — | 5657382423 | EUR 0.00 control |
| 03.02.2025 | — | 5657382336 | EUR 0.00 control |
| 03.02.2025 | — | 5657382338 | EUR 0.00 control |
| 03.02.2025 | — | 5657382396 | EUR 0.00 control |
| 03.02.2025 | — | 5657382374 | EUR 0.00 control |
| 03.02.2025 | — | 5657382638 | EUR 0.00 control |
| 03.02.2025 | — | 5657382426 | EUR 0.00 control |
| 03.02.2025 | — | 5657382392 | EUR 0.00 control |
| 03.02.2025 | — | 5657382628 | EUR 0.00 control |
| 03.02.2025 | — | 5657382634 | EUR 0.00 control |
| 03.02.2025 | — | 5657382328 | EUR 0.00 control |
| 03.02.2025 | — | 5657382346 | EUR 0.00 control |
| 03.02.2025 | — | 5657382630 | EUR 0.00 control |
| 03.02.2025 | — | 5657382650 | EUR 0.00 control |
| 03.02.2025 | — | 5657382372 | EUR 0.00 control |
| 03.02.2025 | — | 5657382394 | EUR 0.00 control |
| 03.02.2025 | — | 5657382400 | EUR 0.00 control |
| 03.02.2025 | — | 5657382388 | EUR 0.00 control |
| 03.02.2025 | — | 5657382652 | EUR 0.00 control |
| 03.02.2025 | — | 5657382376 | EUR 0.00 control |
| 03.02.2025 | — | 5657382646 | EUR 0.00 control |
| 03.02.2025 | — | 5657382648 | EUR 0.00 control |
| 03.02.2025 | — | 5657382644 | EUR 0.00 control |
| 03.02.2025 | — | 5657382642 | EUR 0.00 control |
| 03.02.2025 | — | 5657382640 | EUR 0.00 control |
| 03.02.2025 | — | 5657382340 | EUR 0.00 control |
| 03.02.2025 | — | 5657382398 | EUR 0.00 control |
| 03.02.2025 | — | 5657382330 | EUR 0.00 control |
| 03.02.2025 | — | 5657382342 | EUR 0.00 control |
| 03.02.2025 | — | 5657382636 | EUR 0.00 control |
| 03.02.2025 | — | 5657382332 | EUR 0.00 control |
| 03.02.2025 | — | 5657382344 | EUR 0.00 control |
| 03.02.2025 | — | 5657382390 | EUR 0.00 control |
| 03.02.2025 | — | 5657382422 | EUR 0.00 control |
| 03.02.2025 | — | 5657382632 | EUR 0.00 control |
| 03.02.2025 | — | 5657382326 | EUR 0.00 control |
| 03.02.2025 | — | 5657382378 | EUR 0.00 control |
| 03.02.2025 | — | 5657382348 | EUR 0.00 control |
| 03.02.2025 | — | 5657382424 | EUR 0.00 control |
| 03.02.2025 | — | 5657382386 | EUR 0.00 control |
| 03.02.2025 | — | 5657382368 | EUR 0.00 control |
| 03.02.2025 | — | 5657382370 | EUR 0.00 control |
| 03.02.2025 | — | 5657382334 | EUR 0.00 control |
| 03.02.2025 | — | 5657382420 | EUR 0.00 control |
| 03.02.2025 | — | 5657382350 | EUR 0.00 control |
| 03.02.2025 | — | 5657382384 | EUR 0.00 control |
| 03.02.2025 | — | 5657382352 | EUR 0.00 control |
| 03.02.2025 | — | 5657382402 | EUR 0.00 control |
| 03.02.2025 | — | 5657382380 | EUR 0.00 control |
| 03.02.2025 | — | 5657382418 | EUR 0.00 control |
| 03.02.2025 | — | 5657382404 | EUR 0.00 control |
| 03.02.2025 | — | 5657382406 | EUR 0.00 control |
| 03.02.2025 | — | 5657382366 | EUR 0.00 control |
| 03.02.2025 | — | 5657382408 | EUR 0.00 control |
| 03.02.2025 | — | 5657382412 | EUR 0.00 control |
| 03.02.2025 | — | 5657382354 | EUR 0.00 control |
| 03.02.2025 | — | 5657382410 | EUR 0.00 control |
| 03.02.2025 | — | 5657382356 | EUR 0.00 control |
| 03.02.2025 | — | 5657382362 | EUR 0.00 control |
| 03.02.2025 | — | 5657382382 | EUR 0.00 control |
| 03.02.2025 | — | 5657382414 | EUR 0.00 control |
| 03.02.2025 | — | 5657382364 | EUR 0.00 control |
| 03.02.2025 | — | 5657382416 | EUR 0.00 control |
| 03.02.2025 | — | 5657382358 | EUR 0.00 control |
| 03.02.2025 | — | 5657382360 | EUR 0.00 control |
| 03.02.2025 | — | 5657382327 | EUR 0.00 control |
| 03.02.2025 | — | 5657382329 | EUR 0.00 control |
| 03.02.2025 | — | 5657382333 | EUR 0.00 control |
| 03.02.2025 | — | 5657382335 | EUR 0.00 control |
| 03.02.2025 | — | 5657382337 | EUR 0.00 control |
| 03.02.2025 | — | 5657382341 | EUR 0.00 control |
| 03.02.2025 | — | 5657382345 | EUR 0.00 control |
| 03.02.2025 | — | 5657382347 | EUR 0.00 control |
| 03.02.2025 | — | 5657382349 | EUR 0.00 control |
| 03.02.2025 | — | 5657382351 | EUR 0.00 control |
| 03.02.2025 | — | 5657382353 | EUR 0.00 control |
| 03.02.2025 | — | 5657382355 | EUR 0.00 control |
| 03.02.2025 | — | 5657382357 | EUR 0.00 control |
| 03.02.2025 | — | 5657382359 | EUR 0.00 control |
| 03.02.2025 | — | 5657382361 | EUR 0.00 control |
| 03.02.2025 | — | 5657382363 | EUR 0.00 control |
| 03.02.2025 | — | 5657382365 | EUR 0.00 control |
| 03.02.2025 | — | 5657382367 | EUR 0.00 control |
| 03.02.2025 | — | 5657382369 | EUR 0.00 control |
| 03.02.2025 | — | 5657382371 | EUR 0.00 control |
| 03.02.2025 | — | 5657382375 | EUR 0.00 control |
| 03.02.2025 | — | 5657382379 | EUR 0.00 control |
| 03.02.2025 | — | 5657382381 | EUR 0.00 control |
| 03.02.2025 | — | 5657382383 | EUR 0.00 control |
| 03.02.2025 | — | 5657382385 | EUR 0.00 control |
| 03.02.2025 | — | 5657382389 | EUR 0.00 control |

---

### 973098 ledger tax references are absent from the VAT posting export

*tax_export_incompleteness · tier: corroborated · severity: high · amount: EUR 127,744,995.86*

973098 general-ledger entries carry a tax reference that is absent from the VAT posting export. The cited sample represents EUR 127744995.86 of absolute ledger movement and requires export-completeness reconciliation.

**Evidence:**
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.1** — “"331000------";"Periode 0";"5658091121";"Vortrag";"";"Nein";"Ja";-39547,37;"EUR";-39547,37;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.2** — “"110000------";"Periode 0";"5658091122";"Vortrag";"";"Nein";"Nein";1325793,98;"EUR";1325793,98;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.3** — “"140000------";"Periode 0";"5658091123";"Vortrag";"";"Nein";"Nein";273831,54;"EUR";273831,54;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.4** — “"170000-----TRADE-10";"Periode 0";"5658091124";"Vortrag";"";"Nein";"Ja";-133978,23;"EUR";-133978,23;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.5** — “"173000-----TRADE-10";"Periode 0";"5658091125";"Vortrag";"";"Nein";"Ja";-6008164,24;"EUR";-6008164,24;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.6** — “"110000-----XPS-10";"Periode 0";"5658091126";"Vortrag";"";"Nein";"Ja";-21872,64;"EUR";-21872,64;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.7** — “"110100-----XPS-10";"Periode 0";"5658091127";"Vortrag";"";"Nein";"Ja";-92883,70;"EUR";-92883,70;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.8** — “"110200-----XPS-10";"Periode 0";"5658091128";"Vortrag";"";"Nein";"Nein";16854,13;"EUR";16854,13;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.9** — “"110700-----XPS-10";"Periode 0";"5658091129";"Vortrag";"";"Nein";"Nein";9863,92;"EUR";9863,92;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.10** — “"160000-----XPS-10";"Periode 0";"5658091130";"Vortrag";"";"Nein";"Ja";-2226264,13;"EUR";-2226264,13;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.11** — “"160100-----XPS-10";"Periode 0";"5658091131";"Vortrag";"";"Nein";"Ja";-444129,24;"EUR";-444129,24;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.12** — “"150000-----XPS-10";"Periode 0";"5658091132";"Vortrag";"";"Nein";"Nein";10844,35;"EUR";10844,35;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.13** — “"150100-----XPS-10";"Periode 0";"5658091133";"Vortrag";"";"Nein";"Ja";-1644,68;"EUR";-1644,68;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.14** — “"110200------";"Periode 0";"5658091134";"Vortrag";"";"Nein";"Nein";73123,45;"EUR";73123,45;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.15** — “"110100------";"Periode 0";"5658091135";"Vortrag";"";"Nein";"Nein";549582,89;"EUR";549582,89;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.16** — “"169009-----XPS-10";"Periode 0";"5658091136";"Vortrag";"";"Nein";"Nein";1088,51;"EUR";1088,51;"";01.01.2025;"AB-2024";;"";"Aktuell";"";"";5640465185;"";"BSP-U02";12.01.2025;"20:10:40";"Ja"”

**Calculations:**
- Unmatched ledger sample: 50 of 973098 unmatched references = EUR 127,744,995.86

**Affected records (50):**

| Date | Document | Counterparty / item | Amount |
|---|---|---|---:|
| 01.01.2025 |  | 5658091121 | EUR 39,547.37 control |
| 01.01.2025 |  | 5658091122 | EUR 1,325,793.98 control |
| 01.01.2025 |  | 5658091123 | EUR 273,831.54 control |
| 01.01.2025 |  | 5658091124 | EUR 133,978.23 control |
| 01.01.2025 |  | 5658091125 | EUR 6,008,164.24 control |
| 01.01.2025 |  | 5658091126 | EUR 21,872.64 control |
| 01.01.2025 |  | 5658091127 | EUR 92,883.70 control |
| 01.01.2025 |  | 5658091128 | EUR 16,854.13 control |
| 01.01.2025 |  | 5658091129 | EUR 9,863.92 control |
| 01.01.2025 |  | 5658091130 | EUR 2,226,264.13 control |
| 01.01.2025 |  | 5658091131 | EUR 444,129.24 control |
| 01.01.2025 |  | 5658091132 | EUR 10,844.35 control |
| 01.01.2025 |  | 5658091133 | EUR 1,644.68 control |
| 01.01.2025 |  | 5658091134 | EUR 73,123.45 control |
| 01.01.2025 |  | 5658091135 | EUR 549,582.89 control |
| 01.01.2025 |  | 5658091136 | EUR 1,088.51 control |
| 01.01.2025 |  | 5658091137 | EUR 4,114.30 control |
| 01.01.2025 |  | 5658091138 | EUR 181.89 control |
| 01.01.2025 |  | 5658091139 | EUR 187.63 control |
| 01.01.2025 |  | 5658091140 | EUR 9,995.54 control |
| 01.01.2025 |  | 5658091141 | EUR 32,445.00 control |
| 01.01.2025 |  | 5658091142 | EUR 32,445.00 control |
| 01.01.2025 |  | 5658091143 | EUR 9,988,983.31 control |
| 01.01.2025 |  | 5658091144 | EUR 1,007,195.61 control |
| 01.01.2025 |  | 5658091145 | EUR 431,789.94 control |
| 01.01.2025 |  | 5658091146 | EUR 10,602,482.53 control |
| 01.01.2025 |  | 5658091147 | EUR 49,886.91 control |
| 01.01.2025 |  | 5658091148 | EUR 28,315,831.61 control |
| 01.01.2025 |  | 5658091149 | EUR 133,431.64 control |
| 01.01.2025 |  | 5658091150 | EUR 6,385,767.49 control |
| 01.01.2025 |  | 5658091151 | EUR 773,938.40 control |
| 01.01.2025 |  | 5658091152 | EUR 101,378.10 control |
| 01.01.2025 |  | 5658091153 | EUR 330,974.78 control |
| 01.01.2025 |  | 5658091154 | EUR 7,006.23 control |
| 01.01.2025 |  | 5658091155 | EUR 784,610.60 control |
| 01.01.2025 |  | 5658091156 | EUR 146,619.58 control |
| 01.01.2025 |  | 5658091157 | EUR 121,144.18 control |
| 01.01.2025 |  | 5658091158 | EUR 339,462.73 control |
| 01.01.2025 |  | 5658091159 | EUR 28,263,892.30 control |
| 01.01.2025 |  | 5658091160 | EUR 10,153,508.01 control |
| 01.01.2025 |  | 5658091161 | EUR 574,103.59 control |
| 01.01.2025 |  | 5658091162 | EUR 67,359.29 control |
| 01.01.2025 |  | 5658091163 | EUR 10,449,587.70 control |
| 01.01.2025 |  | 5658091164 | EUR 447.34 control |
| 01.01.2025 |  | 5658091165 | EUR 159,243.23 control |
| 01.01.2025 |  | 5658091166 | EUR 41,833.66 control |
| 01.01.2025 |  | 5658091167 | EUR 207,459.06 control |
| 01.01.2025 |  | 5658091168 | EUR 5,514,822.36 control |
| 01.01.2025 |  | 5658091169 | EUR 1,426,357.46 control |
| 01.01.2025 |  | 5658091170 | EUR 57,041.86 control |

---

### Unbooked allowance on overdue receivables due to internal threshold

*impairment/allowance · tier: judgment · severity: low · amount: EUR 11,084.94*

Management calculated a PWB of EUR 11,084.94 on overdue third‑party receivables but did not record it because it falls below an internal non‑posting threshold. Given the size of short‑overdue balances, this policy choice could understate impairment if not GAAP‑compliant or if aggregated with other unbooked items. Audit focus: assess the appropriateness of the non‑posting threshold, compare to accounting policy/GAAP, and consider posting an adjustment or aggregation across periods/entities.

**Evidence:**
> **Abstimmung_Nebenbuecher_HB_2025.xlsx · Wertberichtigungen!r.1-7** — “Überfällige debitorische offene Posten 1-30 Tage | 1,082,625.70 | laut OP-Liste Debitoren, Altersstruktur”
> **Abstimmung_Nebenbuecher_HB_2025.xlsx · Wertberichtigungen!r.4** — “Überfällige debitorische offene Posten 31-60 Tage | 25,868.40 | ”
> **Abstimmung_Nebenbuecher_HB_2025.xlsx · Wertberichtigungen!r.7** — “Pauschalwertberichtigung (PWB) gebildet - HB 239000 | - | Rechnerischer PWB 1 % auf überfällige Forderungen Dritte: 11.084,94 EUR; unterhalb Nichtaufgriffsgrenze JET (50.000 EUR); nicht gebucht”

---

### Sales to customers exceeding credit limits without evidence of override approval

*credit limit breach · tier: judgment · severity: medium · amount: EUR 110,197.23*

Multiple customers show outstanding balances above their limits, flagged as “ÜBERSCHRITTEN.” This elevates collectability risk and may indicate limit overrides without documented approval or insurance coverage testing. Audit focus: obtain credit‑limit override/insurance approvals for the cited accounts, assess subsequent receipts, and consider specific ECL/EWB where warranted.

**Evidence:**
> **Kreditlimitliste_Debitoren_2025.csv · Kreditlimitliste_Debitoren_2025!r.31** — “800159;HANSEBAUSTOFFE GMBH;25000,00;63972,15;ÜBERSCHRITTEN;Warenkreditversicherung”
> **Kreditlimitliste_Debitoren_2025.csv · Kreditlimitliste_Debitoren_2025!r.137** — “801684;PYRIT INDUSTRIEBAU;15000,00;15415,33;ÜBERSCHRITTEN;Warenkreditversicherung”
> **Kreditlimitliste_Debitoren_2025.csv · Kreditlimitliste_Debitoren_2025!r.56** — “800238;TERRA SYSTEME;20000,00;20257,83;ÜBERSCHRITTEN;internes Limit”
> **Kreditlimitliste_Debitoren_2025.csv · Kreditlimitliste_Debitoren_2025!r.59** — “800247;KIESEL AKUSTIKBAU;10000,00;10551,92;ÜBERSCHRITTEN;internes Limit”

---

### Related‑party cash‑pooling with parent and static intercompany payable require reconciliation and disclosure

*related-party · tier: judgment · severity: medium · amount: EUR 2,197,000.00*

Significant cash‑pool movements with the parent are posted during 2025 while the payable to the group holding remains unchanged at EUR 1,500,000 from prior year. This indicates material related‑party balances/transactions requiring confirmation, agreement review (including interest), and disclosure assessment, as well as reconciliation between cash‑pool postings and recorded IC balances.

**Evidence:**
> **Gesellschafterliste_Beteiligungen.csv · Gesellschafterliste_Beteiligungen!r.3** — “Beispiel Holding GmbH, Wien (AUT);100,00;IC;Muttergesellschaft;mittelbar oberste Konzernmutter: Beispiel Industrie Beteiligungs GmbH, Wien”
> **Saldenliste_2024_Vorjahr.xlsx · Saldenliste 31.12.2024!r.76** — “370600 | Sonstige Verbindlichkeiten Konzern Holding | Bilanz | (1,500,000.00)”
> **Saldenliste_2025_mit_Ueberleitung.xlsx · Saldenliste 2025!r.98** — “370600 | Sonstige Verbindlichkeiten Konzern Holding | Bilanz | (1,500,000.00) | - | - | ”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.1083715** — “"274000------";"Periode 3";"5664400011";"Vortrag";"Erstellte Journale";"Nein";"Ja";-547300,00;"EUR";-547300,00;"Verrechnung Cash-Pooling Beispiel Holding GmbH";31.03.2025;"GJ000341";;"";"Aktuell";"";"";5640560001;"";"BSP-U02";31.03.2025;"10:42:17";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.1083717** — “"274000------";"Periode 6";"5664400013";"Vortrag";"Erstellte Journale";"Nein";"Ja";-561850,00;"EUR";-561850,00;"Verrechnung Cash-Pooling Beispiel Holding GmbH";30.06.2025;"GJ000687";;"";"Aktuell";"";"";5640955001;"";"BSP-U02";30.06.2025;"11:15:03";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.1083719** — “"274000------";"Periode 9";"5664400015";"Vortrag";"Erstellte Journale";"Nein";"Ja";-549700,00;"EUR";-549700,00;"Verrechnung Cash-Pooling Beispiel Holding GmbH";30.09.2025;"GJ001034";;"";"Aktuell";"";"";5641320001;"";"BSP-U02";30.09.2025;"09:58:41";"Ja"”
> **Sachkontobuchungen.txt · Sachkontobuchungen!r.1083721** — “"274000------";"Periode 12";"5664400017";"Vortrag";"Erstellte Journale";"Nein";"Ja";-538150,00;"EUR";-538150,00;"Verrechnung Cash-Pooling Beispiel Holding GmbH";29.12.2025;"GJ001358";;"";"Aktuell";"";"";5641565001;"";"BSP-U02";29.12.2025;"14:21:36";"Ja"”

---

### Large customer credit balances (kreditorische Debitoren) present classification/offsetting risk

*classification/presentation · tier: judgment · severity: high · amount: EUR 2,787,461.44*

Customer accounts show material credit balances aggregated in HB 332000 of EUR 2,787,461.44. Such balances can represent prepayments, unapplied cash, or credit notes and should be evaluated for proper liability classification, aging, and offsetting against receivables. Audit focus: obtain detail of the credit‑balance population, test underlying causes (advances, returns, CNs), and assess reclassification and disclosure.

**Evidence:**
> **Abstimmung_Nebenbuecher_HB_2025.xlsx · Abstimmung!r.14** — “HB 332000 Kreditorische Debitoren Dritte | (2,787,461.44) | entspricht Summe kreditorischer Debitorensalden: keine Differenz”
> **Kontenplan-Mapping.csv · Kontenplan-Mapping!r.851** — “332000------;332000;Kreditorische Debitoren Dritte;3”
> **Sachkonten.txt · Sachkonten!r.1043** — “"332000";"Kreditorische Debitoren Dritte";"Bilanz";"Nein";"";"Optional";"Bilanz"”

## Confirmed findings (0)

_none_

## Requires auditor judgment (0)

_none_

## Examined and acquitted (0)

Items that looked suspicious but have a documented innocent explanation — reported for transparency.

_none_
