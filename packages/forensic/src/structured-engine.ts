import crypto from "node:crypto";
import { parseAmount } from "./normalize";
import { tableByName } from "./structured-ingest";
import type {
  Citation,
  DossierDoc,
  EntityCluster,
  Finding,
  FindingLineItem,
  MoneyGraph,
} from "./types";
import type { StructuredDataset, StructuredRow, StructuredTable } from "./structured-types";

const REPAIR_TERMS = /reparatur|instandsetzung|austausch|generalüberholung|generalueberholung|kälteanlage|kaelteanlage|repair|maintenance/i;

function stableId(prefix: string, value: string): string {
  return `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function isoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
}

function uniqueCitations(citations: Citation[], cap = 16): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.docId}|${citation.ref}|${citation.quote}`;
    if (seen.has(key) || seen.size >= cap) return false;
    seen.add(key);
    return true;
  });
}

function rowAmount(row: StructuredRow, key: string): number {
  return parseAmount(row.values[key]) ?? 0;
}

function vendorNames(dataset: StructuredDataset): Map<string, string> {
  return new Map(
    tableByName(dataset, "Lieferanten").rows.map((row) => [
      row.values.LIEFERANTENKONTONUMMER,
      row.values.LIEFERANTENNAME,
    ]),
  );
}

function lineItem(
  findingKey: string,
  row: StructuredRow,
  fields: Omit<FindingLineItem, "id" | "citations"> & { citations?: Citation[] },
): FindingLineItem {
  return {
    ...fields,
    id: stableId("li", `${findingKey}|${row.citation.docId}|${row.citation.ref}`),
    citations: uniqueCitations([row.citation, ...(fields.citations ?? [])], 6),
  };
}

function policyThreshold(docs: DossierDoc[]): { amount: number; citation: Citation } | null {
  const doc = docs.find((candidate) => candidate.relativePath?.endsWith("Pruefungsplanung_JET_2025.docx"));
  if (!doc) return null;
  for (const unit of doc.units) {
    const match = /(Zahlungsfreigaben ab\s+([\d.]+)\s+EUR[^.]*\.)/i.exec(unit.text);
    const amount = parseAmount(match?.[2]);
    if (match?.[1] && amount != null) {
      return { amount, citation: { docId: doc.id, ref: unit.ref, quote: match[1] } };
    }
  }
  return null;
}

