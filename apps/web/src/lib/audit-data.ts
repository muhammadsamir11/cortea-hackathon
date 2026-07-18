import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  dossierSource,
  readDossierManifest,
  repoRoot,
} from "@almedia/forensic/paths";
import {
  loadEvidenceUnits,
  loadStructuredTable,
} from "@almedia/forensic/artifacts";
import {
  hasSqliteArtifacts,
  listSqliteTables,
  loadSqliteEvidenceWindow,
  loadSqliteTablePage,
} from "@almedia/forensic/sqlite-store";
import type {
  StructuredDataset,
  StructuredDatasetIndex,
  StructuredTable,
} from "@almedia/forensic/structured-types";
import type {
  DossierDoc,
  EntityCluster,
  Fact,
  Finding,
  MoneyGraph,
  Unit,
} from "@almedia/forensic/types";

export interface DossierData {
  name: string;
  docs: DossierDoc[];
  facts: Fact[];
  findings: Finding[];
  entities: EntityCluster[];
  graph: MoneyGraph;
  meta: Record<string, unknown> | null;
}

export interface EvidencePacket {
  document: DossierDoc;
  units: Unit[];
  activeRef: string | null;
  table?: {
    name: string;
    columns: string[];
    rows: StructuredTable["rows"];
  };
}

export interface RecordsPage {
  table: Pick<
    StructuredTable,
    "id" | "name" | "docId" | "relativePath" | "columns" | "source" | "sheet"
  >;
  rows: StructuredTable["rows"];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

const dataRoot = () => path.join(repoRoot(), "data");

function safeName(name: string): boolean {
  return /^[a-z0-9_-]+$/i.test(name);
}

function readIf<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function listDossiers(): string[] {
  const root = dataRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => {
      if (!fs.existsSync(path.join(root, name, "documents.json"))) return false;
      const manifest = readDossierManifest(name);
      const meta = readIf<{ public?: boolean } | null>(
        path.join(root, name, "meta.json"),
        null,
      );
      return manifest?.public === true || meta?.public === true;
    })
    .sort(
      (a, b) =>
        Number(b === "muster-verpackungen") -
          Number(a === "muster-verpackungen") || a.localeCompare(b),
    );
}

export function loadDossier(name: string): DossierData | null {
  if (!safeName(name)) return null;
  const dir = path.join(dataRoot(), name);
  if (!fs.existsSync(path.join(dir, "documents.json"))) return null;
  return {
    name,
    docs: readIf<DossierDoc[]>(path.join(dir, "documents.json"), []),
    facts: readIf<Fact[]>(path.join(dir, "facts.json"), []),
    findings: readIf<Finding[]>(path.join(dir, "findings.json"), []),
    entities: readIf<EntityCluster[]>(path.join(dir, "entities.json"), []),
    graph: readIf<MoneyGraph>(path.join(dir, "graph.json"), {
      nodes: [],
      edges: [],
    }),
    meta: readIf<Record<string, unknown> | null>(
      path.join(dir, "meta.json"),
      null,
    ),
  };
}

