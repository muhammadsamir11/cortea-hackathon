import assert from "node:assert/strict";
import path from "node:path";
import type { DossierDoc } from "@almedia/forensic/types";
import { dataDir, readJson } from "@almedia/forensic/paths";
import { runStructuredEngine } from "@almedia/forensic/structured-engine";
import { loadEvidenceUnits, loadStructuredDataset } from "@almedia/forensic/artifacts";
import fs from "node:fs";

const dossier = "muster-verpackungen";
const dir = dataDir(dossier);
const docs = readJson<DossierDoc[]>(path.join(dir, "documents.json"));
const dataset = loadStructuredDataset(dossier);

for (const doc of docs) doc.units = loadEvidenceUnits(dossier, doc.id);

function tableRows(id: string): number {
  const table = dataset.tables.find((candidate) => candidate.id === id);
  assert.ok(table, `missing table ${id}`);
  return table.rows.length;
}

assert.equal(docs.length, 35, "all public exercise source files are registered");
assert.equal(tableRows("Sachkonten"), 43);
assert.equal(tableRows("Sachkontobuchungen"), 20_258);
assert.equal(tableRows("Kunden"), 160);
assert.equal(tableRows("Kundenbuchungen"), 3_749);
assert.equal(tableRows("Lieferanten"), 143);
assert.equal(tableRows("Lieferantenbuchungen"), 2_584);
assert.equal(tableRows("Anlagen"), 197);
assert.equal(tableRows("Anlagenbuchungen"), 56);
assert.equal(dataset.integrity.checks.filter((check) => check.id.startsWith("hash:")).length, 8);
assert.ok(dataset.integrity.checks.every((check) => check.ok), "every integrity check must pass");

const first = runStructuredEngine(dataset, docs);
const second = runStructuredEngine(dataset, docs);
assert.deepEqual(second, first, "two offline runs must be byte-for-byte deterministic");
assert.equal(first.findings.length, 4, "exactly the four planted schemes are detected");

const byCheck = new Map(first.findings.map((finding) => [finding.checkId, finding]));
assert.equal(byCheck.get("vendorControls")?.amountInvolved, 248_000);
assert.equal(byCheck.get("vendorControls")?.calculations?.find((item) => item.label === "Gross cash paid")?.value, 295_120);
assert.equal(byCheck.get("vendorControls")?.lineItems?.length, 5);
assert.equal(byCheck.get("capitalizedRepairs")?.amountInvolved, 150_800);
assert.equal(byCheck.get("capitalizedRepairs")?.lineItems?.length, 6);
assert.equal(byCheck.get("cutoff")?.amountInvolved, 192_000);
assert.equal(byCheck.get("cutoff")?.lineItems?.length, 8);
assert.equal(byCheck.get("splitPayments")?.amountInvolved, 39_040);
assert.equal(byCheck.get("splitPayments")?.lineItems?.length, 4);
const split = byCheck.get("splitPayments");
assert.ok(split, "splitPayments finding required");
const splitText = JSON.stringify(split);
assert.ok(
  split.citations.some((citation) => citation.docId === "sachkonten-sachkontobuchungen"),
  "F4 must cite Sachkontobuchungen",
);
assert.ok(splitText.includes("SAMMEL-200007"), "F4 must reference beleg SAMMEL-200007");
assert.equal(first.reportedProfit, 2_599_841.8);
assert.equal(first.adjustedProfit, 2_257_041.8);
const report = fs.readFileSync(path.join(dir, "report.md"), "utf8");
assert.match(report, /Generated 2026-02-04T00:00:00\.000Z/);
for (const expected of ["EUR 248,000.00", "EUR 295,120.00", "EUR 150,800.00", "EUR 192,000.00", "EUR 39,040.00", "EUR 2,257,041.80"]) {
  assert.ok(report.includes(expected), `complete report must include ${expected}`);
}

// These markers identify the seven legitimate decoys described by the sealed test fixture.
// They must never enter a finding, calculation, line item, or citation.
const decoyMarkers = [
  "ER901435", // productive EUR 480,000 machine
  "209110", // similarly named vendor A
  "209111", // similarly named vendor B
  "209112", // Vega's approved setup
  "440020", // customer rebates
  "209113", // disclosed related party
  "GJ6602869", // documented disposal
  "040000-000005", // disposed asset
  "AR502040", // invoice
  "SG502041", // matching credit note
];
const findingText = JSON.stringify(first.findings);
for (const marker of decoyMarkers) {
  assert.ok(!findingText.includes(marker), `decoy ${marker} must remain clear`);
}

console.log("Muster benchmark passed: 35 files, 8 verified exports, 4 schemes, 0 decoy hits.");
