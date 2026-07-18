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
  const candidates = rows(context, "Aenderungsprotokoll_2025").filter((row) => {
    const fixed = /^ja$/i.test(value(row, "FESTSCHREIBUNG_VOR_AENDERUNG"));
    return fixed && /direkt|änderung|nachträglich|manuell|überschr/i.test(`${value(row, "AENDERUNGSART")} ${value(row, "BEMERKUNG")}`);
  });
  if (!candidates.length) return [];
  const key = "access:journal-changes";
  const items = candidates.slice(0, 100).map((row) =>
    lineItem(key, row, {
      label: value(row, "BUCHUNGSNUMMER") || "Journal change",
      date: value(row, "GEAENDERT_AM", "BUCHUNGSDATUM"),
      description: `${value(row, "AENDERUNGSART")} by ${value(row, "BENUTZER")}: ${value(row, "BEMERKUNG")}`,
      amount: 0,
      amountType: "control",
    }),
  );
  return [finding(context, {
    key,
    checkId: "journalChangeControl",
    title: `${candidates.length} changes to finalized journal entries require authorization evidence`,
    tier: "judgment",
    fraudType: "journal_override",
    narrative: `The change log contains ${candidates.length} direct or retrospective changes where the original entry was already finalized. The cited sample should be reconciled to approval logs and reversal entries.`,
    amountInvolved: null,
    severity: "medium",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["control_breach"],
  })];
}

function taxCompleteness(context: ControlContext): Finding[] {
  const taxRows = iterateSqliteTable(context.dossier, "Umsatzsteuerbuchungen");
  const ledgerRows = iterateSqliteTable(context.dossier, "Sachkontobuchungen");
  if (!taxRows || !ledgerRows) return [];
  const unmatched = new Map<string, StructuredRow>();
  for (const row of taxRows.rows) {
    const reference = value(row, "STEUERBUCHUNGSREFERENZ");
    if (reference && !unmatched.has(reference)) unmatched.set(reference, row);
  }
  for (const row of ledgerRows.rows) {
    const reference = value(row, "STEUERBUCHUNGSREFERENZ");
    if (reference) unmatched.delete(reference);
  }
  const missing = unmatched.size;
  if (!missing) return [];
  const examples = [...unmatched.values()].slice(0, 50);
  const total = cents(
    [...unmatched.values()].reduce(
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
      amount: Math.abs(parseAmount(value(row, "BUCHUNGSBETRAG")) ?? 0),
      amountType: "control",
    }),
  );
  return [finding(context, {
    key,
    checkId: "taxCompleteness",
    title: `${missing} VAT posting references are absent from the general ledger export`,
    tier: "corroborated",
    fraudType: "tax_export_incompleteness",
    narrative: `${missing} VAT-export entries carry a tax reference that is absent from the general-ledger export. The cited sample represents EUR ${total.toFixed(2)} of absolute tax movement and requires export-completeness reconciliation.`,
    amountInvolved: total,
    severity: "high",
    citations: items.flatMap((item) => item.citations).slice(0, 16),
    lineItems: items,
    impactCategories: ["control_breach"],
    calculations: [{ label: "Unmatched ledger movement", expression: `${missing} unmatched references`, value: total, currency: "EUR" }],
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

function graphFor(findings: Finding[], companyName: string): { entities: EntityCluster[]; graph: MoneyGraph } {
  const company: EntityCluster = {
    id: stableId("entity", companyName),
    names: [companyName],
    ibans: [],
    vatIds: [],
    addresses: [],
    factIds: [],
  };
  const names = [...new Set(findings.flatMap((item) => item.lineItems?.map((line) => line.counterparty).filter(Boolean) ?? []))] as string[];
  const counterparties = names.map((name) => ({
    id: stableId("entity", name),
    names: [name],
    ibans: [],
    vatIds: [],
    addresses: [],
    factIds: [],
  }));
  const entities = [company, ...counterparties];
  const edges = counterparties.map((counterparty) => {
    const related = findings.filter((item) => item.lineItems?.some((line) => line.counterparty === counterparty.names[0]));
    return {
      from: company.id,
      to: counterparty.id,
      total: related.flatMap((item) => item.lineItems ?? []).filter((line) => line.counterparty === counterparty.names[0]).reduce((sum, line) => sum + line.amount, 0),
      currency: "EUR",
      factIds: [],
      findingIds: related.map((item) => item.id),
    };
  });
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
