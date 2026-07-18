import fs from "node:fs";
import path from "node:path";
import { dataDir, readJson } from "./paths";
import type { EvidenceIndex, StructuredDataset, StructuredDatasetIndex, StructuredTable } from "./structured-types";
import type { Unit } from "./types";

function isStructuredTable(table: StructuredTable | StructuredDatasetIndex["tables"][number]): table is StructuredTable {
  return Array.isArray((table as StructuredTable).rows);
}

function safeArtifactPath(base: string, relative: string): string {
  const root = path.resolve(base);
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error(`Artifact path escapes dossier data: ${relative}`);
  return file;
}

export function loadEvidenceUnits(name: string, docId: string): Unit[] {
  const dir = dataDir(name);
  const file = path.join(dir, "evidence.json");
  const index = readJson<EvidenceIndex | Record<string, Unit[]>>(file);
  const entry = index[docId];
  if (Array.isArray(entry)) return entry;
  if (!entry) return [];
  return readJson<Unit[]>(safeArtifactPath(dir, entry.file));
}

export function loadStructuredTable(name: string, tableId: string): StructuredTable | null {
  const dir = dataDir(name);
  const index = readJson<StructuredDataset | StructuredDatasetIndex>(path.join(dir, "records.json"));
  const table = index.tables.find((candidate) => candidate.id === tableId);
  if (!table) return null;
  if (isStructuredTable(table)) return table;
  return { ...table, rows: readJson<StructuredTable["rows"]>(safeArtifactPath(dir, table.file)) };
}

export function loadStructuredDataset(name: string): StructuredDataset {
  const dir = dataDir(name);
  const index = readJson<StructuredDataset | StructuredDatasetIndex>(path.join(dir, "records.json"));
  if (index.tables.every(isStructuredTable)) return index as StructuredDataset;
  return {
    ...index,
    tables: index.tables.map((table) => {
      if (isStructuredTable(table)) return table;
      return { ...table, rows: readJson<StructuredTable["rows"]>(safeArtifactPath(dir, table.file)) };
    }),
  };
}
