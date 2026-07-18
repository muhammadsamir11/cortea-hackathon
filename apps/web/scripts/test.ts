import assert from "node:assert/strict";
import path from "node:path";
import type { DossierDoc, Fact } from "@almedia/forensic/types";
import { dataDir, readJson } from "@almedia/forensic/paths";
import { parseAmount } from "@almedia/forensic/normalize";
import { parseDelimitedLine } from "@almedia/forensic/structured-ingest";
import { loadEvidenceUnits, loadStructuredDataset } from "@almedia/forensic/artifacts";
import { normalizeAccountingRecords } from "@almedia/forensic/normalized-records";
import { buildEntityIndex } from "@almedia/forensic/engine/entities";

assert.deepEqual(parseDelimitedLine('"A;B";"C""D";-1.234,56'), ["A;B", 'C"D', "-1.234,56"]);
assert.equal(parseAmount("-1.234,56 EUR"), -1_234.56);
assert.equal(parseAmount("295.120,00"), 295_120);
assert.equal(parseAmount("39,040.00"), 39_040);

const dir = dataDir("muster-verpackungen");
const docs = readJson<DossierDoc[]>(path.join(dir, "documents.json"));
const evidence = Object.fromEntries(docs.map((doc) => [doc.id, loadEvidenceUnits("muster-verpackungen", doc.id)]));
const dataset = loadStructuredDataset("muster-verpackungen");
const normalized = normalizeAccountingRecords(dataset, docs.map((doc) => ({ ...doc, units: evidence[doc.id] ?? [] })));

assert.equal(new Set(docs.map((doc) => doc.id)).size, docs.length, "recursive source IDs are unique");
assert.ok(docs.every((doc) => doc.relativePath && !path.isAbsolute(doc.relativePath)), "every source path is relative");
assert.ok(docs.some((doc) => doc.encoding === "windows-1252"), "Windows-1252 sources are detected");
assert.ok(
  Object.values(evidence).flat().some((unit) => /Kälte|Reparatur|über/i.test(unit.text)),
  "decoded evidence preserves German umlauts",
);
assert.ok(
  evidence[docs.find((doc) => doc.relativePath === "Sachkonten/Sachkontobuchungen.txt")!.id]
    ?.some((unit) => unit.ref === "Sachkontobuchungen!r.20207"),
  "ledger citations preserve exact row references",
);
assert.ok(dataset.tables.some((table) => table.source === "xlsx" && table.rows.length > 0), "XLSX rows are imported");
assert.ok(docs.some((doc) => doc.kind === "pdf" && (doc.unitCount ?? 0) > 0), "PDF text is available");
assert.ok(docs.some((doc) => doc.kind === "docx" && (doc.unitCount ?? 0) > 0), "DOCX text is available");
assert.equal(normalized.ledger.length, 20_258, "typed ledger records retain every signed entry");
assert.ok(normalized.ledger.some((entry) => entry.signedAmount < 0), "typed ledger records preserve negative signs");
assert.ok(normalized.invoices.every((invoice) => invoice.source.ref && invoice.serviceDate), "normalized invoices remain source-verified");
assert.equal(normalized.policyTerms[0]?.amount, 10_000, "policy thresholds are normalized with a verified source");

const entityFacts: Fact[] = [
  { id: "entity-a", docId: "master", kind: "entity", entityName: "Meyer Technik GmbH", entityVatId: "DE111", citations: [], verified: true },
  { id: "entity-b", docId: "master", kind: "entity", entityName: "Meyer Technik GmbH", entityVatId: "DE222", citations: [], verified: true },
  { id: "entity-c", docId: "master", kind: "entity", entityName: "Mayer Technik GmbH", entityVatId: "DE333", citations: [], verified: true },
];
const identity = buildEntityIndex(entityFacts, "Unrelated Company");
assert.equal(identity.clusters.length, 3, "conflicting authoritative VAT IDs prevent automatic merging");
assert.equal(identity.resolveName("Meyer Technik GmbH"), null, "an ambiguous name never resolves automatically");
assert.ok(identity.reviewSuggestions.length > 0, "fuzzy names are emitted only as review suggestions");

console.log("Parser and ingestion assertions passed.");
