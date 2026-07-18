import type { AnalysisMeta, Citation, DossierDoc, Finding } from "./types";

function fmtCitation(c: Citation, docs: DossierDoc[]): string {
  const file = docs.find((d) => d.id === c.docId)?.filename ?? c.docId;
  return `> **${file} · ${c.ref}** — “${c.quote}”`;
}

const eur = (n: number) => `EUR ${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

function section(findings: Finding[], docs: DossierDoc[]): string {
  return findings
    .map((f) => {
      const lines = [
        `### ${f.title}`,
        ``,
        `*${f.fraudType} · tier: ${f.tier} · severity: ${f.severity}` +
          (f.amountInvolved != null ? ` · amount: ${eur(f.amountInvolved)}` : "") +
          `*`,
        ``,
        f.narrative,
        ``,
        `**Evidence:**`,
        ...f.citations.map((c) => fmtCitation(c, docs)),
      ];
      if (f.calculations?.length) {
        lines.push(
          ``,
          `**Calculations:**`,
          ...f.calculations.map((calc) =>
            `- ${calc.label}: ${calc.expression} = ${calc.currency} ${calc.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ),
        );
      }
      if (f.lineItems?.length) {
        lines.push(
          ``,
          `**Affected records (${f.lineItems.length}):**`,
          ``,
          `| Date | Document | Counterparty / item | Amount |`,
          `|---|---|---|---:|`,
          ...f.lineItems.map((item) =>
            `| ${item.date ?? "—"} | ${item.documentNumber ?? "—"} | ${(item.counterparty ?? item.label).replace(/\|/g, "\\|")} | ${eur(item.amount)} ${item.amountType} |`,
          ),
        );
      }
      if (f.tribunal) {
        lines.push(
          ``,
          `**Tribunal:** ${f.tribunal.verdict} — ${f.tribunal.reasoning}`,
        );
        if (f.tribunal.verdict === "acquitted" && f.tribunal.defenseCitations.length) {
          lines.push(`**Exonerating evidence:**`, ...f.tribunal.defenseCitations.map((c) => fmtCitation(c, docs)));
        }
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function renderReport(findings: Finding[], docs: DossierDoc[], meta: AnalysisMeta): string {
  const confirmed = findings.filter((f) => f.tribunal?.verdict === "confirmed");
  const judgment = findings.filter((f) => f.tribunal?.verdict === "needs-judgment");
  const acquitted = findings.filter((f) => f.tribunal?.verdict === "acquitted");
  const unreviewed = findings.filter((f) => !f.tribunal);
  const order = { high: 0, medium: 1, low: 2 } as const;
  const sortF = (a: Finding, b: Finding) => order[a.severity] - order[b.severity] || (b.amountInvolved ?? 0) - (a.amountInvolved ?? 0);
  confirmed.sort(sortF);
  judgment.sort(sortF);

  const financial = (meta as AnalysisMeta & { financial?: { reportedProfit: number | null; adjustedProfit: number | null } }).financial;
  return [
    `# Forensic Findings — dossier “${meta.dossier}”`,
    ``,
    `Generated ${meta.generatedAt} · model: ${meta.model}`,
    ``,
    `**Method.** Structured accounting records were parsed deterministically; every affected record carries`,
    `a source row, sheet, or page reference (${meta.stats.verifiedFacts}/${meta.stats.facts} records verified).`,
    `Optional AI review is kept separate from engine detection. **No number without a source.**`,
    ...(financial?.reportedProfit != null
      ? [
          ``,
          `**Financial impact.** Reported profit: ${eur(financial.reportedProfit)}. ` +
            `Adjusted profit after detected profit-overstatement findings: ${financial.adjustedProfit == null ? "unavailable" : eur(financial.adjustedProfit)}.`,
        ]
      : []),
    ...(meta.integrity
      ? [
          ``,
          `**Source integrity:** ${meta.integrity.ok ? "passed" : "failed"} ` +
            `(${meta.integrity.checks.filter((check) => check.ok).length}/${meta.integrity.checks.length} checks).`,
          ...meta.integrity.warnings.map((warning) => `- Warning: ${warning}`),
        ]
      : []),
    ``,
    `## Detected — pending independent review (${unreviewed.length})`,
    ``,
    section(unreviewed, docs) || "_none_",
    ``,
    `## Confirmed findings (${confirmed.length})`,
    ``,
    section(confirmed, docs) || "_none_",
    ``,
    `## Requires auditor judgment (${judgment.length})`,
    ``,
    section(judgment, docs) || "_none_",
    ``,
    `## Examined and acquitted (${acquitted.length})`,
    ``,
    `Items that looked suspicious but have a documented innocent explanation — reported for transparency.`,
    ``,
    section(acquitted, docs) || "_none_",
    ``,
  ].join("\n");
}
