import crypto from "node:crypto";
import { listSqliteTables, iterateSqliteTable, searchSqliteEvidence } from "./sqlite-store";
import { parseAmount } from "./normalize";
import type { AnalysisCoverage, Citation, EntityCluster, Finding, FindingLineItem, MoneyGraph } from "./types";
import type { StructuredRow } from "./structured-types";

interface ControlContext {
  dossier: string;
  fiscalPeriod: string;
  analysisRunId: string;
}

interface ControlSpec {
  id: string;
  pack: string;
  requiredTables: string[];
  run(context: ControlContext): Finding[];
}

export interface SqliteControlResult {
  findings: Finding[];
  coverage: AnalysisCoverage;
  entities: EntityCluster[];
  graph: MoneyGraph;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

function value(row: StructuredRow, ...keys: string[]): string {
  for (const key of keys) {
    const exact = row.values[key];
    if (exact != null && exact !== "") return exact;
    const normalized = key.toLowerCase().replaceAll("_", "");
    const hit = Object.entries(row.values).find(
      ([candidate]) => candidate.toLowerCase().replaceAll("_", "") === normalized,
    );
    if (hit?.[1]) return hit[1];
  }
  return "";
}

function rows(context: ControlContext, tableId: string): StructuredRow[] {
  const table = iterateSqliteTable(context.dossier, tableId);
  return table ? [...table.rows] : [];
}

function citation(row: StructuredRow): Citation {
  return row.citation;
}

function lineItem(
  key: string,
  row: StructuredRow,
  fields: Omit<FindingLineItem, "id" | "citations"> & { citations?: Citation[] },
): FindingLineItem {
  return {
    ...fields,
    id: stableId("li", `${key}|${row.citation.docId}|${row.citation.ref}`),
    citations: [row.citation, ...(fields.citations ?? [])],
  };
}

function finding(
  context: ControlContext,
  fields: Omit<Finding, "id" | "factIds" | "origin" | "analysisRunId" | "engineStatus" | "aiStatus"> & { key: string },
): Finding {
  const { key, ...rest } = fields;
  return {
    ...rest,
    id: stableId("finding", `${context.dossier}|${key}`),
    factIds: [],
    origin: "control",
    analysisRunId: context.analysisRunId,
    engineStatus: "detected",
    aiStatus: "needs-judgment",
  };
}

function billAndHold(context: ControlContext): Finding[] {
  const candidates = rows(context, "Fakturajournal_2025_erweitert").filter((row) => {
    const amount = parseAmount(value(row, "BETRAG_EUR")) ?? 0;
    const delivery = value(row, "WARENAUSGANG_NR", "WARENAUSGANG_DATUM");
    return amount > 0 && /bill[ -]?and[ -]?hold/i.test(row.raw) && !delivery;
  });
  if (!candidates.length) return [];
  const agreement = searchSqliteEvidence(context.dossier, "Bill Hold Vereinbarung Gefahrenübergang", undefined, 4)
    .hits.find((hit) => /bill|gefahren/i.test(hit.text));
  const agreementCitation = agreement
    ? { docId: agreement.docId, ref: agreement.ref, quote: agreement.text }
    : undefined;
  const key = "revenue:bill-and-hold";
  const items = candidates.map((row) =>
    lineItem(key, row, {
      label: value(row, "RECHNUNGSNUMMER") || "Bill-and-hold invoice",
      documentNumber: value(row, "RECHNUNGSNUMMER"),
      date: value(row, "FAKTURADATUM"),
      counterparty: value(row, "DEBITORNAME"),
      description: value(row, "BEMERKUNG", "LIEFERART") || "No dispatch reference recorded",
      amount: parseAmount(value(row, "BETRAG_EUR")) ?? 0,
      amountType: "net",
      citations: agreementCitation ? [agreementCitation] : [],
    }),
  );
  const total = cents(items.reduce((sum, item) => sum + item.amount, 0));
  return [
    finding(context, {
      key,
      checkId: "revenueBillAndHold",
      title: `${items.length} year-end bill-and-hold sale${items.length === 1 ? " lacks" : "s lack"} a dispatch reference`,
      tier: "judgment",
      fraudType: "revenue_recognition",
      narrative: `The sales journal records ${items.length} bill-and-hold invoice${items.length === 1 ? "" : "s"} totaling EUR ${total.toFixed(2)} without a goods-dispatch reference. The agreement and transfer-of-control evidence require auditor judgment before recognizing revenue.`,
      amountInvolved: total,
      severity: "high",
      citations: [...new Map(items.flatMap((item) => item.citations).map((item) => [`${item.docId}|${item.ref}`, item])).values()].slice(0, 16),
      lineItems: items,
      impactCategories: ["profit_overstatement"],
      calculations: [{ label: "Bill-and-hold revenue", expression: `${items.length} invoices`, value: total, currency: "EUR" }],
    }),
  ];
}

function subsequentPeriodCutoff(context: ControlContext): Finding[] {
  const candidates = rows(context, "Fakturajournal_Januar_2026").filter((row) => {
    const serviceDate = value(row, "LEISTUNGSDATUM");
    return serviceDate.endsWith(context.fiscalPeriod) && (parseAmount(value(row, "BETRAG_EUR")) ?? 0) > 0;
  });
  if (!candidates.length) return [];
  const key = "revenue:subsequent-period-cutoff";
  const items = candidates.map((row) =>
    lineItem(key, row, {
      label: value(row, "RECHNUNGSNUMMER") || "Subsequent-period invoice",
      documentNumber: value(row, "RECHNUNGSNUMMER"),
      date: value(row, "LEISTUNGSDATUM"),
      counterparty: value(row, "DEBITORNAME"),
      description: `Service date ${value(row, "LEISTUNGSDATUM")}; invoiced ${value(row, "FAKTURADATUM")}`,
      amount: parseAmount(value(row, "BETRAG_EUR")) ?? 0,
      amountType: "net",
    }),
  );
  const total = cents(items.reduce((sum, item) => sum + item.amount, 0));
  return [finding(context, {
    key,
    checkId: "revenueCutoff",
    title: `${items.length} prior-year sale${items.length === 1 ? "" : "s"} invoiced after year-end`,
    tier: "corroborated",
    fraudType: "cutoff_failure",
    narrative: `${items.length} January invoices totaling EUR ${total.toFixed(2)} carry ${context.fiscalPeriod} service dates and should be checked against the year-end revenue cut-off and dispatch evidence.`,
    amountInvolved: total,
    severity: "high",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["profit_overstatement"],
    calculations: [{ label: "Subsequent-period invoices", expression: `${items.length} invoices`, value: total, currency: "EUR" }],
  })];
}

function receivableImpairment(context: ControlContext): Finding[] {
  const candidates = rows(context, "Rechtsfaelle_Insolvenzen").filter((row) => {
    const exposure = Math.abs(parseAmount(value(row, "FORDERUNG_EUR")) ?? 0);
    return exposure > 0 && /insolvenz|verfahren|zahlungsunfähig|ausfall/i.test(row.raw);
  });
  if (!candidates.length) return [];
  const key = "receivables:legal-cases";
  const items = candidates.map((row) =>
    lineItem(key, row, {
      label: value(row, "DEBITOR") || "Debtor legal case",
      date: value(row, "DATUM"),
      counterparty: value(row, "DEBITORNAME"),
      description: `${value(row, "STATUS")} ${value(row, "BEMERKUNG")}`.trim(),
      amount: Math.abs(parseAmount(value(row, "FORDERUNG_EUR")) ?? 0),
      amountType: "net",
    }),
  );
  const total = cents(items.reduce((sum, item) => sum + item.amount, 0));
  return [finding(context, {
    key,
    checkId: "receivableImpairment",
    title: `${items.length} legal or insolvency exposure${items.length === 1 ? " requires" : "s require"} valuation review`,
    tier: "judgment",
    fraudType: "receivable_impairment",
    narrative: `The legal-case register identifies EUR ${total.toFixed(2)} of outstanding debtor exposure in insolvency or collection proceedings. Compare these items with open receivables and the year-end allowance calculation.`,
    amountInvolved: total,
    severity: "high",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["profit_overstatement", "asset_overstatement"],
    calculations: [{ label: "At-risk receivables", expression: `${items.length} legal cases`, value: total, currency: "EUR" }],
  })];
}

function debtorMasterData(context: ControlContext): Finding[] {
  const candidates = rows(context, "Stammdatenaenderungen_Debitoren_2025").filter((row) => {
    const changedBy = value(row, "GEAENDERT_VON");
    const approvedBy = value(row, "GENEHMIGT_VON");
    const approved = value(row, "GENEHMIGT");
    return (changedBy && approvedBy && changedBy === approvedBy) || (approved && !/^ja$/i.test(approved));
  });
  if (!candidates.length) return [];
  const key = "access:debtor-master-data";
  const items = candidates.map((row) =>
    lineItem(key, row, {
      label: `${value(row, "DEBITOR")} ${value(row, "FELD")}`.trim(),
      date: value(row, "DATUM"),
      counterparty: value(row, "DEBITORNAME"),
      description: `${value(row, "WERT_ALT")} → ${value(row, "WERT_NEU")} (${value(row, "GEAENDERT_VON")} / ${value(row, "GENEHMIGT_VON") || "not approved"})`,
      amount: 0,
      amountType: "control",
    }),
  );
  return [finding(context, {
    key,
    checkId: "debtorMasterData",
    title: `${items.length} debtor master-data change${items.length === 1 ? " lacks" : "s lack"} independent approval`,
    tier: "corroborated",
    fraudType: "master_data_control_breach",
    narrative: `${items.length} debtor changes were self-approved or not marked approved. The affected fields and downstream transactions require manual authorization review.`,
    amountInvolved: null,
    severity: "medium",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["control_breach"],
  })];
}

function journalChanges(context: ControlContext): Finding[] {
  const findings: Finding[] = [];

  const approvalBreaches = rows(context, "Freigabe-Log_Journale_2025").filter((row) => {
    const status = value(row, "FREIGABESTATUS");
    const creator = value(row, "ERSTELLER");
    const approver = value(row, "FREIGEBER");
    const selfApproved = Boolean(creator && approver && creator === approver);
    const postedWithoutApproval = /ohne freigabe|nicht freigegeben|offen|abgelehnt/i.test(status);
    const markedSelfApproved = /ersteller\s*=\s*freigeber/i.test(status);
    return selfApproved || postedWithoutApproval || markedSelfApproved || (status && !/^freigegeben$/i.test(status.trim()));
  });
  if (approvalBreaches.length) {
    const key = "access:journal-approval";
    const items = approvalBreaches.slice(0, 100).map((row) =>
      lineItem(key, row, {
        label: value(row, "ERFASSUNGSNUMMER", "JOURNALNAME") || "Journal approval",
        date: value(row, "FREIGABEDATUM", "ERFASST_AM"),
        description: `${value(row, "FREIGABESTATUS")} · ${value(row, "ERSTELLER")} / ${value(row, "FREIGEBER") || "no approver"} · EUR ${value(row, "SUMME_ABS_EUR")}`,
        amount: Math.abs(parseAmount(value(row, "SUMME_ABS_EUR")) ?? 0),
        amountType: "control",
      }),
    );
    const total = cents(items.reduce((sum, item) => sum + item.amount, 0));
    findings.push(finding(context, {
      key,
      checkId: "journalChangeControl",
      title: `${approvalBreaches.length} journal${approvalBreaches.length === 1 ? "" : "s"} posted without independent approval`,
      tier: "corroborated",
      fraudType: "journal_override",
      narrative: `The journal approval log contains ${approvalBreaches.length} entries that were self-approved or posted without a valid independent release. The cited sample covers EUR ${total.toFixed(2)} absolute journal movement and should be traced to authorization evidence.`,
      amountInvolved: total,
      severity: "high",
      citations: items.flatMap((item) => item.citations).slice(0, 16),
      lineItems: items,
      impactCategories: ["control_breach"],
      calculations: [{ label: "Approval-breach journals (sample)", expression: `${items.length} of ${approvalBreaches.length} journals`, value: total, currency: "EUR" }],
    }));
  }

  const changeCandidates = rows(context, "Aenderungsprotokoll_2025").filter((row) => {
    const fest = value(row, "FESTSCHREIBUNG_VOR_AENDERUNG").trim();
    const detail = `${value(row, "AENDERUNGSART")} ${value(row, "BEMERKUNG")} ${fest}`;
    const finalized = /^ja$/i.test(fest);
    const stornoOrRewrite = /storno|generalstorno|neubuchung|selbem journal|nachträglich|manuell|überschr/i.test(detail);
    return finalized || stornoOrRewrite;
  });
  if (changeCandidates.length) {
    const key = "access:journal-changes";
    const items = changeCandidates.slice(0, 100).map((row) =>
      lineItem(key, row, {
        label: value(row, "BUCHUNGSNUMMER") || "Journal change",
        date: value(row, "GEAENDERT_AM", "BUCHUNGSDATUM"),
        description: `${value(row, "AENDERUNGSART")} by ${value(row, "BENUTZER")}: ${value(row, "BEMERKUNG")} (${value(row, "FESTSCHREIBUNG_VOR_AENDERUNG").trim() || "no festschreibung flag"})`,
        amount: 0,
        amountType: "control",
      }),
    );
    findings.push(finding(context, {
      key,
      checkId: "journalChangeControl",
      title: `${changeCandidates.length} journal storno or rewrite event${changeCandidates.length === 1 ? "" : "s"} require authorization evidence`,
      tier: "judgment",
      fraudType: "journal_override",
      narrative: `The change log contains ${changeCandidates.length} storno, rewrite, or post-finalization events. Reconcile the cited sample to approval logs, original vouchers, and compensating entries.`,
      amountInvolved: null,
      severity: "medium",
      citations: items.flatMap((item) => item.citations).slice(0, 16),
      lineItems: items,
      impactCategories: ["control_breach"],
    }));
  }

  return findings;
}

function taxCompleteness(context: ControlContext): Finding[] {
  const taxRows = iterateSqliteTable(context.dossier, "Umsatzsteuerbuchungen");
  const ledgerRows = iterateSqliteTable(context.dossier, "Sachkontobuchungen");
  if (!taxRows || !ledgerRows) return [];
  // Ledger → VAT: tax references present on GL lines but missing from the VAT export.
  const unmatched = new Map<string, StructuredRow>();
  for (const row of ledgerRows.rows) {
    const reference = value(row, "STEUERBUCHUNGSREFERENZ");
    if (reference && !unmatched.has(reference)) unmatched.set(reference, row);
  }
  for (const row of taxRows.rows) {
    const reference = value(row, "STEUERBUCHUNGSREFERENZ");
    if (reference) unmatched.delete(reference);
  }
  const missing = unmatched.size;
  if (!missing) return [];
  const examples = [...unmatched.values()].slice(0, 50);
  const sampleTotal = cents(
    examples.reduce(
      (sum, row) => sum + Math.abs(parseAmount(value(row, "BUCHUNGSBETRAG", "BUCHUNGSWERT")) ?? 0),
      0,
    ),
  );
  const key = "tax:missing-postings";
  const items = examples.map((row) =>
    lineItem(key, row, {
      label: value(row, "STEUERBUCHUNGSREFERENZ"),
      documentNumber: value(row, "BELEGNUMMER", "DOKUMENT"),
      date: value(row, "BUCHUNGSDATUM"),
      description: `${value(row, "QUELLE")} ${value(row, "STEUERART")}`.trim(),
      amount: Math.abs(parseAmount(value(row, "BUCHUNGSBETRAG", "BUCHUNGSWERT")) ?? 0),
      amountType: "control",
    }),
  );
  return [finding(context, {
    key,
    checkId: "taxCompleteness",
    title: `${missing} ledger tax references are absent from the VAT posting export`,
    tier: "corroborated",
    fraudType: "tax_export_incompleteness",
    narrative: `${missing} general-ledger entries carry a tax reference that is absent from the VAT posting export. The cited sample represents EUR ${sampleTotal.toFixed(2)} of absolute ledger movement and requires export-completeness reconciliation.`,
    amountInvolved: sampleTotal,
    severity: "high",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["control_breach"],
    calculations: [{ label: "Unmatched ledger sample", expression: `${examples.length} of ${missing} unmatched references`, value: sampleTotal, currency: "EUR" }],
  })];
}

const CONTROLS: ControlSpec[] = [
  { id: "revenueBillAndHold", pack: "revenue-receivables", requiredTables: ["Fakturajournal_2025_erweitert"], run: billAndHold },
  { id: "revenueCutoff", pack: "revenue-receivables", requiredTables: ["Fakturajournal_Januar_2026"], run: subsequentPeriodCutoff },
  { id: "receivableImpairment", pack: "revenue-receivables", requiredTables: ["Rechtsfaelle_Insolvenzen"], run: receivableImpairment },
  { id: "debtorMasterData", pack: "access-journals", requiredTables: ["Stammdatenaenderungen_Debitoren_2025"], run: debtorMasterData },
  { id: "journalChangeControl", pack: "access-journals", requiredTables: ["Aenderungsprotokoll_2025", "Freigabe-Log_Journale_2025"], run: journalChanges },
  { id: "taxCompleteness", pack: "tax-completeness", requiredTables: ["Umsatzsteuerbuchungen", "Sachkontobuchungen"], run: taxCompleteness },
];

function sinkLabel(finding: Finding): string {
  switch (finding.checkId) {
    case "taxCompleteness":
      return "VAT export gap";
    case "journalChangeControl":
      return "Journal control breach";
    case "aiDiscovery":
      return finding.title.length > 42 ? `${finding.title.slice(0, 42)}…` : finding.title;
    default:
      return finding.fraudType?.replaceAll("_", " ") || finding.checkId || "Control gap";
  }
}

function graphFor(findings: Finding[], companyName: string): { entities: EntityCluster[]; graph: MoneyGraph } {
  const company: EntityCluster = {
    id: stableId("entity", companyName),
    names: [companyName],
    ibans: [],
    vatIds: [],
    addresses: [],
    factIds: [],
  };
  const partyTotals = new Map<string, { id: string; amount: number; findingIds: Set<string> }>();

  for (const finding of findings) {
    const named = (finding.lineItems ?? []).filter((line) => line.counterparty?.trim());
    if (named.length) {
      for (const line of named) {
        const name = line.counterparty!.trim();
        const existing = partyTotals.get(name) ?? {
          id: stableId("entity", name),
          amount: 0,
          findingIds: new Set<string>(),
        };
        existing.amount = cents(existing.amount + line.amount);
        existing.findingIds.add(finding.id);
        partyTotals.set(name, existing);
      }
      continue;
    }

    const amount =
      finding.amountInvolved ??
      (finding.lineItems ?? []).reduce((sum, line) => sum + (line.amount || 0), 0);
    const hasSignal =
      amount > 0 || (finding.lineItems?.length ?? 0) > 0 || finding.origin === "ai-assisted";
    if (!hasSignal) continue;

    const name = sinkLabel(finding);
    const existing = partyTotals.get(name) ?? {
      id: stableId("entity", `${finding.checkId}|${name}`),
      amount: 0,
      findingIds: new Set<string>(),
    };
    existing.amount = cents(existing.amount + (amount > 0 ? amount : Math.max(1, finding.lineItems?.length ?? 0)));
    existing.findingIds.add(finding.id);
    partyTotals.set(name, existing);
  }

  const counterparties: EntityCluster[] = [...partyTotals.entries()].map(([name, entry]) => ({
    id: entry.id,
    names: [name],
    ibans: [],
    vatIds: [],
    addresses: [],
    factIds: [],
  }));
  const entities = [company, ...counterparties];
  const edges = [...partyTotals.entries()].map(([, entry]) => ({
    from: company.id,
    to: entry.id,
    total: entry.amount,
    currency: "EUR",
    factIds: [] as string[],
    findingIds: [...entry.findingIds],
  }));
  return { entities, graph: { nodes: entities, edges, companyClusterId: company.id } };
}

export function runSqliteControlPacks(
  dossier: string,
  companyName: string,
  fiscalPeriod: string,
  analysisRunId: string,
  packs: string[],
): SqliteControlResult {
  const available = new Set(listSqliteTables(dossier).map((table) => table.id));
  const context = { dossier, fiscalPeriod, analysisRunId };
  const findings: Finding[] = [];
  const coverage: AnalysisCoverage = { executedControls: [], skippedControls: [] };
  if (packs.includes("core-integrity")) coverage.executedControls.push("core-integrity");
  for (const control of CONTROLS.filter((candidate) => packs.includes(candidate.pack))) {
    const missing = control.requiredTables.filter((table) => !available.has(table));
    if (missing.length) {
      coverage.skippedControls.push({ id: control.id, reason: `missing tables: ${missing.join(", ")}` });
      continue;
    }
    findings.push(...control.run(context));
    coverage.executedControls.push(control.id);
  }
  const { entities, graph } = graphFor(findings, companyName);
  return { findings, coverage, entities, graph };
}
