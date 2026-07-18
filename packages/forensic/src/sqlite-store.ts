import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import * as XLSX from "xlsx";
import { ingestFile } from "./ingest";
import { parseAmount } from "./normalize";
import { dataDir, readJson, writeJson } from "./paths";
import { parseDelimitedLine } from "./structured-ingest";
import type {
  DossierManifest,
  EvidenceIndex,
  IntegrityCheck,
  StructuredDatasetIndex,
  StructuredRow,
  StructuredTable,
} from "./structured-types";
import type { Citation, DossierDoc, Unit } from "./types";

const SQLITE_FILE = "records.sqlite";
const BATCH_SIZE = 10_000;

const EXT_KIND: Record<string, DossierDoc["kind"]> = {
  ".pdf": "pdf",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".csv": "csv",
  ".eml": "email",
  ".docx": "docx",
  ".txt": "text",
  ".md": "text",
  ".xml": "xml",
  ".dtd": "xml",
};

interface DescriptorTable {
  directory: string;
  relativePath: string;
  name: string;
  columns: string[];
}

interface SqliteTableRow {
  id: string;
  name: string;
  doc_id: string;
  relative_path: string;
  columns_json: string;
  source: StructuredTable["source"];
  sheet: string | null;
  row_count: number;
}

interface EvidenceRow {
  ref: string;
  text: string;
  page: number | null;
  sheet: string | null;
  start_line: number | null;
  table_id: string | null;
  row_number: number | null;
  cells_json: string | null;
}

function slug(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function walk(root: string): string[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const full = path.join(root, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    })
    .sort((a, b) => a.localeCompare(b));
}

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function detectEncoding(file: string): "utf-8" | "windows-1252" {
  const descriptor = fs.openSync(file, "r");
  try {
    const sample = Buffer.alloc(64 * 1024);
    const bytes = fs.readSync(descriptor, sample, 0, sample.length, 0);
    new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, bytes));
    return "utf-8";
  } catch {
    return "windows-1252";
  } finally {
    fs.closeSync(descriptor);
  }
}

async function* linesOf(
  file: string,
  encoding: "utf-8" | "windows-1252",
): AsyncGenerator<string> {
  const decoder = new TextDecoder(encoding);
  let pending = "";
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    pending += decoder.decode(chunk as Buffer, { stream: true });
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1);
      yield line;
      newline = pending.indexOf("\n");
    }
  }
  pending += decoder.decode();
  if (pending.length > 0) yield pending.replace(/\r$/, "");
}

