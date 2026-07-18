import type { EntityCluster, Fact, Finding } from "@almedia/forensic/types";
import { verdictOf } from "./components";

export interface Scheme {
  id: string;
  findingIds: string[];
  entityNames: string[];
  fraudTypes: string[];
  grossAmount: number;
  netAmount: number; // largest single finding — avoids implying overlaps sum to a real loss
  severity: "high" | "medium" | "low";
  title: string;
}

const SEV_RANK = { high: 3, medium: 2, low: 1 } as const;

class UF {
  private p = new Map<string, string>();
  find(x: string): string {
    let r = this.p.get(x);
    if (r === undefined) {
      this.p.set(x, x);
      return x;
    }
    if (r !== x) {
      r = this.find(r);
      this.p.set(x, r);
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p.set(rb, ra);
  }
}

const FRAUD_LABEL: Record<string, string> = {
  balance_manipulation: "balance manipulation",
  duplicate_payment: "duplicate payment",
  payment_redirect: "payment redirect",
  entity_identity_game: "identity aliasing",
  threshold_avoidance: "threshold avoidance",
  missing_purchase_order: "missing purchase order",
  amount_mismatch: "PO/invoice mismatch",
  backdating: "backdating",
  payment_without_invoice: "missing invoice",
  round_tripping: "round-tripping",
};
const fraudLabel = (t: string) => FRAUD_LABEL[t] ?? t.replace(/_/g, " ");

/** Entity clusters a finding touches (via its facts), excluding the audited company. */
function findingEntities(
  finding: Finding,
  factToEntities: Map<string, string[]>,
  companyId: string | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const fid of finding.factIds) {
    for (const eid of factToEntities.get(fid) ?? []) {
      if (eid !== companyId) out.add(eid);
    }
  }
  return out;
}

export function clusterSchemes(
  findings: Finding[],
  entities: EntityCluster[],
  facts: Fact[],
  companyId: string | null | undefined,
): { schemes: Scheme[]; schemeOf: Map<string, string> } {
  const factToEntities = new Map<string, string[]>();
  for (const e of entities) {
    for (const fid of e.factIds) {
      if (!factToEntities.has(fid)) factToEntities.set(fid, []);
      factToEntities.get(fid)!.push(e.id);
    }
  }
  const entityNameById = new Map(entities.map((e) => [e.id, e.names[0] ?? e.id]));

  const uf = new UF();
  findings.forEach((f) => uf.find(f.id));

  // union by shared fact
  const factOwner = new Map<string, string>();
  for (const f of findings) {
    for (const fid of f.factIds) {
      const prev = factOwner.get(fid);
      if (prev) uf.union(prev, f.id);
      else factOwner.set(fid, f.id);
    }
  }
  // union by shared non-company entity
  const entOwner = new Map<string, string>();
  const entsByFinding = new Map<string, Set<string>>();
  for (const f of findings) {
    const ents = findingEntities(f, factToEntities, companyId);
    for (const item of f.lineItems ?? []) {
      if (!item.counterparty) continue;
      const matching = entities.find((entity) => entity.names.some((name) => name === item.counterparty));
      if (matching && matching.id !== companyId) ents.add(matching.id);
    }
    entsByFinding.set(f.id, ents);
    for (const eid of ents) {
      const prev = entOwner.get(eid);
      if (prev) uf.union(prev, f.id);
      else entOwner.set(eid, f.id);
    }
  }
  // attach sweep findings (no facts/entities) by entity-name mention in title+narrative
  for (const f of findings) {
    if (f.factIds.length) continue;
    const hay = `${f.title} ${f.narrative}`.toLowerCase();
    for (const e of entities) {
      if (e.id === companyId) continue;
      if (e.names.some((n) => n.length > 3 && hay.includes(n.toLowerCase()))) {
        uf.union(entOwner.get(e.id) ?? f.id, f.id);
      }
    }
  }

  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const root = uf.find(f.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(f);
  }

  const schemes: Scheme[] = [];
  const schemeOf = new Map<string, string>();
  let n = 0;
  for (const group of groups.values()) {
    const id = `scheme-${++n}`;
    const names = new Set<string>();
    for (const f of group) {
      for (const eid of entsByFinding.get(f.id) ?? []) {
        const nm = entityNameById.get(eid);
        if (nm) names.add(nm);
      }
    }
    const fraudTypes = [...new Set(group.map((f) => f.fraudType))];
    const grossAmount = group.reduce((s, f) => s + (f.amountInvolved ?? 0), 0);
    const netAmount = Math.max(0, ...group.map((f) => f.amountInvolved ?? 0));
    const severity = group.reduce<"high" | "medium" | "low">(
      (s, f) => (SEV_RANK[f.severity] > SEV_RANK[s] ? f.severity : s),
      "low",
    );
    const entityNames = [...names];
    const lead = entityNames[0] ?? group[0]!.title;
    const title =
      group.length === 1
        ? group[0]!.title
        : `${lead} — ${fraudTypes.map(fraudLabel).slice(0, 4).join(" + ")}`;
    group.forEach((f) => schemeOf.set(f.id, id));
    schemes.push({ id, findingIds: group.map((f) => f.id), entityNames, fraudTypes, grossAmount, netAmount, severity, title });
  }
  schemes.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.netAmount - a.netAmount);
  return { schemes, schemeOf };
}

export interface ExecSummary {
  openCount: number;
  byTier: { proven: number; corroborated: number; judgment: number };
  schemeCount: number;
  grossExposure: number;
  netExposure: number;
  entitiesInvolved: number;
  citationsVerified: number;
  citationsTotal: number;
  acquitted: number;
  headline: string;
}

export function summarize(
  findings: Finding[],
  schemes: Scheme[],
  validation: { citations: number; verifiedCitations: number } | undefined,
): ExecSummary {
  const open = findings.filter((f) => verdictOf(f) !== "acquitted");
  const openSchemes = schemes.filter((s) =>
    s.findingIds.some((id) => open.some((f) => f.id === id)),
  );
  const byTier = { proven: 0, corroborated: 0, judgment: 0 };
  for (const f of open) byTier[f.tier]++;
  const financial = open.filter((finding) => !finding.impactCategories?.every((category) => category === "control_breach"));
  const netExposure = financial.reduce((sum, finding) => sum + (finding.amountInvolved ?? 0), 0);
  const grossExposure = open.reduce(
    (sum, finding) => sum + (finding.calculations?.find((calculation) => calculation.label === "Gross cash paid")?.value ?? 0),
    0,
  );
  const entities = new Set(openSchemes.flatMap((s) => s.entityNames));
  const top = openSchemes[0];
  const headline = top
    ? `Primary scheme: ${top.title}${top.netAmount ? ` (~€${top.netAmount.toLocaleString("en-US")} at risk)` : ""}`
    : "No open findings — dossier appears clean.";
  return {
    openCount: open.length,
    byTier,
    schemeCount: openSchemes.length,
    grossExposure,
    netExposure,
    entitiesInvolved: entities.size,
    citationsVerified: validation?.verifiedCitations ?? new Set(open.flatMap((finding) => finding.citations).map((citation) => `${citation.docId}|${citation.ref}|${citation.quote}`)).size,
    citationsTotal: validation?.citations ?? new Set(open.flatMap((finding) => finding.citations).map((citation) => `${citation.docId}|${citation.ref}|${citation.quote}`)).size,
    acquitted: findings.filter((f) => verdictOf(f) === "acquitted").length,
    headline,
  };
}
