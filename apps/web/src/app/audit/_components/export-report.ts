import type { Citation, Finding } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { verdictOf } from "./components";
import type { Decision, ReviewEntry } from "./use-review";
import type { ExecSummary, Scheme } from "./schemes";

const eur = (n: number) => `EUR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtCitation(c: Citation, data: DossierData): string {
  const file = data.docs.find((d) => d.id === c.docId)?.filename ?? c.docId;
  return `> **${file} · ${c.ref}** — “${c.quote}”`;
}

function renderFinding(f: Finding, data: DossierData, entry: ReviewEntry): string {
  const facts = new Map(data.facts.map((x) => [x.id, x]));
  const cites =
    f.factIds.length > 0
      ? f.factIds.flatMap((id) => facts.get(id)?.citations ?? [])
      : f.citations;
  const seen = new Set<string>();
  const uniq = cites.filter((c) => {
    const k = `${c.docId}|${c.ref}|${c.quote}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const lines = [
    `### ${f.title}`,
    ``,
    `*${f.fraudType} · tier: ${f.tier} · severity: ${f.severity}` +
      (f.amountInvolved != null ? ` · amount: ${eur(f.amountInvolved)}` : "") +
      ` · engine: ${f.engineStatus ?? "detected"} · AI: ${f.aiStatus ?? "not-run"} · human: ${verdictOf(f)}*`,
    ``,
    f.narrative,
    ``,
    `**Evidence:**`,
    ...uniq.map((c) => fmtCitation(c, data)),
  ];
  if (f.calculations?.length) {
    lines.push(``, `**Calculations:**`, ...f.calculations.map((calculation) => `- ${calculation.label}: **${eur(calculation.value)}** — ${calculation.expression}`));
  }
  if (f.lineItems?.length) {
    lines.push(``, `| Date | Document | Counterparty / item | Amount |`, `|---|---|---|---:|`);
    for (const item of f.lineItems) {
      lines.push(`| ${item.date ?? "—"} | ${item.documentNumber ?? "—"} | ${item.counterparty ?? item.label} — ${item.description ?? ""} | ${eur(item.amount)} |`);
    }
  }
  if (f.tribunal) {
    lines.push(``, `**Tribunal:** ${f.tribunal.verdict} — ${f.tribunal.reasoning}`);
    if (f.tribunal.defenseCitations.length) {
      lines.push(`**Counter-evidence considered:**`, ...f.tribunal.defenseCitations.map((c) => fmtCitation(c, data)));
    }
  }
  if (entry.note) lines.push(``, `**Auditor note:** ${entry.note}`);
  return lines.join("\n");
}

const DECISION_ORDER: { key: Decision | "pending"; label: string }[] = [
  { key: "confirmed", label: "✔ Confirmed by auditor" },
  { key: "info", label: "? Needs more information" },
  { key: "pending", label: "○ Pending review" },
  { key: "dismissed", label: "✕ Dismissed by auditor" },
];

export function buildReport(
  data: DossierData,
  schemes: Scheme[],
  schemeOf: Map<string, string>,
  summary: ExecSummary,
  reviewMap: Record<string, ReviewEntry>,
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const schemeTitle = new Map(schemes.map((s) => [s.id, s.title]));

  const groups: Record<string, Finding[]> = { confirmed: [], info: [], pending: [], dismissed: [] };
  for (const f of data.findings) {
    if (verdictOf(f) === "acquitted") continue; // acquitted handled separately
    const decision = reviewMap[f.id]?.decision ?? "pending";
    groups[decision]!.push(f);
  }

  const out: string[] = [
    `# Forensic Audit Report — “${data.name}”`,
    ``,
    `Reviewed ${now} · Cortea Forensic Engine`,
    ``,
    `## Executive summary`,
    ``,
    `- **${summary.openCount} open findings** across **${summary.schemeCount} schemes**, involving **${summary.entitiesInvolved} counterparties**`,
    `- Tiers: ${summary.byTier.proven} proven (arithmetic) · ${summary.byTier.corroborated} corroborated (multi-document) · ${summary.byTier.judgment} judgment-required`,
    `- Non-overlapping financial exposure: **${eur(summary.netExposure)}** (control-only amounts excluded)`,
    `- Gross cash paid in the vendor-control scheme: **${eur(summary.grossExposure)}**`,
    `- Evidence integrity: **${summary.citationsVerified}/${summary.citationsTotal} citations machine-verified** against source text`,
    `- ${summary.headline}`,
    ``,
    `Review status: ${summary.acquitted} auto-acquitted by tribunal · ` +
      `${groups.confirmed.length} confirmed · ${groups.info.length} need info · ${groups.pending.length} pending · ${groups.dismissed.length} dismissed by auditor.`,
    ``,
  ];

  for (const { key, label } of DECISION_ORDER) {
    const list = groups[key]!;
    if (!list.length) continue;
    out.push(`## ${label} (${list.length})`, ``);
    // organize by scheme
    const bySch = new Map<string, Finding[]>();
    for (const f of list) {
      const s = schemeOf.get(f.id) ?? "none";
      if (!bySch.has(s)) bySch.set(s, []);
      bySch.get(s)!.push(f);
    }
    for (const [sid, fs] of bySch) {
      const st = schemeTitle.get(sid);
      if (st && fs.length > 1) out.push(`#### Scheme: ${st}`, ``);
      for (const f of fs) out.push(renderFinding(f, data, reviewMap[f.id] ?? {}), ``, `---`, ``);
    }
  }

  const acquitted = data.findings.filter((f) => verdictOf(f) === "acquitted");
  if (acquitted.length) {
    out.push(`## Examined and acquitted (${acquitted.length})`, ``, `Items that looked suspicious but have a documented innocent explanation.`, ``);
    for (const f of acquitted) out.push(renderFinding(f, data, reviewMap[f.id] ?? {}), ``, `---`, ``);
  }
  return out.join("\n");
}

export function downloadReport(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