function parseIndexXml(xml: string, directory: string): DescriptorTable[] {
  return [...xml.matchAll(/<Table>([\s\S]*?)<\/Table>/g)].map((match) => {
    const block = match[1]!;
    const url = block.match(/<URL>(.*?)<\/URL>/)?.[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    if (!url || !name) throw new Error(`${directory}/index.xml has a table without URL or Name`);
    return {
      directory,
      relativePath: `${directory}/${url}`,
      name,
      columns: [...block.matchAll(/<VariableColumn>[\s\S]*?<Name>(.*?)<\/Name>/g)].map(
        (column) => column[1]!,
      ),
    };
  });
}

function discoverDescriptors(sourceRoot: string): DescriptorTable[] {
  return walk(sourceRoot)
    .filter((file) => path.basename(file).toLowerCase() === "index.xml")
    .flatMap((file) => {
      const directory = relative(sourceRoot, path.dirname(file));
      const decoded = new TextDecoder(detectEncoding(file)).decode(fs.readFileSync(file));
      return parseIndexXml(decoded, directory);
    });
}

function bestHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let score = -1;
  for (let index = 0; index < Math.min(rows.length, 12); index++) {
    const cells = rows[index]!.map((cell) => String(cell ?? "").trim()).filter(Boolean);
    const candidate = cells.length >= 2 ? new Set(cells).size : 0;
    if (candidate > score) {
      score = candidate;
      best = index;
    }
  }
  return best;
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -65536;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    CREATE TABLE tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      columns_json TEXT NOT NULL,
      source TEXT NOT NULL,
      sheet TEXT,
      row_count INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE evidence (
      id INTEGER PRIMARY KEY,
      doc_id TEXT NOT NULL,
      ref TEXT NOT NULL,
      text TEXT NOT NULL,
      kind TEXT NOT NULL,
      page INTEGER,
      sheet TEXT,
      start_line INTEGER,
      table_id TEXT,
      row_number INTEGER,
      cells_json TEXT
    ) STRICT;
    CREATE UNIQUE INDEX evidence_ref ON evidence(doc_id, ref);
    CREATE INDEX evidence_table_row ON evidence(table_id, row_number);
    CREATE VIRTUAL TABLE evidence_fts USING fts5(
      text,
      content='evidence',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
}

function insertEvidenceStatement(database: DatabaseSync): StatementSync {
  return database.prepare(`
    INSERT INTO evidence (
      doc_id, ref, text, kind, page, sheet, start_line, table_id, row_number, cells_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
}

function insertUnit(
  statement: StatementSync,
  docId: string,
  unit: Unit,
): void {
  statement.run(
    docId,
    unit.ref,
    unit.text,
    "unit",
    unit.page ?? null,
    unit.sheet ?? null,
    unit.startLine ?? null,
    null,
    null,
    null,
  );
}

function insertStructuredRow(
  statement: StatementSync,
  docId: string,
  tableId: string,
  rowNumber: number,
  raw: string,
  cells: string[],
  sheet?: string,
): void {
  statement.run(
    docId,
    `${sheet ?? tableId}!r.${rowNumber}`,
    raw,
    "row",
    null,
    sheet ?? null,
    rowNumber,
    tableId,
    rowNumber,
    JSON.stringify(cells),
  );
}

function begin(database: DatabaseSync): void {
  database.exec("BEGIN");
}

function commit(database: DatabaseSync): void {
  database.exec("COMMIT");
}

function maybeRotateTransaction(database: DatabaseSync, inserted: number): void {
  if (inserted > 0 && inserted % BATCH_SIZE === 0) {
    commit(database);
    begin(database);
  }
}

function protocolExpectation(
  text: string,
  relativePath: string,
): { rows: number | null; sha256: string | null } {
  const candidates = [relativePath, relativePath.replaceAll("/", "\\")];
  const matched = candidates
    .map((candidate) => ({ candidate, index: text.indexOf(candidate) }))
    .find((value) => value.index >= 0);
  const index = matched?.index ?? -1;
  if (index < 0) return { rows: null, sha256: null };
  const tail = text.slice(index + (matched?.candidate.length ?? relativePath.length), index + (matched?.candidate.length ?? relativePath.length) + 360);
  const rowToken = tail.match(/^\s*([\d.]+)/)?.[1];
  const rows = rowToken ? Number(rowToken.replaceAll(".", "")) : Number.NaN;
  const hashStart = tail.search(/[a-f0-9]{20,}/i);
  const hashParts = hashStart >= 0 ? (tail.slice(hashStart).match(/[a-f0-9]{6,}/gi) ?? []) : [];
  const sha256 = hashParts.join("").slice(0, 64);
  return {
    rows: Number.isFinite(rows) ? rows : null,
    sha256: sha256.length === 64 ? sha256 : null,
  };
}

function tableIndex(database: DatabaseSync): StructuredDatasetIndex["tables"] {
  const rows = database
    .prepare("SELECT * FROM tables ORDER BY relative_path, name")
    .all() as unknown as SqliteTableRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    docId: row.doc_id,
    relativePath: row.relative_path,
    columns: JSON.parse(row.columns_json) as string[],
    source: row.source,
    sheet: row.sheet ?? undefined,
    rowCount: row.row_count,
    storage: "sqlite",
  }));
}

function sourceFingerprint(docs: DossierDoc[]): string {
  return crypto
    .createHash("sha256")
    .update(
      docs
        .map((doc) => `${doc.relativePath ?? doc.filename}:${doc.sha256 ?? ""}`)
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

export interface SqliteIngestResult {
  documents: DossierDoc[];
  records: StructuredDatasetIndex;
  sourceFingerprint: string;
}

export async function ingestStructuredDossierSqlite(
  name: string,
  sourceRoot: string,
  manifest: DossierManifest,
): Promise<SqliteIngestResult> {
  const outDir = dataDir(name);
  const databaseFile = path.join(outDir, SQLITE_FILE);
  if (fs.existsSync(databaseFile)) fs.rmSync(databaseFile);
  const database = new DatabaseSync(databaseFile);
  createSchema(database);
  const insertEvidence = insertEvidenceStatement(database);
  const insertTable = database.prepare(`
    INSERT INTO tables (id, name, doc_id, relative_path, columns_json, source, sheet)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTableCount = database.prepare("UPDATE tables SET row_count = ? WHERE id = ?");

  const descriptors = discoverDescriptors(sourceRoot);
  const structuredPaths = new Set(descriptors.map((table) => table.relativePath));
  const docs: DossierDoc[] = [];
  const files = walk(sourceRoot).filter((file) => EXT_KIND[path.extname(file).toLowerCase()]);

  begin(database);
  for (const file of files) {
    const relativePath = relative(sourceRoot, file);
    const ext = path.extname(file).toLowerCase();
    const kind = EXT_KIND[ext]!;
    const isDelimitedTable = structuredPaths.has(relativePath) || (relativePath.startsWith("Begleitdokumente/") && ext === ".csv");
    const sha256 = await sha256File(file);
    if (isDelimitedTable) {
      docs.push({
        id: slug(relativePath),
        filename: path.basename(file),
        relativePath,
        kind,
        encoding: detectEncoding(file),
        sha256,
        units: [],
        unitCount: 0,
      });
      continue;
    }
    const ingested = await ingestFile(file, sourceRoot);
    if (!ingested) continue;
    ingested.sha256 = sha256;
    for (const unit of ingested.units) insertUnit(insertEvidence, ingested.id, unit);
    docs.push(ingested);
  }
  commit(database);

  const docsByPath = new Map(docs.map((doc) => [doc.relativePath, doc]));
  let ledgerSum = Number.NaN;
  for (const descriptor of descriptors) {
    const doc = docsByPath.get(descriptor.relativePath);
    if (!doc) throw new Error(`No document registered for ${descriptor.relativePath}`);
    insertTable.run(
      descriptor.name,
      descriptor.name,
      doc.id,
      descriptor.relativePath,
      JSON.stringify(descriptor.columns),
      "gdpdu",
      null,
    );
    const file = path.join(sourceRoot, descriptor.relativePath);
    const encoding = detectEncoding(file);
    let rowNumber = 0;
    let runningLedgerSum = 0;
    const amountIndex = descriptor.columns.indexOf("BUCHUNGSBETRAG");
    begin(database);
    for await (const raw of linesOf(file, encoding)) {
      if (!raw.length) continue;
      rowNumber++;
      const cells = parseDelimitedLine(raw);
      insertStructuredRow(insertEvidence, doc.id, descriptor.name, rowNumber, raw, cells);
      if (descriptor.name === "Sachkontobuchungen" && amountIndex >= 0) {
        runningLedgerSum += parseAmount(cells[amountIndex]) ?? 0;
      }
      maybeRotateTransaction(database, rowNumber);
    }
    commit(database);
    updateTableCount.run(rowNumber, descriptor.name);
    doc.unitCount = rowNumber;
    doc.firstRef = rowNumber ? `${descriptor.name}!r.1` : undefined;
    doc.docType = "GDPdU table";
    doc.summary = `${descriptor.name}: ${rowNumber.toLocaleString("en-US")} structured records with row-level citations.`;
    if (descriptor.name === "Sachkontobuchungen") ledgerSum = runningLedgerSum;
  }

  const supportDir = path.join(sourceRoot, "Begleitdokumente");
  if (fs.existsSync(supportDir)) {
    for (const filename of fs.readdirSync(supportDir).filter((value) => value.toLowerCase().endsWith(".csv")).sort()) {
      const relativePath = `Begleitdokumente/${filename}`;
      const doc = docsByPath.get(relativePath);
      if (!doc) continue;
      const file = path.join(supportDir, filename);
      const iterator = linesOf(file, detectEncoding(file))[Symbol.asyncIterator]();
      const header = await iterator.next();
      const columns = parseDelimitedLine(header.value ?? "");
      const tableId = filename.replace(/\.csv$/i, "");
      insertTable.run(tableId, tableId, doc.id, relativePath, JSON.stringify(columns), "csv", null);
      let rowNumber = 1;
      begin(database);
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        if (!next.value.length) continue;
        rowNumber++;
        const cells = parseDelimitedLine(next.value);
        insertStructuredRow(insertEvidence, doc.id, tableId, rowNumber, next.value, cells);
        maybeRotateTransaction(database, rowNumber);
      }
      commit(database);
      const count = Math.max(0, rowNumber - 1);
      updateTableCount.run(count, tableId);
      doc.unitCount = count;
      doc.firstRef = count ? `${tableId}!r.2` : undefined;
      doc.docType = "CSV table";
      doc.summary = `${tableId}: ${count.toLocaleString("en-US")} structured records with row-level citations.`;
    }

    for (const filename of fs.readdirSync(supportDir).filter((value) => value.toLowerCase().endsWith(".xlsx")).sort()) {
      const relativePath = `Begleitdokumente/${filename}`;
      const doc = docsByPath.get(relativePath);
      if (!doc) continue;
      const workbook = XLSX.read(fs.readFileSync(path.join(supportDir, filename)), { type: "buffer" });
      let documentRows = 0;
      for (const sheet of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheet];
        if (!worksheet) continue;
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: "" });
        const headerIndex = bestHeaderRow(matrix);
        const columns = (matrix[headerIndex] ?? []).map(
          (cell, index) => String(cell ?? "").trim() || `COL_${index + 1}`,
        );
        const tableId = `${filename.replace(/\.xlsx$/i, "")}:${sheet}`;
        insertTable.run(tableId, tableId, doc.id, relativePath, JSON.stringify(columns), "xlsx", sheet);
        let count = 0;
        begin(database);
        for (let index = headerIndex + 1; index < matrix.length; index++) {
          const cells = matrix[index]!.map((cell) => String(cell ?? "").trim());
          if (!cells.some(Boolean)) continue;
          const rowNumber = index + 1;
          const raw = cells.join(" | ");
          insertStructuredRow(insertEvidence, doc.id, tableId, rowNumber, raw, cells, sheet);
          count++;
        }
        commit(database);
        updateTableCount.run(count, tableId);
        documentRows += count;
        doc.firstRef ??= count ? `${sheet}!r.${headerIndex + 2}` : undefined;
      }
      doc.unitCount = documentRows;
      doc.docType = "XLSX table";
      doc.summary = `${documentRows.toLocaleString("en-US")} structured workbook rows with sheet-level citations.`;
    }
  }

  database.exec("INSERT INTO evidence_fts(evidence_fts) VALUES('rebuild')");

  for (const doc of docs) {
    doc.language = "de";
    if (!doc.docType) {
      doc.docType = doc.kind === "pdf" ? "Supporting report" : doc.kind === "docx" ? "Audit policy" : doc.kind === "xml" ? "GDPdU descriptor" : "Supporting document";
      doc.summary ??= `${doc.unitCount ?? doc.units.length} citable ${doc.kind.toUpperCase()} evidence units imported.`;
    }
    doc.units = [];
  }

  const protocolDoc = docs.find((doc) => doc.relativePath?.endsWith("Exportprotokoll_GDPdU_2025.pdf"));
  const protocolText = protocolDoc
    ? (database.prepare("SELECT text FROM evidence WHERE doc_id = ? ORDER BY id").all(protocolDoc.id) as Array<{ text: string }>).map((row) => row.text).join("\n")
    : "";
  const checks: IntegrityCheck[] = [];
  for (const descriptor of descriptors) {
    const doc = docsByPath.get(descriptor.relativePath)!;
    const row = database.prepare("SELECT row_count FROM tables WHERE id = ?").get(descriptor.name) as { row_count: number };
    const expected = protocolExpectation(protocolText, descriptor.relativePath);
    checks.push({
      id: `rows:${descriptor.name}`,
      label: `${descriptor.name} record count`,
      ok: expected.rows == null || expected.rows === row.row_count,
      detail: expected.rows == null ? `${row.row_count} parsed; protocol count unavailable` : `${row.row_count} parsed / ${expected.rows} expected`,
    });
    checks.push({
      id: `hash:${descriptor.name}`,
      label: `${descriptor.name} SHA-256`,
      ok: expected.sha256 == null || expected.sha256 === doc.sha256,
      detail: expected.sha256 == null ? "protocol hash unavailable" : expected.sha256 === doc.sha256 ? "matches export protocol" : "does not match export protocol",
    });
  }
  checks.push({
    id: "ledger:balanced",
    label: "General ledger balances",
    ok: Number.isFinite(ledgerSum) && Math.abs(ledgerSum) < 0.01,
    detail: Number.isFinite(ledgerSum) ? `signed row sum EUR ${ledgerSum.toFixed(2)}` : "ledger unavailable",
  });
  const reconciliation = recordsTableId(database, "Abstimmung_Nebenbuecher_HB_2025:");
  if (reconciliation) {
    const differences = database.prepare(`
      SELECT text FROM evidence
      WHERE table_id = ? AND text LIKE 'Differenz%'
      ORDER BY row_number
    `).all(reconciliation) as Array<{ text: string }>;
    const reconciled =
      differences.length === 2 &&
      differences.every((row) => /\|\s*(?:-|0(?:[.,]0+)?)\s*\|.*keine/i.test(row.text));
    checks.push({
      id: "subledgers:reconciled",
      label: "Subledgers reconcile to the general ledger",
      ok: reconciled,
      detail: reconciled ? "debtor and creditor differences are zero" : "reconciliation differences require review",
    });
  } else {
    checks.push({
      id: "subledgers:reconciled",
      label: "Subledgers reconcile to the general ledger",
      ok: false,
      detail: "reconciliation workbook unavailable",
    });
  }

  const warnings = docs.filter((doc) => doc.needsOcr).map((doc) => `${doc.relativePath ?? doc.filename} requires OCR.`);
  const records: StructuredDatasetIndex = {
    dossier: name,
    companyName: manifest.companyName,
    fiscalPeriod: manifest.fiscalPeriod,
    tables: tableIndex(database),
    integrity: { ok: checks.every((check) => check.ok), checks, warnings },
  };
  const evidence: EvidenceIndex = Object.fromEntries(
    docs.map((doc) => [doc.id, { storage: "sqlite", count: doc.unitCount ?? 0 }]),
  );
  const fingerprint = sourceFingerprint(docs);
  database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("sourceFingerprint", fingerprint);
  database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("integrity", JSON.stringify(records.integrity));
  database.exec("PRAGMA optimize");
  database.close();

  writeJson(path.join(outDir, "documents.json"), docs);
  writeJson(path.join(outDir, "evidence.json"), evidence);
  writeJson(path.join(outDir, "records.json"), records);
  writeJson(path.join(outDir, "ingestion.json"), {
    dossier: name,
    sourceRoot: path.relative(process.cwd(), sourceRoot),
    generatedAt: new Date().toISOString(),
    docs: docs.length,
    units: docs.reduce((sum, doc) => sum + (doc.unitCount ?? 0), 0),
    sourceFingerprint: fingerprint,
    storage: "sqlite",
    integrity: records.integrity,
  });
  return { documents: docs, records, sourceFingerprint: fingerprint };
}

