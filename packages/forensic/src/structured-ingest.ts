import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseAmount } from "./normalize";
import type { DossierDoc, Unit } from "./types";
import type {
  DossierManifest,
  IntegrityCheck,
  StructuredDataset,
  StructuredRow,
  StructuredTable,
} from "./structured-types";

function decodeText(file: string): { text: string; encoding: "utf-8" | "windows-1252" } {
  const buf = fs.readFileSync(file);
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, ""),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(buf).replace(/^\uFEFF/, ""),
      encoding: "windows-1252",
    };
  }
}

/** RFC-4180-style row parsing with a configurable semicolon delimiter. */
export function parseDelimitedLine(line: string, delimiter = ";"): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

function docIdFor(docs: DossierDoc[], relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  const doc = docs.find((item) => item.relativePath === normalized);
  if (!doc) throw new Error(`No document registry entry for ${normalized}`);
  return doc.id;
}

function parseIndexXml(xml: string): Array<{ url: string; name: string; columns: string[] }> {
  return [...xml.matchAll(/<Table>([\s\S]*?)<\/Table>/g)].map((match) => {
    const block = match[1]!;
    const url = block.match(/<URL>(.*?)<\/URL>/)?.[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    if (!url || !name) throw new Error("GDPdU table is missing URL or Name");
    return {
      url,
      name,
      columns: [...block.matchAll(/<VariableColumn>[\s\S]*?<Name>(.*?)<\/Name>/g)].map(
        (column) => column[1]!,
      ),
    };
  });
}

function rowsFromLines(
  docId: string,
  refPrefix: string,
  columns: string[],
  lines: string[],
  firstRowNumber: number,
): StructuredRow[] {
  return lines.map((raw, index) => {
    const rowNumber = firstRowNumber + index;
    const cells = parseDelimitedLine(raw);
    const values = Object.fromEntries(columns.map((column, i) => [column, cells[i] ?? ""]));
    return {
      rowNumber,
      raw,
      values,
      citation: { docId, ref: `${refPrefix}!r.${rowNumber}`, quote: raw },
    };
  });
}

function unitsForTable(table: StructuredTable): Unit[] {
  return table.rows.map((row) => ({
    ref: row.citation.ref,
    text: row.raw,
    sheet: table.sheet,
    startLine: row.rowNumber,
  }));
}

function parseGdpduTables(sourceRoot: string, docs: DossierDoc[]): StructuredTable[] {
  const tables: StructuredTable[] = [];
  for (const dir of ["Sachkonten", "Debitoren", "Kreditoren", "AV"]) {
    const indexPath = path.join(sourceRoot, dir, "index.xml");
    if (!fs.existsSync(indexPath)) throw new Error(`Missing GDPdU descriptor ${dir}/index.xml`);
    const descriptor = parseIndexXml(decodeText(indexPath).text);
    for (const spec of descriptor) {
      const relativePath = `${dir}/${spec.url}`;
      const file = path.join(sourceRoot, relativePath);
      const text = decodeText(file).text;
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      const docId = docIdFor(docs, relativePath);
      tables.push({
        id: spec.name,
        name: spec.name,
        docId,
        relativePath,
        columns: spec.columns,
        rows: rowsFromLines(docId, spec.name, spec.columns, lines, 1),
        source: "gdpdu",
      });
    }
  }
  return tables;
}

function parseCsvTables(sourceRoot: string, docs: DossierDoc[]): StructuredTable[] {
  const support = path.join(sourceRoot, "Begleitdokumente");
  return fs
    .readdirSync(support)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .sort()
    .map((filename) => {
      const relativePath = `Begleitdokumente/${filename}`;
      const text = decodeText(path.join(support, filename)).text;
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      const columns = parseDelimitedLine(lines[0] ?? "");
      const name = filename.replace(/\.csv$/i, "");
      const docId = docIdFor(docs, relativePath);
      return {
        id: name,
        name,
        docId,
        relativePath,
        columns,
        rows: rowsFromLines(docId, name, columns, lines.slice(1), 2),
        source: "csv" as const,
      };
    });
}

function bestHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let score = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i]!.map((cell) => String(cell ?? "").trim()).filter(Boolean);
    const unique = new Set(cells);
    const candidate = cells.length >= 2 ? unique.size : 0;
    if (candidate > score) {
      score = candidate;
      best = i;
    }
  }
  return best;
}

function parseXlsxTables(sourceRoot: string, docs: DossierDoc[]): StructuredTable[] {
  const support = path.join(sourceRoot, "Begleitdokumente");
  const tables: StructuredTable[] = [];
  for (const filename of fs.readdirSync(support).filter((name) => name.toLowerCase().endsWith(".xlsx")).sort()) {
    const relativePath = `Begleitdokumente/${filename}`;
    const docId = docIdFor(docs, relativePath);
    const workbook = XLSX.read(fs.readFileSync(path.join(support, filename)), { type: "buffer" });
    for (const sheet of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheet];
      if (!worksheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        raw: false,
        defval: "",
      });
      const headerIndex = bestHeaderRow(matrix);
      const columns = (matrix[headerIndex] ?? []).map((cell, index) => String(cell ?? "").trim() || `COL_${index + 1}`);
      const name = `${filename.replace(/\.xlsx$/i, "")}:${sheet}`;
      const rows: StructuredRow[] = [];
      for (let index = headerIndex + 1; index < matrix.length; index++) {
        const cells = matrix[index]!.map((cell) => String(cell ?? "").trim());
        if (!cells.some(Boolean)) continue;
        const rowNumber = index + 1;
        const raw = cells.join(" | ");
        rows.push({
          rowNumber,
          raw,
          values: Object.fromEntries(columns.map((column, i) => [column, cells[i] ?? ""])),
          citation: { docId, ref: `${sheet}!r.${rowNumber}`, quote: raw },
        });
      }
      tables.push({
        id: name,
        name,
        docId,
        relativePath,
        columns,
        rows,
        source: "xlsx",
        sheet,
      });
    }
  }
  return tables;
}

