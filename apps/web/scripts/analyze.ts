import path from "node:path";
import fs from "node:fs";
import type { AnalysisMeta, DossierDoc, Finding, Unit } from "@almedia/forensic/types";
import type { StructuredDataset } from "@almedia/forensic/structured-types";
import { dataDir, readDossierManifest, readJson, writeJson } from "@almedia/forensic/paths";
import { getModel } from "@almedia/forensic/llm";
import { classify } from "@almedia/forensic/pipeline/classify";
import { extractFacts } from "@almedia/forensic/pipeline/extract";
import { validateFacts } from "@almedia/forensic/pipeline/validate";
import { buildEntityIndex } from "@almedia/forensic/engine/entities";
import { runEngine } from "@almedia/forensic/engine/checks";
import { proseSweep } from "@almedia/forensic/pipeline/sweep";
import { tribunal } from "@almedia/forensic/pipeline/tribunal";
import { buildGraph } from "@almedia/forensic/engine/graph";
import { renderReport } from "@almedia/forensic/report";
import { runStructuredEngine } from "@almedia/forensic/structured-engine";
import { loadEvidenceUnits, loadStructuredDataset } from "@almedia/forensic/artifacts";

async function main() {
  const name = process.argv[2] ?? "sample";
  const noAi = process.argv.includes("--no-ai");
  const skipSweep = noAi || process.argv.includes("--no-sweep");
  const skipTribunal = noAi || process.argv.includes("--no-tribunal");
  const dir = dataDir(name);
  const docsFile = path.join(dir, "documents.json");
  if (!fs.existsSync(docsFile)) {
    console.error(`No ${docsFile} — run \`pnpm ingest ${name}\` first.`);
    process.exit(1);
  }
  const docs = readJson<DossierDoc[]>(docsFile);
  const evidenceFile = path.join(dir, "evidence.json");
  if (fs.existsSync(evidenceFile)) {
    for (const doc of docs) doc.units = loadEvidenceUnits(name, doc.id);
  }
  const recordsFile = path.join(dir, "records.json");
  if (fs.existsSync(recordsFile)) {
    const dataset = loadStructuredDataset(name);
    console.log(`Analyzing '${name}' deterministically (${dataset.tables.length} structured tables)`);
    const result = runStructuredEngine(dataset, docs);
    console.log(`  ${result.findings.length} deterministic findings`);

    let findings: Finding[] = result.findings;
    if (!skipTribunal && findings.length > 0) {
      console.log(`\n[tribunal] ${findings.length} structured finding(s) stand trial`);
      findings = await tribunal(findings, docs, dataset.companyName);
      findings = findings.map((f) => ({
        ...f,
        engineStatus: f.engineStatus ?? "detected",
        aiStatus: f.tribunal?.verdict ?? "not-run",
      }));
      const verdictCounts = findings.reduce<Record<string, number>>((acc, f) => {
        const v = f.tribunal?.verdict ?? "untried";
        acc[v] = (acc[v] ?? 0) + 1;
        return acc;
      }, {});
      console.log(`  verdicts: ${JSON.stringify(verdictCounts)}`);
    } else if (skipTribunal) {
      findings = findings.map((f) => ({
        ...f,
        engineStatus: f.engineStatus ?? "detected",
        aiStatus: "not-run" as const,
      }));
      console.log("  tribunal skipped (--no-ai / --no-tribunal)");
    }

    const manifest = readDossierManifest(name);
    const meta: AnalysisMeta & { financial: { reportedProfit: number | null; adjustedProfit: number | null } } = {
      dossier: name,
      generatedAt: manifest?.analysisAsOf ?? new Date().toISOString(),
      model: skipTribunal ? "offline-deterministic" : getModel().name,
      companyName: dataset.companyName,
      fiscalPeriod: dataset.fiscalPeriod,
      public: true,
      integrity: dataset.integrity,
      stats: {
        docs: docs.length,
        units: docs.reduce((sum, doc) => sum + doc.units.length, 0),
        facts: dataset.tables.reduce((sum, table) => sum + table.rows.length, 0),
        verifiedFacts: dataset.tables.reduce((sum, table) => sum + table.rows.length, 0),
        findings: findings.filter((f) => f.tribunal?.verdict !== "acquitted").length,
        acquitted: findings.filter((f) => f.tribunal?.verdict === "acquitted").length,
      },
      financial: { reportedProfit: result.reportedProfit, adjustedProfit: result.adjustedProfit },
    };
    writeJson(path.join(dir, "facts.json"), []);
    writeJson(path.join(dir, "entities.json"), result.entities);
    writeJson(path.join(dir, "findings.json"), findings);
    writeJson(path.join(dir, "graph.json"), result.graph);
    writeJson(path.join(dir, "meta.json"), meta);
    fs.writeFileSync(path.join(dir, "report.md"), renderReport(findings, docs, meta));
    console.log(`  adjusted profit: ${result.adjustedProfit == null ? "unavailable" : `EUR ${result.adjustedProfit.toFixed(2)}`}`);
    console.log(`\n→ ${dir}/{findings,graph,meta}.json + report.md`);
    return;
  }
  console.log(`Analyzing '${name}' (${docs.length} docs) with model ${getModel().name}`);

  console.log("\n[1/6] classify");
  const classification = await classify(docs);
  console.log(`  company: ${classification.companyName} · period: ${classification.fiscalPeriod}`);
  for (const d of docs) {
    const meta = classification.docs.find((m) => m.docId === d.id);
    d.docType = meta?.docType;
    d.language = meta?.language;
    d.summary = meta?.summary;
  }
  writeJson(docsFile, docs); // enrich registry

  console.log("\n[2/6] extract facts");
  const rawFacts = await extractFacts(docs, classification);
  console.log(`  ${rawFacts.length} raw facts`);

  console.log("\n[3/6] validate citations");
  const { verified, stats } = validateFacts(rawFacts, docs);
  console.log(
    `  ${stats.verifiedFacts}/${stats.facts} facts verified · ` +
      `${stats.verifiedCitations}/${stats.citations} citations OK · ` +
      `${stats.repairedRefs} refs repaired · ${stats.droppedFacts.length} facts dropped`,
  );
  for (const d of stats.droppedFacts.slice(0, 5)) {
    console.warn(`    dropped ${d.factId}: ${d.quotes[0]?.slice(0, 60)}`);
  }

  console.log("\n[4/6] forensic engine");
  const idx = buildEntityIndex(verified, classification.companyName);
  console.log(`  ${idx.clusters.length} entity clusters (company: ${idx.companyClusterId ?? "NOT FOUND"})`);
  const ctx = { facts: verified, idx, companyName: classification.companyName };
  const engineCandidates = runEngine(ctx);

  console.log("\n[5/6] prose sweep");
  const sweepCandidates = skipSweep ? [] : await proseSweep(docs, classification.companyName);
  console.log(`  ${sweepCandidates.length} prose candidate(s)`);
  const candidates = [...engineCandidates, ...sweepCandidates];

  console.log(`\n[6/6] tribunal (${candidates.length} candidates stand trial)`);
  const findings: Finding[] = skipTribunal
    ? candidates.map((c) => ({ ...c, engineStatus: "detected" as const, aiStatus: "not-run" as const }))
    : await tribunal(candidates, docs, classification.companyName);
  const verdictCounts = findings.reduce<Record<string, number>>((acc, f) => {
    const v = f.tribunal?.verdict ?? "untried";
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  verdicts: ${JSON.stringify(verdictCounts)}`);

  const graph = buildGraph(verified, idx, findings);
  const meta: AnalysisMeta = {
    dossier: name,
    generatedAt: new Date().toISOString(),
    model: getModel().name,
    stats: {
      docs: docs.length,
      units: docs.reduce((n, d) => n + d.units.length, 0),
      facts: stats.facts,
      verifiedFacts: stats.verifiedFacts,
      findings: findings.filter((f) => f.tribunal?.verdict !== "acquitted").length,
      acquitted: findings.filter((f) => f.tribunal?.verdict === "acquitted").length,
    },
  };

  writeJson(path.join(dir, "facts.json"), verified);
  writeJson(path.join(dir, "entities.json"), idx.clusters);
  writeJson(path.join(dir, "findings.json"), findings);
  writeJson(path.join(dir, "graph.json"), graph);
  writeJson(path.join(dir, "meta.json"), { ...meta, validation: stats, classification });
  fs.writeFileSync(path.join(dir, "report.md"), renderReport(findings, docs, meta));
  console.log(`\n→ ${dir}/{facts,entities,findings,graph,meta}.json + report.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