function recordsTableId(database: DatabaseSync, prefix: string): string | null {
  const row = database.prepare("SELECT id FROM tables WHERE id LIKE ? ORDER BY id LIMIT 1").get(`${prefix}%`) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

function databaseFor(name: string, readOnly = true): DatabaseSync | null {
  const file = path.join(dataDir(name), SQLITE_FILE);
  if (!fs.existsSync(file)) return null;
  return new DatabaseSync(file, { readOnly, timeout: 5_000 });
}

export function hasSqliteArtifacts(name: string): boolean {
  const database = databaseFor(name);
  if (!database) return false;
  database.close();
  return true;
}

export function listSqliteTables(name: string): StructuredDatasetIndex["tables"] {
  const database = databaseFor(name);
  if (!database) return [];
  try {
    return tableIndex(database);
  } finally {
    database.close();
  }
}

function rowToStructured(
  row: EvidenceRow,
  columns: string[],
  docId: string,
): StructuredRow {
  const cells = JSON.parse(row.cells_json ?? "[]") as string[];
  return {
    rowNumber: row.row_number ?? 0,
    raw: row.text,
    values: Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""])),
    citation: { docId, ref: row.ref, quote: row.text },
  };
}

export function loadSqliteTablePage(
  name: string,
  tableId: string,
  requestedPage = 1,
  requestedPageSize = 50,
): { table: Omit<StructuredTable, "rows">; rows: StructuredRow[]; page: number; pageSize: number; totalRows: number; totalPages: number } | null {
  const database = databaseFor(name);
  if (!database) return null;
  try {
    const table = database.prepare("SELECT * FROM tables WHERE id = ?").get(tableId) as unknown as SqliteTableRow | undefined;
    if (!table) return null;
    const pageSize = Math.min(200, Math.max(1, Math.trunc(requestedPageSize) || 50));
    const totalPages = Math.max(1, Math.ceil(table.row_count / pageSize));
    const page = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage) || 1));
    const rows = database.prepare(`
      SELECT ref, text, page, sheet, start_line, table_id, row_number, cells_json
      FROM evidence WHERE table_id = ? ORDER BY row_number LIMIT ? OFFSET ?
    `).all(tableId, pageSize, (page - 1) * pageSize) as unknown as EvidenceRow[];
    const columns = JSON.parse(table.columns_json) as string[];
    return {
      table: {
        id: table.id,
        name: table.name,
        docId: table.doc_id,
        relativePath: table.relative_path,
        columns,
        source: table.source,
        sheet: table.sheet ?? undefined,
      },
      rows: rows.map((row) => rowToStructured(row, columns, table.doc_id)),
      page,
      pageSize,
      totalRows: table.row_count,
      totalPages,
    };
  } finally {
    database.close();
  }
}

