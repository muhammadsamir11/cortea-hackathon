// The forensic engine: deterministic checks over verified facts.
// No LLM anywhere in this file — findings here are computed, not generated.

import type { Citation, Fact, Finding, Tier } from "../types";
import type { EntityIndex } from "./entities";

export interface EngineContext {
  facts: Fact[];
  idx: EntityIndex;
  companyName: string;
}

export type Candidate = Omit<Finding, "tribunal">;

const CFG = {
  reconToleranceAbs: 1.0, // EUR — differences below this are noise
  amountMatchPct: 0.02,
  dateWindowDays: 60,
  nearThresholdPct: 0.06, // "just below approval threshold"
  cycleAmountDriftPct: 0.25,
  maxCitations: 10,
};

function cites(facts: Fact[], cap = CFG.maxCitations): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const f of facts) {
    for (const c of f.citations) {
      const key = `${c.docId}|${c.ref}|${c.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

function severity(amount: number | null, floor: "high" | "medium" | "low" = "low"): "high" | "medium" | "low" {
  const byAmount = amount == null ? "low" : amount >= 25_000 ? "high" : amount >= 5_000 ? "medium" : "low";
  const rank = { high: 3, medium: 2, low: 1 } as const;
  return rank[byAmount] >= rank[floor] ? byAmount : floor;
}

function daysBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / 86_400_000;
}

function clusterLabel(ctx: EngineContext, clusterId: string | null | undefined): string {
  if (!clusterId) return "unknown party";
  const c = ctx.idx.clusters.find((c) => c.id === clusterId);
  return c?.names[0] ?? "unknown party";
}

const eur = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let seq = 0;
function candidate(
  checkId: string,
  tier: Tier,
  fraudType: string,
  title: string,
  narrative: string,
  facts: Fact[],
  amountInvolved: number | null,
  sevFloor: "high" | "medium" | "low" = "low",
): Candidate {
  return {
    id: `c-${checkId}-${++seq}`,
    checkId,
    tier,
    fraudType,
    title,
    narrative,
    amountInvolved,
    severity: severity(amountInvolved, sevFloor),
    factIds: facts.map((f) => f.id),
    citations: cites(facts),
  };
}

const transactions = (ctx: EngineContext) => ctx.facts.filter((f) => f.kind === "transaction");
const payeeCluster = (ctx: EngineContext, f: Fact) => ctx.idx.factRole.get(`${f.id}:payee`);
const payerCluster = (ctx: EngineContext, f: Fact) => ctx.idx.factRole.get(`${f.id}:payer`);

/* ------------------------------------------------------------------ */
/* 1. Duplicate payments                                               */
/* ------------------------------------------------------------------ */
export function checkDuplicates(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  const txs = transactions(ctx).filter((t) => t.amount != null);
  // a) same document number charged/paid more than once (outflows)
  const byNumber = new Map<string, Fact[]>();
  for (const t of txs) {
    for (const num of [t.docNumber, ...(t.relatedDocNumbers ?? [])]) {
      if (!num) continue;
      const key = num.trim().toUpperCase();
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key)!.push(t);
    }
  }
  for (const [num, group] of byNumber) {
    const outflows = group.filter((t) => payerCluster(ctx, t) === ctx.idx.companyClusterId);
    if (outflows.length < 2) continue;
    const inflowCorrection = txs.find(
      (t) =>
        payeeCluster(ctx, t) === ctx.idx.companyClusterId &&
        (t.description ?? "").toUpperCase().includes(num),
    );
    const creditNote = ctx.facts.find(
      (f) =>
        f.kind !== "transaction" &&
        f.docId !== outflows[0]!.docId &&
        ((f.relatedDocNumbers ?? []).some((n) => n.toUpperCase() === num) ||
          (f.description ?? "").toUpperCase().includes(num)) &&
        /gutschrift|credit note|storno|reversal/i.test(`${f.label} ${f.description} ${f.kind}`),
    );
    const amount = outflows[0]!.amount ?? null;
    const vendor = clusterLabel(ctx, payeeCluster(ctx, outflows[0]!));
    const correctionNote = inflowCorrection || creditNote
      ? " A correcting entry or credit note referencing this number exists in the dossier — the tribunal must weigh whether it fully neutralizes the duplicate."
      : " No correcting entry or credit note referencing this number was found in the dossier.";
    out.push(
      candidate(
        "duplicates",
        "proven",
        "duplicate_payment",
        `Document ${num} paid ${outflows.length}× (${vendor})`,
        `The ledger shows ${outflows.length} outgoing payments referencing the same document number ${num}` +
          ` to ${vendor}, each over EUR ${amount != null ? eur(amount) : "?"}.` +
          ` Payment dates: ${outflows.map((t) => t.date ?? "?").join(", ")}.` +
          correctionNote,
        [...outflows, ...(inflowCorrection ? [inflowCorrection] : []), ...(creditNote ? [creditNote] : [])],
        amount,
        "medium",
      ),
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Bank-detail integrity (payment redirects, shared IBANs)          */
/* ------------------------------------------------------------------ */
export function checkIbanIntegrity(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  // a) payment went to an IBAN the vendor never declared in any document
  for (const t of transactions(ctx)) {
    if (!t.payeeIban) continue;
    const cid = payeeCluster(ctx, t);
    if (!cid || cid === ctx.idx.companyClusterId) continue;
    const declared = ctx.idx.declaredIbans.get(cid);
    if (!declared || declared.size === 0 || declared.has(t.payeeIban)) continue;
    const vendor = clusterLabel(ctx, cid);
    const declaring = ctx.facts.filter(
      (f) =>
        [f.payeeIban, f.entityIban].some((i) => i && declared.has(i)) &&
        (ctx.idx.factRole.get(`${f.id}:payee`) === cid || ctx.idx.factRole.get(`${f.id}:entity`) === cid),
    );
    out.push(
      candidate(
        "ibanIntegrity",
        "corroborated",
        "payment_redirect",
        `Payment to ${vendor} sent to undeclared account`,
        `A payment of EUR ${t.amount != null ? eur(t.amount) : "?"} on ${t.date ?? "unknown date"} to ${vendor}` +
          ` went to IBAN ${t.payeeIban}, which does not match any bank account this vendor declared in the dossier` +
          ` (declared: ${[...declared].join(", ")}). Redirecting vendor payments to a different account is a classic` +
          ` payment-diversion pattern.`,
        [t, ...declaring.slice(0, 3)],
        t.amount ?? null,
        "high",
      ),
    );
  }
  // b) one bank account shared by entities with clearly different names
  for (const c of ctx.idx.clusters) {
    if (c.id === ctx.idx.companyClusterId) continue;
    if (c.ibans.length >= 2 && c.names.length >= 2) {
      const facts = ctx.facts.filter((f) => c.factIds.includes(f.id));
      out.push(
        candidate(
          "ibanIntegrity",
          "corroborated",
          "entity_identity_game",
          `"${c.names.join('" / "')}" — one vendor, ${c.ibans.length} bank accounts`,
          `Name variants (${c.names.join(", ")}) that resolve to the same vendor appear with ${c.ibans.length}` +
            ` different IBANs (${c.ibans.join(", ")}). Splitting one vendor identity across name variants and` +
            ` accounts is used to slip duplicate or diverted payments past controls.`,
          facts.slice(0, 6),
          null,
          "medium",
        ),
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Three-way match (PO ↔ invoice ↔ payment)                         */
/* ------------------------------------------------------------------ */
export function checkThreeWayMatch(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  const invoices = ctx.facts.filter((f) => f.kind === "invoice");
  const pos = ctx.facts.filter((f) => f.kind === "purchase_order");
  const txs = transactions(ctx);
  const thresholds = ctx.facts
    .filter((f) => f.kind === "contract_term" && f.amount != null && /approv|genehmig|threshold|schwelle|freigabe/i.test(`${f.label} ${f.description}`))
    .map((f) => ({ amount: f.amount!, fact: f }));

  for (const inv of invoices) {
    if (inv.amount == null) continue;
    // credit notes / reversals are not purchases — no PO expected
    if (/gutschrift|credit note|storno|reversal/i.test(`${inv.label} ${inv.description}`)) continue;
    const invNum = inv.docNumber?.toUpperCase();
    const vendorCluster = payeeCluster(ctx, inv);
    const po = pos.find(
      (p) =>
        (p.docNumber && (inv.relatedDocNumbers ?? []).some((n) => n.toUpperCase() === p.docNumber!.toUpperCase())) ||
        (payeeCluster(ctx, p) === vendorCluster &&
          p.amount != null &&
          Math.abs(p.amount - inv.amount!) <= inv.amount! * CFG.amountMatchPct),
    );
    const payment = txs.find(
      (t) =>
        (invNum && ([t.docNumber, ...(t.relatedDocNumbers ?? [])].some((n) => n?.toUpperCase() === invNum))) ||
        (payeeCluster(ctx, t) === vendorCluster &&
          t.amount != null &&
          Math.abs(t.amount - inv.amount!) <= inv.amount! * CFG.amountMatchPct &&
          (daysBetween(t.date, inv.date) ?? 999) <= CFG.dateWindowDays),
    );
    if (payment && !po) {
      const nearThreshold = thresholds.find(
        (th) => inv.amount! < th.amount && inv.amount! >= th.amount * (1 - CFG.nearThresholdPct),
      );
      const vendor = clusterLabel(ctx, vendorCluster);
      out.push(
        candidate(
          "threeWayMatch",
          "corroborated",
          nearThreshold ? "threshold_avoidance" : "missing_purchase_order",
          `${vendor}: EUR ${eur(inv.amount)} paid without purchase order` +
            (nearThreshold ? " — just below approval threshold" : ""),
          `Invoice ${inv.docNumber ?? "(no number)"} from ${vendor} over EUR ${eur(inv.amount)} was paid` +
            ` (${payment.date ?? "date unknown"}) but no matching purchase order exists in the dossier.` +
          (nearThreshold
              ? ` The amount sits ${eur(nearThreshold.amount - inv.amount!)} below the EUR ${eur(nearThreshold.amount)} approval threshold` +
                ` documented in the dossier — a pattern consistent with deliberate threshold avoidance.`
              : ""),
          [inv, payment, ...(nearThreshold ? [nearThreshold.fact] : [])],
          inv.amount,
          nearThreshold ? "high" : "medium",
        ),
      );
    }
    if (po && po.amount != null && Math.abs(po.amount - inv.amount) > inv.amount * CFG.amountMatchPct) {
      out.push(
        candidate(
          "threeWayMatch",
          "proven",
          "amount_mismatch",
          `Invoice ${inv.docNumber ?? ""} differs from its PO by EUR ${eur(Math.abs(po.amount - inv.amount))}`,
          `Invoice ${inv.docNumber ?? "(no number)"} over EUR ${eur(inv.amount)} references PO ${po.docNumber ?? ""},` +
            ` which was approved for EUR ${eur(po.amount)}.`,
          [inv, po],
          Math.abs(po.amount - inv.amount),
        ),
      );
    }
  }
  // payments with no invoice at all
  for (const t of txs) {
    if (t.amount == null || t.amount < 1000) continue;
    if (payerCluster(ctx, t) !== ctx.idx.companyClusterId) continue;
    const cid = payeeCluster(ctx, t);
    if (!cid) continue;
    if (/gehalt|lohn|salary|miete|rent|steuer|tax|payroll/i.test(`${t.description}`)) continue;
    const nums = [t.docNumber, ...(t.relatedDocNumbers ?? [])].filter(Boolean) as string[];
    const inv = invoices.find(
      (i) =>
        (i.docNumber && nums.some((n) => n.toUpperCase() === i.docNumber!.toUpperCase())) ||
        (payeeCluster(ctx, i) === cid &&
          i.amount != null &&
          Math.abs(i.amount - t.amount!) <= t.amount! * CFG.amountMatchPct),
    );
    if (!inv && nums.some((n) => /^(RE|INV|R)[-.]?\d/i.test(n))) {
      out.push(
        candidate(
          "threeWayMatch",
          "judgment",
          "payment_without_invoice",
          `Payment of EUR ${eur(t.amount)} to ${clusterLabel(ctx, cid)} — invoice not in dossier`,
          `The ledger references ${nums.join(", ")} for a EUR ${eur(t.amount)} payment to ${clusterLabel(ctx, cid)},` +
            ` but no such invoice document is part of the dossier. This may be an incomplete dossier or a fabricated reference.`,
          [t],
          t.amount,
        ),
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 4. Temporal impossibilities                                          */
/* ------------------------------------------------------------------ */
export function checkTemporal(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  const invoices = ctx.facts.filter((f) => f.kind === "invoice" && f.date);
  const pos = ctx.facts.filter((f) => f.kind === "purchase_order" && f.date);
  for (const inv of invoices) {
    for (const num of inv.relatedDocNumbers ?? []) {
      const po = pos.find((p) => p.docNumber?.toUpperCase() === num.toUpperCase());
      if (po && Date.parse(inv.date!) < Date.parse(po.date!)) {
        out.push(
          candidate(
            "temporal",
            "proven",
            "backdating",
            `Invoice ${inv.docNumber ?? ""} predates its own purchase order ${po.docNumber}`,
            `Invoice ${inv.docNumber ?? "(no number)"} is dated ${inv.date} and references purchase order` +
              ` ${po.docNumber}, which was only issued on ${po.date}. An invoice cannot legitimately reference` +
              ` a purchase order that did not exist yet — this indicates the PO was created after the fact.`,
            [inv, po],
            inv.amount ?? null,
            "medium",
          ),
        );
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 5. Balance reconciliation                                            */
/* ------------------------------------------------------------------ */
export function checkReconciliation(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  const balances = ctx.facts.filter((f) => f.kind === "balance" && f.amount != null);
  const ibanOf = (f: Fact) => f.accountRef?.replace(/\s+/g, "").toUpperCase().match(/[A-Z]{2}\d{2}[A-Z0-9]{8,30}/)?.[0] ?? null;
  const groups = new Map<string, Fact[]>();
  for (const b of balances) {
    const iban = ibanOf(b);
    const key = iban ?? (/(bank|kredit|kontokorrent|cash|kasse|guthaben)/i.test(`${b.accountRef} ${b.label}`) ? "BANKISH" : null);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  // Merge BANKISH into a single IBAN group when there is exactly one IBAN group
  const ibanKeys = [...groups.keys()].filter((k) => k !== "BANKISH");
  if (ibanKeys.length === 1 && groups.has("BANKISH")) {
    groups.get(ibanKeys[0]!)!.push(...groups.get("BANKISH")!);
    groups.delete("BANKISH");
  }
  for (const [key, group] of groups) {
    if (key === "BANKISH" || group.length < 2) continue;
    // same cutoff (or all same period): compare distinct amounts
    const byDate = new Map<string, Fact[]>();
    for (const b of group) {
      const d = b.date ?? b.periodEnd ?? "unknown";
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(b);
    }
    for (const [date, atDate] of byDate) {
      const amounts = new Map<number, Fact[]>();
      for (const b of atDate) {
        const found = [...amounts.keys()].find((a) => Math.abs(a - b.amount!) <= CFG.reconToleranceAbs);
        if (found != null) amounts.get(found)!.push(b);
        else amounts.set(b.amount!, [b]);
      }
      if (amounts.size >= 2) {
        const sorted = [...amounts.entries()].sort((a, b) => a[0] - b[0]);
        const diff = sorted[sorted.length - 1]![0] - sorted[0]![0];
        const parts = sorted
          .map(
            ([amt, fs]) =>
              `EUR ${eur(amt)} per ${[...new Set(fs.map((f) => f.balanceSource ?? "unknown source"))].join("/")}`,
          )
          .join(" vs ");
        const hasBankConf = atDate.some((f) => f.balanceSource === "bank_confirmation");
        out.push(
          candidate(
            "reconciliation",
            "proven",
            "balance_manipulation",
            `Account ${key}: books differ from ${hasBankConf ? "bank confirmation" : "other source"} by EUR ${eur(diff)}`,
            `For account ${key} as of ${date}, the dossier asserts irreconcilable balances: ${parts}.` +
              (hasBankConf
                ? ` The bank's own confirmation is the authoritative external evidence — the difference of EUR ${eur(diff)}` +
                  ` in the books has no support from the bank.`
                : ""),
            atDate,
            diff,
            "high",
          ),
        );
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 6. Round-tripping (cycles in the money graph)                        */
/* ------------------------------------------------------------------ */
export function checkCycles(ctx: EngineContext): Candidate[] {
  const out: Candidate[] = [];
  const edges = new Map<string, { to: string; facts: Fact[] }[]>();
  for (const t of transactions(ctx)) {
    const from = payerCluster(ctx, t);
    const to = payeeCluster(ctx, t);
    if (!from || !to || from === to) continue;
    // refunds/reversals are not round-tripping legs
    if (/gutschrift|storno|refund|erstattung|reversal/i.test(`${t.description}`)) continue;
    if (!edges.has(from)) edges.set(from, []);
    const list = edges.get(from)!;
    const existing = list.find((e) => e.to === to);
    if (existing) existing.facts.push(t);
    else list.push({ to, facts: [t] });
  }
  const company = ctx.idx.companyClusterId;
  if (!company) return out;
  // DFS from company, depth ≤ 4, find paths back to company
  const found = new Set<string>();
  const walk = (node: string, path: string[], factsOnPath: Fact[]) => {
    if (path.length > 4) return;
    for (const e of edges.get(node) ?? []) {
      // ≥2 intermediaries: a direct A→B→A pattern is a refund, not round-tripping
      if (e.to === company && path.length >= 3) {
        const key = path.slice(1).sort().join("|");
        if (found.has(key)) continue;
        found.add(key);
        const allFacts = [...factsOnPath, ...e.facts];
        const amounts = allFacts.map((f) => f.amount).filter((a): a is number => a != null);
        const maxA = Math.max(...amounts);
        const minA = Math.min(...amounts);
        const names = path.slice(1).map((id) => clusterLabel(ctx, id));
        if (amounts.length >= 2 && (maxA - minA) / maxA <= CFG.cycleAmountDriftPct) {
          out.push(
            candidate(
              "cycles",
              "corroborated",
              "round_tripping",
              `Money round-trip: ${ctx.companyName} → ${names.join(" → ")} → ${ctx.companyName}`,
              `Funds leave ${ctx.companyName} and return via ${names.join(" and ")}: ` +
                allFacts
                  .map(
                    (f) =>
                      `${clusterLabel(ctx, payerCluster(ctx, f))} paid ${clusterLabel(ctx, payeeCluster(ctx, f))}` +
                      ` EUR ${f.amount != null ? eur(f.amount) : "?"} on ${f.date ?? "?"}`,
                  )
                  .join("; ") +
                `. Amounts shrink only marginally along the loop — the signature of round-tripping used to fabricate` +
                ` revenue or other income.`,
              allFacts,
              maxA,
              "high",
            ),
          );
        }
        continue;
      }
      if (path.includes(e.to) || e.to === company) continue;
      walk(e.to, [...path, e.to], [...factsOnPath, ...e.facts]);
    }
  };
  walk(company, [company], []);
  return out;
}

export function runEngine(ctx: EngineContext): Candidate[] {
  const checks = [
    checkReconciliation,
    checkDuplicates,
    checkIbanIntegrity,
    checkThreeWayMatch,
    checkTemporal,
    checkCycles,
  ];
  const out: Candidate[] = [];
  for (const check of checks) {
    try {
      const found = check(ctx);
      console.log(`  [engine] ${check.name}: ${found.length} candidate(s)`);
      out.push(...found);
    } catch (err) {
      console.error(`  [engine] ${check.name} crashed:`, err);
    }
  }
  return out;
}
