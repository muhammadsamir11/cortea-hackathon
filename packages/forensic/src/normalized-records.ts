import { parseAmount } from "./normalize";
import { tableByName } from "./structured-ingest";
import type { Citation, DossierDoc } from "./types";
import type { StructuredDataset, StructuredRow } from "./structured-types";

export interface VerifiedRecord {
  source: Citation;
  raw: string;
}

export interface LedgerEntry extends VerifiedRecord {
  accountNumber: string;
  signedAmount: number;
  currency: string;
  postingDate?: string;
  documentDate?: string;
  documentNumber: string;
  description: string;
  userId?: string;
}

export interface PartyRecord extends VerifiedRecord {
  kind: "vendor" | "customer";
  accountNumber: string;
  name: string;
  vatId?: string;
}

export interface SubledgerPosting extends VerifiedRecord {
  kind: "vendor" | "customer";
  accountNumber: string;
  signedAmount: number;
  postingDate?: string;
  documentNumber: string;
  description: string;
}

export interface AssetRecord extends VerifiedRecord {
  assetNumber: string;
  name: string;
  assetClass: string;
}

export interface AssetPosting extends VerifiedRecord {
  assetNumber: string;
  signedAmount: number;
  valueDate?: string;
  documentNumber: string;
  postingType: string;
}

export interface GoodsMovement extends VerifiedRecord {
  direction: "in" | "out";
  date?: string;
  accountNumber?: string;
  amount: number;
  documentNumber?: string;
  status?: string;
}

export interface InvoiceRecord extends VerifiedRecord {
  vendorAccountNumber?: string;
  vendorName?: string;
  invoiceNumber: string;
  netAmount: number;
  invoiceDate?: string;
  serviceDate?: string;
}

export interface AccessGrant extends VerifiedRecord {
  userId: string;
  permissions: string[];
}

export interface MasterDataChange extends VerifiedRecord {
  accountNumber: string;
  field: string;
  changedBy: string;
  approvedBy: string;
}

export interface JournalApproval extends VerifiedRecord {
  documentNumber: string;
  postedBy?: string;
  approvedBy?: string;
}

export interface PolicyTerm extends VerifiedRecord {
  kind: "payment_approval_threshold";
  amount: number;
  currency: string;
  text: string;
}

export interface NormalizedAccountingRecords {
  ledger: LedgerEntry[];
  parties: PartyRecord[];
  subledger: SubledgerPosting[];
  assets: AssetRecord[];
  assetPostings: AssetPosting[];
  goodsMovements: GoodsMovement[];
  invoices: InvoiceRecord[];
  accessGrants: AccessGrant[];
  masterDataChanges: MasterDataChange[];
  journalApprovals: JournalApproval[];
  policyTerms: PolicyTerm[];
}

function isoDate(value: string | undefined): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value?.trim() ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value || undefined;
}

function base(row: StructuredRow): VerifiedRecord {
  return { source: row.citation, raw: row.raw };
}