export function loadSqliteEvidenceWindow(
  name: string,
  docId: string,
  ref?: string,
  radius = 4,
): { units: Unit[]; activeRef: string | null; table?: { name: string; columns: string[]; rows: StructuredRow[] } } | null {
  const database = databaseFor(name);
  if (!database) return null;
  try {
    const target = ref
      ? (database.prepare("SELECT * FROM evidence WHERE doc_id = ? AND ref = ?").get(docId, ref) as unknown as (EvidenceRow & { id: number }) | undefined)
      : (database.prepare("SELECT * FROM evidence WHERE doc_id = ? ORDER BY id LIMIT 1").get(docId) as unknown as (EvidenceRow & { id: number }) | undefined);
    if (!target) return { units: [], activeRef: null };
    if (target.table_id && target.row_number != null) {
      const table = database.prepare("SELECT * FROM tables WHERE id = ?").get(target.table_id) as unknown as SqliteTableRow;
      const nearby = database.prepare(`
        SELECT ref, text, page, sheet, start_line, table_id, row_number, cells_json
        FROM evidence WHERE table_id = ? AND row_number BETWEEN ? AND ? ORDER BY row_number
      `).all(target.table_id, Math.max(1, target.row_number - radius), target.row_number + radius) as unknown as EvidenceRow[];
      const columns = JSON.parse(table.columns_json) as string[];
      return {
        units: nearby.map((row) => ({ ref: row.ref, text: row.text, sheet: row.sheet ?? undefined, startLine: row.row_number ?? undefined })),
        activeRef: target.ref,
        table: { name: table.name, columns, rows: nearby.map((row) => rowToStructured(row, columns, table.doc_id)) },
      };
    }
    return {
      units: [{ ref: target.ref, text: target.text, page: target.page ?? undefined, sheet: target.sheet ?? undefined, startLine: target.start_line ?? undefined }],
      activeRef: target.ref,
    };
  } finally {
    database.close();
  }
}