function checkVendorControls(dataset: StructuredDataset): Finding[] {
  const masters = tableByName(dataset, "Stammdatenaenderungen_2025");
  const permissions = tableByName(dataset, "Berechtigungsauswertung_2025:Berechtigungen");
  const ap = tableByName(dataset, "Lieferantenbuchungen");
  const ledger = tableByName(dataset, "Sachkontobuchungen");
  const receipts = tableByName(dataset, "Wareneingangsliste_2025");
  const names = vendorNames(dataset);
  const findings: Finding[] = [];

  for (const change of masters.rows.filter(
    (row) => /Neuanlage Kreditor/i.test(row.values.FELD) && row.values.GEAENDERT_VON === row.values.GENEHMIGT_VON,
  )) {
    const vendorId = change.values.KONTO;
    const user = change.values.GEAENDERT_VON;
    const rights = permissions.rows.find((row) => row.values.Benutzer === user);
    const incompatibleRights = rights && ["Buchen", "Zahlungslauf", "Stammdaten/Kreditor anlegen"].every((key) => rights.values[key] === "X");
    const vendorRows = ap.rows.filter((row) => row.values.LIEFERANTENKONTONUMMER === vendorId);
    const invoices = vendorRows.filter((row) => rowAmount(row, "BUCHUNGSBETRAG") < 0 && !/Saldenvortrag/i.test(row.values.BUCHUNGSTEXT));
    const payments = vendorRows.filter((row) => rowAmount(row, "BUCHUNGSBETRAG") > 0 && /Zahlung/i.test(row.values.BUCHUNGSTEXT));
    const documentNumbers = new Set(invoices.map((row) => row.values.BUCHUNGSNUMMER));
    const relatedLedger = ledger.rows.filter(
      (row) => documentNumbers.has(row.values.BELEGNUMMER) || documentNumbers.has(row.values.DOKUMENT),
    );
    const sameUserPostedAndPaid = relatedLedger.length > 0 && relatedLedger.every((row) => row.values.BENUTZERKENNUNG === user);
    const hasReceipt = receipts.rows.some((row) => row.values.KREDITOR === vendorId);
    if (!incompatibleRights || !sameUserPostedAndPaid || hasReceipt || invoices.length === 0 || payments.length === 0) continue;

    const netByDocument = new Map<string, { amount: number; row: StructuredRow }>();
    for (const invoice of invoices) {
      const docNumber = invoice.values.BUCHUNGSNUMMER;
      const expenseRows = ledger.rows.filter(
        (row) =>
          row.values.BELEGNUMMER === docNumber &&
          rowAmount(row, "BUCHUNGSBETRAG") > 0 &&
          !/^147000/.test(row.values.SACHKONTONUMMER) &&
          !/^330000/.test(row.values.SACHKONTONUMMER),
      );
      const amount = expenseRows.reduce((sum, row) => sum + rowAmount(row, "BUCHUNGSBETRAG"), 0);
      if (amount > 0) netByDocument.set(docNumber, { amount, row: expenseRows[0] ?? invoice });
    }
    const findingKey = `vendor-control|${vendorId}`;
    const vendorName = names.get(vendorId) ?? change.values.NAME ?? vendorId;
    const items = invoices.map((invoice) => {
      const documentNumber = invoice.values.BUCHUNGSNUMMER;
      const net = netByDocument.get(documentNumber);
      return lineItem(findingKey, invoice, {
        label: documentNumber,
        documentNumber,
        date: isoDate(invoice.values.BUCHUNGSDATUM),
        counterparty: vendorName,
        description: invoice.values.BUCHUNGSTEXT,
        amount: net?.amount ?? Math.abs(rowAmount(invoice, "BUCHUNGSBETRAG")),
        amountType: "net",
        citations: net ? [net.row.citation] : [],
      });
    });
    const net = items.reduce((sum, item) => sum + item.amount, 0);
    const grossCash = payments.reduce((sum, row) => sum + rowAmount(row, "BUCHUNGSBETRAG"), 0);
    const citations = uniqueCitations([
      change.citation,
      ...(rights ? [rights.citation] : []),
      ...items.flatMap((item) => item.citations),
      ...payments.map((row) => row.citation),
    ]);
    findings.push({
      id: stableId("finding", findingKey),
      checkId: "vendorControls",
      title: `${vendorName}: vendor creation and payments bypass segregation of duties`,
      tier: "corroborated",
      fraudType: "vendor_control_breach",
      narrative:
        `${vendorName} (${vendorId}) was created and approved by ${user}. The same user can book, create vendors, and run payments, ` +
        `posted both the invoices and payments, and the goods-receipt register contains no fulfillment for this vendor. ` +
        `The records support EUR ${net.toFixed(2)} of net expense and EUR ${grossCash.toFixed(2)} of gross cash paid.`,
      amountInvolved: net,
      severity: "high",
      factIds: [],
      citations,
      lineItems: items,
      impactCategories: ["cash_misappropriation"],
      calculations: [
        { label: "Net expense", expression: `${items.length} matched expense postings`, value: net, currency: "EUR" },
        { label: "Gross cash paid", expression: `${payments.length} matched outgoing payments`, value: grossCash, currency: "EUR" },
      ],
      engineStatus: "detected",
      aiStatus: "not-run",
    });
  }
  return findings;
}