/** Deterministic, typed accounting view. It is derived only from row-citable source records. */
export function normalizeAccountingRecords(dataset: StructuredDataset, docs: DossierDoc[] = []): NormalizedAccountingRecords {
  const ledger = tableByName(dataset, "Sachkontobuchungen").rows.map((row): LedgerEntry => ({
    ...base(row),
    accountNumber: row.values.SACHKONTONUMMER,
    signedAmount: parseAmount(row.values.BUCHUNGSBETRAG) ?? 0,
    currency: row.values.BUCHUNGSWÄHRUNG || "EUR",
    postingDate: isoDate(row.values.BUCHUNGSDATUM),
    documentDate: isoDate(row.values.BELEGDATUM),
    documentNumber: row.values.BELEGNUMMER || row.values.DOKUMENT || row.values.BUCHUNGSNUMMER,
    description: row.values.BUCHUNGSTEXT,
    userId: row.values.BENUTZERKENNUNG,
  }));

  const partyTable = (id: "Lieferanten" | "Kunden", kind: PartyRecord["kind"], number: string, name: string, vat: string) =>
    tableByName(dataset, id).rows.map((row): PartyRecord => ({
      ...base(row), kind, accountNumber: row.values[number], name: row.values[name], vatId: row.values[vat] || undefined,
    }));
  const postingTable = (id: "Lieferantenbuchungen" | "Kundenbuchungen", kind: SubledgerPosting["kind"], account: string) =>
    tableByName(dataset, id).rows.map((row): SubledgerPosting => ({
      ...base(row), kind, accountNumber: row.values[account], signedAmount: parseAmount(row.values.BUCHUNGSBETRAG) ?? 0,
      postingDate: isoDate(row.values.BUCHUNGSDATUM), documentNumber: row.values.BUCHUNGSNUMMER, description: row.values.BUCHUNGSTEXT,
    }));

  const goodsMovements = ([
    ["Wareneingangsliste_2025", "in"],
    ["Warenausgangsliste_2025", "out"],
  ] as const).flatMap(([id, direction]) => tableByName(dataset, id).rows.map((row): GoodsMovement => ({
    ...base(row), direction,
    date: isoDate(row.values.WARENEINGANG_DATUM || row.values.WARENAUSGANG_DATUM),
    accountNumber: row.values.KREDITOR || row.values.DEBITOR || undefined,
    amount: parseAmount(row.values.BETRAG_EUR) ?? 0,
    documentNumber: row.values.BELEGNUMMER || row.values.RECHNUNGSNUMMER || undefined,
    status: row.values.BEMERKUNG || undefined,
  })));

  const policyTerms = docs.flatMap((doc): PolicyTerm[] => doc.units.flatMap((unit) => {
    const match = /Zahlungsfreigaben ab\s+([\d.]+)\s+(EUR)/i.exec(unit.text);
    const amount = parseAmount(match?.[1]);
    return match && amount != null ? [{ source: { docId: doc.id, ref: unit.ref, quote: match[0] }, raw: unit.text, kind: "payment_approval_threshold", amount, currency: match[2]!.toUpperCase(), text: match[0] }] : [];
  }));

  return {
    ledger,
    parties: [
      ...partyTable("Lieferanten", "vendor", "LIEFERANTENKONTONUMMER", "LIEFERANTENNAME", "UMSATZSTEUERIDENTIFIKATIONSNUMMER"),
      ...partyTable("Kunden", "customer", "KUNDENKONTONUMMER", "KUNDENNAME", "UMSATZSTEUERIDENTIFIKATIONSNUMMER"),
    ],
    subledger: [
      ...postingTable("Lieferantenbuchungen", "vendor", "LIEFERANTENKONTONUMMER"),
      ...postingTable("Kundenbuchungen", "customer", "KUNDENKONTONUMMER"),
    ],
    assets: tableByName(dataset, "Anlagen").rows.map((row) => ({ ...base(row), assetNumber: row.values.ANLAGENNUMMER, name: row.values.ANLAGENBEZEICHNUNG, assetClass: row.values.ANLAGENGRUPPE })),
    assetPostings: tableByName(dataset, "Anlagenbuchungen").rows.map((row) => ({ ...base(row), assetNumber: row.values.ANLAGENNUMMER, signedAmount: parseAmount(row.values.BUCHUNGSBETRAG) ?? 0, valueDate: isoDate(row.values.WERTSTELLUNG), documentNumber: row.values.BELEGNUMMER, postingType: row.values.BUCHUNGSART })),
    goodsMovements,
    invoices: tableByName(dataset, "Fakturajournal_Januar_2026_Kreditoren").rows.map((row) => ({ ...base(row), vendorAccountNumber: row.values.KREDITOR, vendorName: row.values.KREDITORNAME, invoiceNumber: row.values.RECHNUNGSNUMMER, netAmount: parseAmount(row.values.BETRAG_EUR) ?? 0, invoiceDate: isoDate(row.values.FAKTURADATUM), serviceDate: isoDate(row.values.LEISTUNGSDATUM) })),
    accessGrants: tableByName(dataset, "Berechtigungsauswertung_2025:Berechtigungen").rows.map((row) => ({ ...base(row), userId: row.values.Benutzer, permissions: Object.entries(row.values).filter(([key, value]) => key !== "Benutzer" && value === "X").map(([key]) => key) })),
    masterDataChanges: tableByName(dataset, "Stammdatenaenderungen_2025").rows.map((row) => ({ ...base(row), accountNumber: row.values.KONTO, field: row.values.FELD, changedBy: row.values.GEAENDERT_VON, approvedBy: row.values.GENEHMIGT_VON })),
    journalApprovals: tableByName(dataset, "Freigabe-Log_Journale_2025").rows.map((row) => ({ ...base(row), documentNumber: row.values.BELEGNUMMER || row.values.DOKUMENT || row.values.BUCHUNGSNUMMER, postedBy: row.values.ERFASST_VON || row.values.GEBUCHT_VON, approvedBy: row.values.GENEHMIGT_VON || row.values.FREIGEGEBEN_VON })),
    policyTerms,
  };
}