function protocolExpectation(text: string, relativePath: string): { rows: number | null; sha256: string | null } {
  const index = text.indexOf(relativePath);
  if (index < 0) return { rows: null, sha256: null };
  const tail = text.slice(index + relativePath.length, index + relativePath.length + 260);
  const rows = Number(tail.match(/\s(\d+)\s/)?.[1] ?? NaN);
  const hashParts = tail.match(/[a-f0-9]{8,}/gi) ?? [];
  const sha256 = hashParts.join("").slice(0, 64);
  return { rows: Number.isFinite(rows) ? rows : null, sha256: sha256.length === 64 ? sha256 : null };
}

function buildIntegrity(
  sourceRoot: string,
  docs: DossierDoc[],
  tables: StructuredTable[],
): StructuredDataset["integrity"] {
  const checks: IntegrityCheck[] = [];
  const warnings: string[] = [];
  const protocol = docs.find((doc) => doc.relativePath?.endsWith("Exportprotokoll_GDPdU_2025.pdf"));
  const protocolText = protocol?.units.map((unit) => unit.text).join("\n") ?? "";
  const gdpdu = tables.filter((table) => table.source === "gdpdu");

  for (const table of gdpdu) {
    const expectation = protocolExpectation(protocolText, table.relativePath);
    const file = path.join(sourceRoot, table.relativePath);
    const actualHash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    checks.push({
      id: `rows:${table.id}`,
      label: `${table.name} record count`,
      ok: expectation.rows === table.rows.length,
      detail: `${table.rows.length} parsed${expectation.rows == null ? "; protocol count unavailable" : ` / ${expectation.rows} expected`}`,
    });
    checks.push({
      id: `hash:${table.id}`,
      label: `${table.name} SHA-256`,
      ok: expectation.sha256 === actualHash,
      detail: expectation.sha256 ? (expectation.sha256 === actualHash ? "matches export protocol" : "does not match export protocol") : "protocol hash unavailable",
    });
  }

  const ledger = tables.find((table) => table.id === "Sachkontobuchungen");
  const ledgerSum = ledger?.rows.reduce((sum, row) => sum + (parseAmount(row.values.BUCHUNGSBETRAG) ?? 0), 0) ?? NaN;
  checks.push({
    id: "ledger:balanced",
    label: "General ledger balances",
    ok: Number.isFinite(ledgerSum) && Math.abs(ledgerSum) < 0.01,
    detail: Number.isFinite(ledgerSum) ? `signed row sum EUR ${ledgerSum.toFixed(2)}` : "ledger unavailable",
  });

  const reconciliation = tables.find((table) => table.id.startsWith("Abstimmung_Nebenbuecher_HB_2025:"));
  const differences = reconciliation?.rows.filter((row) => /Differenz/i.test(row.raw)) ?? [];
  checks.push({
    id: "subledgers:reconciled",
    label: "Subledgers reconcile to the general ledger",
    ok: differences.length === 2 && differences.every((row) => Math.abs(parseAmount(Object.values(row.values).at(-1)) ?? NaN) < 0.01),
    detail: differences.length === 2 ? "debtor and creditor differences are zero" : "reconciliation rows unavailable",
  });

  const priorYear = tables.find((table) => table.id.startsWith("Saldenliste_2024_Vorjahr:"));
  if (!priorYear || priorYear.rows.length === 0) warnings.push("The 2024 prior-year balance workbook contains headings but no data rows.");
  const taxDir = path.join(sourceRoot, "Steuercodes");
  if (fs.existsSync(taxDir) && fs.readdirSync(taxDir).length === 0) warnings.push("The Steuercodes directory is empty.");
  for (const doc of docs.filter((item) => item.needsOcr)) warnings.push(`${doc.relativePath ?? doc.filename} requires OCR.`);

  return { ok: checks.every((check) => check.ok), checks, warnings };
}

export function parseStructuredDataset(
  sourceRoot: string,
  manifest: DossierManifest,
  docs: DossierDoc[],
): StructuredDataset {
  const tables = [
    ...parseGdpduTables(sourceRoot, docs),
    ...parseCsvTables(sourceRoot, docs),
    ...parseXlsxTables(sourceRoot, docs),
  ];

  const unitsByDoc = new Map<string, Unit[]>();
  for (const table of tables) {
    const existing = unitsByDoc.get(table.docId) ?? [];
    existing.push(...unitsForTable(table));
    unitsByDoc.set(table.docId, existing);
  }
  for (const doc of docs) {
    const tableUnits = unitsByDoc.get(doc.id);
    if (tableUnits?.length) {
      doc.units = tableUnits;
      doc.unitCount = tableUnits.length;
      doc.firstRef = tableUnits[0]?.ref;
    }
  }

  return {
    dossier: manifest.name,
    companyName: manifest.companyName,
    fiscalPeriod: manifest.fiscalPeriod,
    tables,
    integrity: buildIntegrity(sourceRoot, docs, tables),
  };
}

export function tableByName(dataset: StructuredDataset, name: string): StructuredTable {
  const table = dataset.tables.find((candidate) => candidate.id === name);
  if (!table) throw new Error(`Required structured table missing: ${name}`);
  return table;
}
