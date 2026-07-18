import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import PostalMime from "postal-mime";
import type { DocKind, DossierDoc, Unit } from "./types";

const LINES_PER_UNIT = 60;
const ROWS_PER_UNIT = 40;

function slug(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function decodeText(buf: Buffer): { text: string; encoding: "utf-8" | "windows-1252" } {
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

function chunkLines(text: string, refPrefix = "l"): Unit[] {
  const lines = text.split(/\r?\n/);
  const units: Unit[] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_UNIT) {
    const slice = lines.slice(i, i + LINES_PER_UNIT);
    if (!slice.join("").trim()) continue;
    units.push({
      ref: `${refPrefix}.${i + 1}-${i + slice.length}`,
      text: slice.join("\n"),
      startLine: i + 1,
    });
  }
  return units;
}

async function ingestPdf(buf: Buffer): Promise<{ units: Unit[]; needsOcr: boolean }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const units: Unit[] = pages.map((t, i) => ({ ref: `p.${i + 1}`, text: t ?? "", page: i + 1 }));
  const emptyPages = units.filter((u) => u.text.trim().length < 20).length;
  return { units: units.filter((u) => u.text.trim()), needsOcr: emptyPages > pages.length / 2 };
}

function ingestXlsx(buf: Buffer): Unit[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const units: Unit[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    const lines: { row: number; text: string }[] = [];
    rows.forEach((cells, idx) => {
      const line = cells.map((c) => String(c ?? "").trim()).join(" | ").replace(/(\s\|\s)+$/, "");
      if (line.trim() && line.replace(/[|\s]/g, "").length > 0) {
        lines.push({ row: idx + 1, text: `r.${idx + 1}: ${line}` });
      }
    });
    for (let i = 0; i < lines.length; i += ROWS_PER_UNIT) {
      const slice = lines.slice(i, i + ROWS_PER_UNIT);
      if (!slice.length) continue;
      units.push({
        ref: `${sheetName}!r.${slice[0]!.row}-${slice[slice.length - 1]!.row}`,
        text: slice.map((l) => l.text).join("\n"),
        sheet: sheetName,
        startLine: slice[0]!.row,
      });
    }
  }
  return units;
}

async function ingestEml(buf: Buffer): Promise<Unit[]> {
  const email = await PostalMime.parse(buf);
  const header = [
    `From: ${email.from?.name ?? ""} <${email.from?.address ?? ""}>`,
    `To: ${(email.to ?? []).map((t) => `${t.name ?? ""} <${t.address ?? ""}>`).join(", ")}`,
    `Date: ${email.date ?? ""}`,
    `Subject: ${email.subject ?? ""}`,
  ].join("\n");
  const body = (email.text ?? email.html?.replace(/<[^>]+>/g, " ") ?? "").trim();
  return [
    { ref: "header", text: header },
    ...chunkLines(body, "body.l"),
  ];
}

async function ingestDocx(buf: Buffer): Promise<Unit[]> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return chunkLines(value);
}

const EXT_KIND: Record<string, DocKind> = {
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

export async function ingestFile(filePath: string, sourceRoot = path.dirname(filePath)): Promise<DossierDoc | null> {
  const filename = path.basename(filePath);
  const relativePath = path.relative(sourceRoot, filePath).split(path.sep).join("/");
  const ext = path.extname(filename).toLowerCase();
  const kind = EXT_KIND[ext];
  if (!kind || filename.startsWith(".")) return null;
  const buf = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  let units: Unit[] = [];
  let needsOcr = false;
  let encoding: DossierDoc["encoding"] = "binary";
  switch (kind) {
    case "pdf": {
      const r = await ingestPdf(buf);
      units = r.units;
      needsOcr = r.needsOcr;
      break;
    }
    case "xlsx":
      units = ingestXlsx(buf);
      break;
    case "email":
      units = await ingestEml(buf);
      break;
    case "docx":
      units = await ingestDocx(buf);
      break;
    default: {
      const decoded = decodeText(buf);
      encoding = decoded.encoding;
      units = chunkLines(decoded.text);
    }
  }
  return {
    id: slug(relativePath),
    filename,
    relativePath,
    kind,
    encoding,
    sha256,
    units,
    unitCount: units.length,
    firstRef: units[0]?.ref,
    needsOcr,
  };
}

export async function ingestDossier(dir: string): Promise<DossierDoc[]> {
  const walk = (current: string): string[] =>
    fs
      .readdirSync(current, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .flatMap((entry) => {
        const full = path.join(current, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
  const files = walk(dir).sort((a, b) => a.localeCompare(b));
  const docs: DossierDoc[] = [];
  for (const full of files) {
    try {
      const doc = await ingestFile(full, dir);
      if (doc) docs.push(doc);
      else console.warn(`  skipped (unsupported): ${path.relative(dir, full)}`);
    } catch (err) {
      throw new Error(`Failed to ingest ${path.relative(dir, full)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return docs;
}

/** Serialize the whole dossier for full-context LLM calls. */
export function dossierAsPrompt(docs: DossierDoc[]): string {
  return docs
    .map(
      (d) =>
        `<document id="${d.id}" file="${d.filename}" kind="${d.kind}">\n` +
        d.units.map((u) => `[REF ${u.ref}]\n${u.text}`).join("\n") +
        `\n</document>`,
    )
    .join("\n\n");
}

export function estimateTokens(docs: DossierDoc[]): number {
  return Math.round(dossierAsPrompt(docs).length / 4);
}
