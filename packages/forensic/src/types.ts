// The data contract everything hangs on. LLM extracts Facts (with verbatim
// quotes); the deterministic engine computes Findings from verified Facts only.

export type DocKind = "pdf" | "xlsx" | "csv" | "email" | "docx" | "text" | "xml";

/** A citable anchor inside a document. ref examples: "p.3", "Umsätze!r.12-51", "l.1-60" */
export interface Unit {
  ref: string;
  text: string;
  page?: number;
  sheet?: string;
  startLine?: number;
}

export interface DossierDoc {
  id: string;
  filename: string;
  /** Path relative to the configured dossier source root. */
  relativePath?: string;
  kind: DocKind;
  encoding?: "utf-8" | "windows-1252" | "binary";
  sha256?: string;
  language?: string;
  docType?: string;
  summary?: string;
  units: Unit[];
  unitCount?: number;
  firstRef?: string;
  needsOcr?: boolean;
}

export interface Citation {
  docId: string;
  ref: string;
  quote: string;
}

export type FactKind =
  | "transaction"
  | "invoice"
  | "purchase_order"
  | "balance"
  | "entity"
  | "statement_line"
  | "contract_term"
  | "event";

/** Flat on purpose: LLMs fill flat optional fields far more reliably than
 * nested discriminated unions. The engine reads only what each check needs. */
export interface Fact {
  id: string;
  docId: string;
  kind: FactKind;
  date?: string; // ISO
  periodStart?: string;
  periodEnd?: string;
  amount?: number; // normalized decimal (German "12.500,00" -> 12500.0)
  currency?: string;
  payerName?: string;
  payerIban?: string;
  payeeName?: string;
  payeeIban?: string;
  docNumber?: string; // invoice no / PO no
  relatedDocNumbers?: string[]; // e.g. PO referenced on an invoice
  entityName?: string;
  entityIban?: string;
  entityVatId?: string;
  entityAccountNumber?: string;
  entityAddress?: string;
  entityRegNo?: string;
  entityRole?: string;
  accountRef?: string; // for balances: IBAN or account label
  balanceSource?:
    | "bank_confirmation"
    | "ledger"
    | "trial_balance"
    | "financial_statement"
    | "other";
  label?: string; // statement line item / contract topic / event
  description?: string;
  citations: Citation[];
  verified: boolean;
}

export interface EntityCluster {
  id: string;
  names: string[];
  accountNumbers?: string[];
  ibans: string[];
  vatIds: string[];
  addresses: string[];
  factIds: string[];
}

export type Tier = "proven" | "corroborated" | "judgment";
export type Verdict = "confirmed" | "needs-judgment" | "acquitted";

export interface Tribunal {
  defense: string;
  defenseCitations: Citation[];
  verdict: Verdict;
  reasoning: string;
}

export type ImpactCategory =
  | "cash_misappropriation"
  | "profit_overstatement"
  | "asset_overstatement"
  | "control_breach"
  | "other";

export interface FindingLineItem {
  id: string;
  label: string;
  date?: string;
  documentNumber?: string;
  counterparty?: string;
  description?: string;
  amount: number;
  amountType: "net" | "gross" | "cash" | "control";
  citations: Citation[];
}

export interface FindingCalculation {
  label: string;
  expression: string;
  value: number;
  currency: string;
}

export interface Finding {
  id: string;
  checkId: string;
  title: string;
  tier: Tier;
  fraudType: string;
  narrative: string;
  amountInvolved: number | null;
  severity: "high" | "medium" | "low";
  factIds: string[];
  citations: Citation[];
  lineItems?: FindingLineItem[];
  impactCategories?: ImpactCategory[];
  calculations?: FindingCalculation[];
  engineStatus?: "detected" | "cleared";
  aiStatus?: "not-run" | "confirmed" | "needs-judgment" | "acquitted";
  tribunal?: Tribunal;
  origin?: "control" | "ai-assisted" | "investigator";
  analysisRunId?: string;
}

export interface AnalysisCoverage {
  executedControls: string[];
  skippedControls: Array<{ id: string; reason: string }>;
}

export interface ReviewSummary {
  pending: number;
  confirmed: number;
  acquitted: number;
  needsJudgment: number;
  reviewed: number;
  reviewedPrecision: number | null;
}

export interface GraphEdge {
  from: string; // EntityCluster id
  to: string;
  total: number;
  currency: string;
  factIds: string[];
  findingIds: string[];
}

export interface MoneyGraph {
  nodes: EntityCluster[];
  edges: GraphEdge[];
  companyClusterId?: string | null;
}

export interface AnalysisMeta {
  dossier: string;
  generatedAt: string;
  model: string;
  companyName?: string;
  fiscalPeriod?: string;
  public?: boolean;
  analysisRunId?: string;
  sourceFingerprint?: string;
  provider?: string;
  aiAvailable?: boolean;
  coverage?: AnalysisCoverage;
  review?: ReviewSummary;
  integrity?: {
    ok: boolean;
    checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
    warnings: string[];
  };
  stats: {
    docs: number;
    units: number;
    facts: number;
    verifiedFacts: number;
    findings: number;
    acquitted: number;
  };
}
