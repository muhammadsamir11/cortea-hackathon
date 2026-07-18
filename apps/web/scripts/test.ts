import assert from "node:assert/strict";
import path from "node:path";
import type { DossierDoc, Fact } from "@almedia/forensic/types";
import { dataDir, readJson } from "@almedia/forensic/paths";
import { parseAmount } from "@almedia/forensic/normalize";
import { parseDelimitedLine } from "@almedia/forensic/structured-ingest";
import { loadEvidenceUnits, loadStructuredDataset } from "@almedia/forensic/artifacts";
import { normalizeAccountingRecords } from "@almedia/forensic/normalized-records";
import { buildEntityIndex } from "@almedia/forensic/engine/entities";
import { filterGraph } from "../src/app/audit/_components/money-graph/filter-graph";
import { resolveSelectionInfo } from "../src/app/audit/_components/money-graph/resolve-selection";
import type { Finding, MoneyGraph } from "@almedia/forensic/types";

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

const sampleGraph = {
  companyClusterId: "co",
  nodes: [
    { id: "co", names: ["Acme GmbH"], ibans: ["DE00"], vatIds: [], addresses: [], factIds: [] },
    { id: "a", names: ["Vendor A", "Vendor A GmbH"], ibans: ["DE11"], vatIds: [], addresses: [], factIds: ["f1"] },
    { id: "b", names: ["Vendor B"], ibans: ["DE22"], vatIds: [], addresses: [], factIds: [] },
  ],
  edges: [
    { from: "co", to: "a", total: 50_000, currency: "EUR", factIds: ["f1"], findingIds: ["find-1"] },
    { from: "co", to: "b", total: 500, currency: "EUR", factIds: [], findingIds: ["find-2"] },
  ],
};
const open = new Set(["find-1"]);
assert.equal(
  filterGraph(sampleGraph, { findingId: "all", query: "", minAmount: 10_000, riskOnly: false }, open).edges.length,
  1,
  "min amount drops small edges",
);
assert.equal(
  filterGraph(sampleGraph, { findingId: "all", query: "", minAmount: 0, riskOnly: true }, open).edges.length,
  1,
  "risk-only keeps open-finding edges",
);
assert.deepEqual(
  [...(filterGraph(sampleGraph, { findingId: "all", query: "vendor a", minAmount: 0, riskOnly: false }, open).matchedNodeIds ?? [])],
  ["a"],
  "search matches alias names",
);

{
  const findings = readJson<Finding[]>(path.join(dir, "findings.json"));
  const moneyGraph = readJson<MoneyGraph>(path.join(dir, "graph.json"));
  const filtered = {
    ...moneyGraph,
    matchedNodeIds: null as Set<string> | null,
  };
  const facts = new Map<string, import("@almedia/forensic/types").Fact>();
  const edgeInfo = resolveSelectionInfo(
    { kind: "edge", id: "edge-0" },
    filtered,
    facts,
    findings,
  );
  assert.ok(edgeInfo && edgeInfo.findings.length > 0, "edge Details resolves related findings");
  assert.ok(edgeInfo && edgeInfo.lineItems.length > 0, "edge Details resolves line items");
  assert.equal(edgeInfo?.facts.length, 0, "structured graph edges have no factIds");

  const company = moneyGraph.companyClusterId!;
  const nodeInfo = resolveSelectionInfo(
    { kind: "node", id: company },
    filtered,
    facts,
    findings,
  );
  assert.ok(nodeInfo && nodeInfo.findings.length > 0, "company node resolves findings");
  assert.ok(nodeInfo && nodeInfo.lineItems.length > 0, "company node resolves line items");

  const vendor = moneyGraph.nodes.find((n) => n.id !== company)!;
  const vendorInfo = resolveSelectionInfo(
    { kind: "node", id: vendor.id },
    filtered,
    facts,
    findings,
  );
  assert.ok(vendorInfo && vendorInfo.findings.length > 0, "vendor node resolves findings");
  assert.ok(
    vendorInfo &&
      vendorInfo.lineItems.every((item) =>
        vendor.names.some((name) => name.toLowerCase() === (item.counterparty ?? "").toLowerCase()),
      ),
    "vendor node line items match counterparty",
  );
}

console.log("Parser and ingestion assertions passed.");


