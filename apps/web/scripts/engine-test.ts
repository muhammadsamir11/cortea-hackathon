// Offline engine test: hand-written facts for the synthetic dossier prove
// every deterministic check fires — no LLM required. Also produces data files
// so the UI can be developed before an API key exists.
import path from "node:path";
import fs from "node:fs";
import type { AnalysisMeta, DossierDoc, Fact, Finding } from "@almedia/forensic/types";
import { dataDir, readJson, writeJson } from "@almedia/forensic/paths";
import { validateFacts } from "@almedia/forensic/pipeline/validate";
import { buildEntityIndex } from "@almedia/forensic/engine/entities";
import { runEngine } from "@almedia/forensic/engine/checks";
import { buildGraph } from "@almedia/forensic/engine/graph";
import { renderReport } from "@almedia/forensic/report";

const COMPANY = "PayFlux GmbH";
const name = "synthetic";
const dir = dataDir(name);
const docs = readJson<DossierDoc[]>(path.join(dir, "documents.json"));
const rawFacts = readJson<Fact[]>(path.join(__dirname, "../fixtures/facts-synthetic.json"));

const { verified, stats } = validateFacts(rawFacts, docs);
console.log(
  `validation: ${stats.verifiedFacts}/${stats.facts} facts · ${stats.verifiedCitations}/${stats.citations} citations · ${stats.repairedRefs} refs repaired`,
);
for (const d of stats.droppedFacts) console.warn(`  DROPPED ${d.factId}: "${d.quotes[0]}"`);

const idx = buildEntityIndex(verified, COMPANY);
console.log(`entities: ${idx.clusters.length} clusters, company=${idx.companyClusterId}`);
for (const c of idx.clusters) console.log(`  ${c.id}: ${c.names.join(" | ")} ${c.ibans.join(",")}`);

const candidates = runEngine({ facts: verified, idx, companyName: COMPANY });
console.log(`\n${candidates.length} candidates:`);
for (const c of candidates) console.log(`  [${c.checkId}/${c.tier}] ${c.title}`);

const findings: Finding[] = candidates.map((c) => ({ ...c }));
const graph = buildGraph(verified, idx, findings);
const meta: AnalysisMeta = {
  dossier: name,
  generatedAt: new Date().toISOString(),
  model: "offline-fixture",
  stats: {
    docs: docs.length,
    units: docs.reduce((n, d) => n + d.units.length, 0),
    facts: stats.facts,
    verifiedFacts: stats.verifiedFacts,
    findings: findings.length,
    acquitted: 0,
  },
};
writeJson(path.join(dir, "facts.json"), verified);
writeJson(path.join(dir, "entities.json"), idx.clusters);
writeJson(path.join(dir, "findings.json"), findings);
writeJson(path.join(dir, "graph.json"), graph);
writeJson(path.join(dir, "meta.json"), { ...meta, validation: stats });
fs.writeFileSync(path.join(dir, "report.md"), renderReport(findings, docs, meta));
console.log(`\n→ wrote data/${name}/*`);

// Expectations (exit non-zero if a planted fraud is missed)
const expect = [
  ["reconciliation", candidates.some((c) => c.checkId === "reconciliation")],
  ["duplicates RE-2024-041", candidates.some((c) => c.checkId === "duplicates" && c.title.includes("RE-2024-041"))],
  ["duplicates RE-2024-033 (innocent trap)", candidates.some((c) => c.checkId === "duplicates" && c.title.includes("RE-2024-033"))],
  ["ibanIntegrity redirect", candidates.some((c) => c.fraudType === "payment_redirect")],
  ["threeWayMatch threshold", candidates.some((c) => c.fraudType === "threshold_avoidance")],
  ["temporal backdating", candidates.some((c) => c.fraudType === "backdating")],
  ["cycles round-trip", candidates.some((c) => c.fraudType === "round_tripping")],
] as const;
let failed = 0;
for (const [label, ok] of expect) {
  console.log(`${ok ? "✓" : "✗ MISSING"} ${label}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