export function loadEvidence(
  name: string,
  docId: string,
  ref?: string,
): EvidencePacket | null {
  const dossier = loadDossier(name);
  const document = dossier?.docs.find((doc) => doc.id === docId);
  if (!dossier || !document) return null;
  if (hasSqliteArtifacts(name)) {
    const packet = loadSqliteEvidenceWindow(name, docId, ref);
    if (!packet) return null;
    return { document, ...packet };
  }
  const allUnits = fs.existsSync(path.join(dataRoot(), name, "evidence.json"))
    ? loadEvidenceUnits(name, docId)
    : document.units;
  if (!allUnits.length) return { document, units: [], activeRef: null };
  const target = Math.max(
    0,
    allUnits.findIndex((unit) => unit.ref === ref),
  );
  const radius = document.kind === "pdf" ? 0 : 4;
  const dataset = readIf<StructuredDataset | StructuredDatasetIndex | null>(
    path.join(dataRoot(), name, "records.json"),
    null,
  );
  const targetRef = ref ?? allUnits[target]?.ref ?? "";
  const tableRegistry = dataset?.tables.find(
    (table) =>
      table.docId === docId &&
      (table.sheet
        ? targetRef.startsWith(`${table.sheet}!`)
        : targetRef.startsWith(`${table.name}!`)),
  );
  const structuredTable = tableRegistry
    ? loadStructuredTable(name, tableRegistry.id)
    : null;
  const structuredIndex =
    structuredTable?.rows.findIndex(
      (row) => row.citation.ref === (ref ?? allUnits[target]?.ref),
    ) ?? -1;
  return {
    document,
    units: radius
      ? allUnits.slice(Math.max(0, target - radius), target + radius + 1)
      : [],
    activeRef: allUnits[target]?.ref ?? allUnits[0]?.ref ?? null,
    table:
      structuredTable && structuredIndex >= 0
        ? {
            name: structuredTable.name,
            columns: structuredTable.columns,
            rows: structuredTable.rows.slice(
              Math.max(0, structuredIndex - 4),
              structuredIndex + 5,
            ),
          }
        : undefined,
  };
}

export function loadRecords(
  name: string,
  tableId: string,
  requestedPage = 1,
  requestedPageSize = 50,
): RecordsPage | null {
  if (!safeName(name) || !tableId) return null;
  if (hasSqliteArtifacts(name)) {
    return loadSqliteTablePage(
      name,
      tableId,
      requestedPage,
      requestedPageSize,
    );
  }
  const file = path.join(dataRoot(), name, "records.json");
  if (!fs.existsSync(file)) return null;
  const table = loadStructuredTable(name, tableId);
  if (!table) return null;
  const pageSize = Math.min(
    200,
    Math.max(1, Math.trunc(requestedPageSize) || 50),
  );
  const totalPages = Math.max(1, Math.ceil(table.rows.length / pageSize));
  const page = Math.min(
    totalPages,
    Math.max(1, Math.trunc(requestedPage) || 1),
  );
  const start = (page - 1) * pageSize;
  const { rows, ...registry } = table;
  const {
    rowCount: _rowCount,
    file: _file,
    ...publicRegistry
  } = registry as typeof registry & { rowCount?: number; file?: string };
  return {
    table: publicRegistry,
    rows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    totalRows: rows.length,
    totalPages,
  };
}

export function listRecordTables(
  name: string,
): Array<
  Pick<StructuredTable, "id" | "name" | "columns" | "source" | "sheet"> & {
    rowCount: number;
  }
> {
  if (!safeName(name)) return [];
  if (hasSqliteArtifacts(name)) {
    return listSqliteTables(name).map((table) => ({
      id: table.id,
      name: table.name,
      columns: table.columns,
      source: table.source,
      sheet: table.sheet,
      rowCount: table.rowCount,
    }));
  }
  const file = path.join(dataRoot(), name, "records.json");
  const dataset = readIf<StructuredDataset | StructuredDatasetIndex | null>(
    file,
    null,
  );
  return (
    dataset?.tables.map((table) => ({
      id: table.id,
      name: table.name,
      columns: table.columns,
      source: table.source,
      sheet: table.sheet,
      rowCount: "rows" in table ? table.rows.length : table.rowCount,
    })) ?? []
  );
}

export function dossierFilePath(
  name: string,
  docId: string,
): { file: string; filename: string } | null {
  const dossier = loadDossier(name);
  const doc = dossier?.docs.find((candidate) => candidate.id === docId);
  if (!dossier || !doc) return null;
  const sourceRoot = path.resolve(dossierSource(name).sourceRoot);
  const relativePath = doc.relativePath ?? doc.filename;
  const file = path.resolve(sourceRoot, relativePath);
  if (file !== sourceRoot && !file.startsWith(`${sourceRoot}${path.sep}`))
    return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return { file, filename: doc.filename };
}