function ftsQuery(query: string): string {
  return [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])]
    .slice(0, 8)
    .map((term) => `"${term.replaceAll('"', '""')}"*`)
    .join(" OR ");
}

export interface EvidenceSearchHit {
  docId: string;
  ref: string;
  text: string;
  filename?: string;
}

export function searchSqliteEvidence(
  name: string,
  query: string,
  docId?: string,
  limit = 12,
): { hits: EvidenceSearchHit[]; totalMatches: number } {
  const database = databaseFor(name);
  if (!database) return { hits: [], totalMatches: 0 };
  try {
    const match = ftsQuery(query);
    if (!match) return { hits: [], totalMatches: 0 };
    const whereDoc = docId ? "AND e.doc_id = ?" : "";
    const parameters = docId ? [match, docId] : [match];
    const total = database.prepare(`
      SELECT count(*) AS count FROM evidence_fts f
      JOIN evidence e ON e.id = f.rowid
      WHERE evidence_fts MATCH ? ${whereDoc}
    `).get(...parameters) as { count: number };
    const rows = database.prepare(`
      SELECT e.doc_id AS docId, e.ref, e.text
      FROM evidence_fts f JOIN evidence e ON e.id = f.rowid
      WHERE evidence_fts MATCH ? ${whereDoc}
      ORDER BY bm25(evidence_fts) LIMIT ?
    `).all(...parameters, Math.min(50, Math.max(1, limit))) as unknown as EvidenceSearchHit[];
    const docs = readJson<DossierDoc[]>(path.join(dataDir(name), "documents.json"));
    const filenames = new Map(docs.map((doc) => [doc.id, doc.filename]));
    return { hits: rows.map((row) => ({ ...row, filename: filenames.get(row.docId) })), totalMatches: total.count };
  } finally {
    database.close();
  }
}

