import path from "node:path";
import { ingestDossier, estimateTokens } from "@almedia/forensic/ingest";
import { dataDir, dossierSource, writeJson } from "@almedia/forensic/paths";
import { parseStructuredDataset } from "@almedia/forensic/structured-ingest";
import crypto from "node:crypto";
import type { EvidenceIndex, StructuredDatasetIndex } from "@almedia/forensic/structured-types";

function artifactName(prefix: string, value: string): string {
  return `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}.json`;
}

async function main() {
  const name = process.argv[2] ?? "sample";
  const { sourceRoot: dir, manifest } = dossierSource(name);
  console.log(`Ingesting dossier '${name}' from ${dir}`);
  const docs = await ingestDossier(dir);
  const units = docs.reduce((n, d) => n + d.units.length, 0);
  const tokens = manifest ? 0 : estimateTokens(docs);
  for (const d of docs) {
    console.log(
      `  ${d.id} (${d.kind}) — ${d.units.length} units${d.needsOcr ? "  ⚠ NEEDS OCR" : ""}`,
    );
  }
  console.log(`${docs.length} docs, ${units} units${manifest ? " (structured dossier)" : `, ~${tokens.toLocaleString()} tokens`}`);
  if (!manifest && tokens > 180_000) {
    console.warn("⚠ dossier exceeds ~180k tokens — full-context calls may need condensing");
  }
  const outDir = dataDir(name);
  if (manifest) {
    const records = parseStructuredDataset(dir, manifest, docs);
    for (const doc of docs) {
      doc.language = "de";
      const table = records.tables.find((candidate) => candidate.docId === doc.id);
      doc.docType = table
        ? `${table.source.toUpperCase()} table`
        : doc.kind === "pdf"
          ? "Supporting report"
          : doc.kind === "docx"
            ? "Audit policy"
            : doc.kind === "xml"
              ? "GDPdU descriptor"
              : "Supporting document";
      doc.summary = table
        ? `${table.name}: ${table.rows.length.toLocaleString("en-US")} structured records with row-level citations.`
        : `${doc.unitCount ?? doc.units.length} citable ${doc.kind.toUpperCase()} evidence units imported deterministically.`;
    }
    const registry = docs.map((doc) => ({ ...doc, units: [] }));
    const evidence: EvidenceIndex = {};
    for (const doc of docs) {
      const file = `evidence/${artifactName("doc", doc.id)}`;
      writeJson(path.join(outDir, file), doc.units);
      evidence[doc.id] = { file, count: doc.units.length };
    }
    const tableIndex: StructuredDatasetIndex["tables"] = records.tables.map((table) => {
      const file = `records/${artifactName("table", table.id)}`;
      writeJson(path.join(outDir, file), table.rows);
      const { rows, ...tableRegistry } = table;
      return { ...tableRegistry, rowCount: rows.length, file };
    });
    const recordIndex: StructuredDatasetIndex = { ...records, tables: tableIndex };
    writeJson(path.join(outDir, "documents.json"), registry);
    writeJson(path.join(outDir, "evidence.json"), evidence);
    writeJson(path.join(outDir, "records.json"), recordIndex);
    writeJson(path.join(outDir, "ingestion.json"), {
      dossier: name,
      sourceRoot: path.relative(process.cwd(), dir),
      generatedAt: new Date().toISOString(),
      docs: docs.length,
      units: docs.reduce((sum, doc) => sum + doc.units.length, 0),
      integrity: records.integrity,
    });
    for (const check of records.integrity.checks) {
      console.log(`  ${check.ok ? "✓" : "✗"} ${check.label}: ${check.detail}`);
    }
    for (const warning of records.integrity.warnings) console.warn(`  ⚠ ${warning}`);
    console.log(`→ ${outDir}/{documents,evidence,records,ingestion}.json`);
    if (!records.integrity.ok) process.exitCode = 1;
  } else {
    const out = path.join(outDir, "documents.json");
    writeJson(out, docs);
    console.log(`→ ${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