function checkCapitalizedRepairs(dataset: StructuredDataset): Finding[] {
  const assets = tableByName(dataset, "Anlagen");
  const postings = tableByName(dataset, "Anlagenbuchungen");
  const ap = tableByName(dataset, "Lieferantenbuchungen");
  const names = vendorNames(dataset);
  const suspicious = assets.rows
    .filter((row) => REPAIR_TERMS.test(row.values.ANLAGENBEZEICHNUNG))
    .map((asset) => {
      const posting = postings.rows.find(
        (row) => row.values.ANLAGENNUMMER === asset.values.ANLAGENNUMMER && /Acquisition/i.test(row.values.BUCHUNGSART),
      );
      if (!posting) return null;
      const documentNumber = posting.values.BELEGNUMMER;
      const vendorPosting = ap.rows.find(
        (row) => row.values.BUCHUNGSNUMMER === documentNumber && rowAmount(row, "BUCHUNGSBETRAG") < 0,
      );
      const vendorId = vendorPosting?.values.LIEFERANTENKONTONUMMER;
      return { asset, posting, vendorPosting, vendorName: vendorId ? names.get(vendorId) : undefined };
    })
    .filter(Boolean) as Array<{
      asset: StructuredRow;
      posting: StructuredRow;
      vendorPosting?: StructuredRow;
      vendorName?: string;
    }>;
  if (!suspicious.length) return [];
  const findingKey = "capitalized-repairs";
  const items = suspicious.map(({ asset, posting, vendorPosting, vendorName }) =>
    lineItem(findingKey, posting, {
      label: asset.values.ANLAGENBEZEICHNUNG,
      documentNumber: posting.values.BELEGNUMMER,
      date: isoDate(posting.values.WERTSTELLUNG),
      counterparty: vendorName,
      description: `${asset.values.ANLAGENNUMMER} booked to asset class ${asset.values.ANLAGENGRUPPE}`,
      amount: rowAmount(posting, "BUCHUNGSBETRAG"),
      amountType: "net",
      citations: [asset.citation, ...(vendorPosting ? [vendorPosting.citation] : [])],
    }),
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return [{
    id: stableId("finding", findingKey),
    checkId: "capitalizedRepairs",
    title: `${items.length} repair and maintenance costs capitalized as fixed assets`,
    tier: "corroborated",
    fraudType: "capitalized_repairs",
    narrative: `${items.length} asset additions carry repair-type descriptions and were posted as acquisitions to fixed-asset classes. Their EUR ${total.toFixed(2)} net cost overstates both assets and profit.`,
    amountInvolved: total,
    severity: "high",
    factIds: [],
    citations: uniqueCitations(items.flatMap((item) => item.citations)),
    lineItems: items,
    impactCategories: ["profit_overstatement", "asset_overstatement"],
    calculations: [{ label: "Capitalized repair cost", expression: `${items.length} asset acquisitions`, value: total, currency: "EUR" }],
    engineStatus: "detected",
    aiStatus: "not-run",
  }];
}

function checkCutoff(dataset: StructuredDataset): Finding[] {
  const journal = tableByName(dataset, "Fakturajournal_Januar_2026_Kreditoren");
  const receipts = tableByName(dataset, "Wareneingangsliste_2025");
  const ledger = tableByName(dataset, "Sachkontobuchungen");
  const fiscalYear = Number(dataset.fiscalPeriod);
  const candidates = journal.rows
    .map((invoice) => {
      const serviceDate = isoDate(invoice.values.LEISTUNGSDATUM);
      const invoiceDate = isoDate(invoice.values.FAKTURADATUM);
      const amount = rowAmount(invoice, "BETRAG_EUR");
      if (!serviceDate?.startsWith(`${fiscalYear}-`) || !invoiceDate?.startsWith(`${fiscalYear + 1}-`)) return null;
      const receipt = receipts.rows.find(
        (row) =>
          row.values.KREDITOR === invoice.values.KREDITOR &&
          Math.abs(rowAmount(row, "BETRAG_EUR") - amount) < 0.01 &&
          isoDate(row.values.WARENEINGANG_DATUM) === serviceDate &&
          /Rechnung offen/i.test(row.values.BEMERKUNG),
      );
      const postedInYear = ledger.rows.some(
        (row) =>
          [row.values.BELEGNUMMER, row.values.DOKUMENT].includes(invoice.values.RECHNUNGSNUMMER) &&
          isoDate(row.values.BUCHUNGSDATUM)?.startsWith(`${fiscalYear}-`),
      );
      return receipt && !postedInYear ? { invoice, receipt, amount, serviceDate } : null;
    })
    .filter(Boolean) as Array<{ invoice: StructuredRow; receipt: StructuredRow; amount: number; serviceDate: string }>;
  if (!candidates.length) return [];
  const findingKey = "cutoff-next-period";
  const items = candidates.map(({ invoice, receipt, amount, serviceDate }) =>
    lineItem(findingKey, invoice, {
      label: invoice.values.BEMERKUNG,
      documentNumber: invoice.values.RECHNUNGSNUMMER,
      date: serviceDate,
      counterparty: invoice.values.KREDITORNAME,
      description: `Service/goods received ${serviceDate}; invoice dated ${isoDate(invoice.values.FAKTURADATUM)}`,
      amount,
      amountType: "net",
      citations: [receipt.citation],
    }),
  );
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return [{
    id: stableId("finding", findingKey),
    checkId: "cutoff",
    title: `${items.length} December costs omitted from the 2025 close`,
    tier: "corroborated",
    fraudType: "cutoff_failure",
    narrative: `${items.length} invoices booked in ${fiscalYear + 1} have ${fiscalYear} service dates and matching December receipts marked as still open. No matching ${fiscalYear} posting exists, leaving EUR ${total.toFixed(2)} unaccrued and overstating profit.`,
    amountInvolved: total,
    severity: "high",
    factIds: [],
    citations: uniqueCitations(items.flatMap((item) => item.citations)),
    lineItems: items,
    impactCategories: ["profit_overstatement"],
    calculations: [{ label: "Unaccrued prior-period cost", expression: `${items.length} next-period invoices`, value: total, currency: "EUR" }],
    engineStatus: "detected",
    aiStatus: "not-run",
  }];
}

function checkSplitPayments(dataset: StructuredDataset, docs: DossierDoc[]): Finding[] {
  const policy = policyThreshold(docs);
  if (!policy) return [];
  const ap = tableByName(dataset, "Lieferantenbuchungen");
  const names = vendorNames(dataset);
  const groups = new Map<string, StructuredRow[]>();
  for (const row of ap.rows) {
    const amount = rowAmount(row, "BUCHUNGSBETRAG");
    if (amount <= 0 || !/Zahlung|Teilzahlung/i.test(row.values.BUCHUNGSTEXT)) continue;
    const key = [row.values.LIEFERANTENKONTONUMMER, row.values.BUCHUNGSDATUM, row.values.BUCHUNGSNUMMER].join("|");
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  const findings: Finding[] = [];
  for (const [key, rows] of groups) {
    const amounts = rows.map((row) => rowAmount(row, "BUCHUNGSBETRAG"));
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    if (rows.length < 2 || total < policy.amount || !amounts.every((amount) => amount < policy.amount && amount >= policy.amount * 0.94)) continue;
    const [vendorId, rawDate, documentNumber] = key.split("|");
    const vendorName = names.get(vendorId!) ?? vendorId!;
    const findingKey = `split-payments|${key}`;
    const items = rows.map((row, index) =>
      lineItem(findingKey, row, {
        label: `Payment ${index + 1}`,
        documentNumber,
        date: isoDate(rawDate),
        counterparty: vendorName,
        description: row.values.BUCHUNGSTEXT,
        amount: rowAmount(row, "BUCHUNGSBETRAG"),
        amountType: "control",
        citations: [policy.citation],
      }),
    );
    findings.push({
      id: stableId("finding", findingKey),
      checkId: "splitPayments",
      title: `${vendorName}: ${rows.length} same-day payments split below the EUR ${policy.amount.toFixed(0)} approval threshold`,
      tier: "corroborated",
      fraudType: "threshold_avoidance",
      narrative: `${rows.length} payments on ${isoDate(rawDate)} were each placed just below the second-approval threshold but total EUR ${total.toFixed(2)}.`,
      amountInvolved: total,
      severity: "high",
      factIds: [],
      citations: uniqueCitations([policy.citation, ...rows.map((row) => row.citation)]),
      lineItems: items,
      impactCategories: ["control_breach"],
      calculations: [{ label: "Same-day aggregate", expression: amounts.map((amount) => amount.toFixed(2)).join(" + "), value: total, currency: "EUR" }],
      engineStatus: "detected",
      aiStatus: "not-run",
    });
  }
  return findings;
}

function buildRiskGraph(findings: Finding[], companyName: string): { entities: EntityCluster[]; graph: MoneyGraph } {
  const companyId = stableId("entity", companyName);
  const entityMap = new Map<string, EntityCluster>();
  entityMap.set(companyId, { id: companyId, names: [companyName], ibans: [], vatIds: [], addresses: [], factIds: [] });
  const edgeMap = new Map<string, MoneyGraph["edges"][number]>();
  for (const finding of findings) {
    const counterparties = new Map<string, number>();
    for (const item of finding.lineItems ?? []) {
      if (!item.counterparty) continue;
      counterparties.set(item.counterparty, (counterparties.get(item.counterparty) ?? 0) + item.amount);
    }
    for (const [counterparty, total] of counterparties) {
      const entityId = stableId("entity", counterparty);
      if (!entityMap.has(entityId)) entityMap.set(entityId, { id: entityId, names: [counterparty], ibans: [], vatIds: [], addresses: [], factIds: [] });
      const key = `${companyId}|${entityId}`;
      const edge = edgeMap.get(key) ?? { from: companyId, to: entityId, total: 0, currency: "EUR", factIds: [], findingIds: [] };
      edge.total += total;
      if (!edge.findingIds.includes(finding.id)) edge.findingIds.push(finding.id);
      edgeMap.set(key, edge);
    }
  }
  return {
    entities: [...entityMap.values()],
    graph: { nodes: [...entityMap.values()], edges: [...edgeMap.values()], companyClusterId: companyId },
  };
}

function reportedProfit(docs: DossierDoc[]): number | null {
  const doc = docs.find((candidate) => candidate.relativePath?.endsWith("JA-Entwurf_2025_Auszug_Bilanz_GuV.pdf"));
  const text = doc?.units.map((unit) => unit.text).join("\n") ?? "";
  const match = /Jahresüberschuss \(Entwurf\)\s+([\d.,]+)/i.exec(text);
  return parseAmount(match?.[1]);
}

export function runStructuredEngine(dataset: StructuredDataset, docs: DossierDoc[]) {
  const findings = [
    ...checkVendorControls(dataset),
    ...checkCapitalizedRepairs(dataset),
    ...checkCutoff(dataset),
    ...checkSplitPayments(dataset, docs),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));
  const { entities, graph } = buildRiskGraph(findings, dataset.companyName);
  const profit = reportedProfit(docs);
  const profitOverstatement = findings
    .filter((finding) => finding.impactCategories?.includes("profit_overstatement"))
    .reduce((sum, finding) => sum + (finding.amountInvolved ?? 0), 0);
  return {
    findings,
    entities,
    graph,
    reportedProfit: profit,
    adjustedProfit: profit == null ? null : profit - profitOverstatement,
  };
}