export function verifySqliteCitation(name: string, citation: Citation): boolean {
  const database = databaseFor(name);
  if (!database) return false;
  try {
    const row = database.prepare(`
      SELECT 1 AS ok FROM evidence
      WHERE doc_id = ? AND ref = ? AND instr(text, ?) > 0 LIMIT 1
    `).get(citation.docId, citation.ref, citation.quote) as { ok: number } | undefined;
    return row?.ok === 1;
  } finally {
    database.close();
  }
}

export function iterateSqliteTable(
  name: string,
  tableId: string,
): { columns: string[]; rows: Iterable<StructuredRow>; rowCount: number; docId: string } | null {
  const database = databaseFor(name);
  if (!database) return null;
  const table = database.prepare("SELECT * FROM tables WHERE id = ?").get(tableId) as unknown as SqliteTableRow | undefined;
  if (!table) {
    database.close();
    return null;
  }
  const columns = JSON.parse(table.columns_json) as string[];
  const iterator = database.prepare(`
    SELECT ref, text, page, sheet, start_line, table_id, row_number, cells_json
    FROM evidence WHERE table_id = ? ORDER BY row_number
  `).iterate(tableId) as Iterable<EvidenceRow>;
  return {
    columns,
    rowCount: table.row_count,
    docId: table.doc_id,
    rows: {
      *[Symbol.iterator]() {
        try {
          for (const row of iterator) yield rowToStructured(row, columns, table.doc_id);
        } finally {
          database.close();
        }
      },
    },
  };
}
