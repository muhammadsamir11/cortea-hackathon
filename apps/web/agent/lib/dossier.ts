import fs from "node:fs";
import path from "node:path";
import type { DossierDoc, Finding, Unit } from "@almedia/forensic/types";
import type { Citation } from "@almedia/forensic/types";
import {
  hasSqliteArtifacts,
  loadSqliteEvidenceWindow,
  searchSqliteEvidence,
  verifySqliteCitation,
} from "@almedia/forensic/sqlite-store";

/** Repo root = nearest ancestor with pnpm-workspace.yaml (mirrors @almedia/forensic/paths;
 * inlined so the agent bundle has no runtime workspace-package dependency). */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function safeDossier(dossier: string): string {
  if (!/^[a-z0-9_-]+$/i.test(dossier)) throw new Error("Invalid dossier name.");
  const dir = path.join(repoRoot(), "data", dossier);
  if (!fs.existsSync(path.join(dir, "documents.json"))) throw new Error(`Unknown dossier: ${dossier}`);
  return dir;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadDocs(dossier: string): DossierDoc[] {
  return readJson<DossierDoc[]>(path.join(safeDossier(dossier), "documents.json"));
}

export function loadFindings(dossier: string): Finding[] {
  return readJson<Finding[]>(path.join(safeDossier(dossier), "findings.json"));
}

/** Same formatting as @almedia/forensic writeJson so diffs and resets stay clean. */
export function saveFindings(dossier: string, findings: Finding[]): void {
  const dir = safeDossier(dossier);
  fs.writeFileSync(
    path.join(dir, "findings.json"),
    JSON.stringify(findings, null, 1),
  );
  const metaFile = path.join(dir, "meta.json");
  if (fs.existsSync(metaFile)) {
    const meta = readJson<Record<string, unknown>>(metaFile);
    const confirmed = findings.filter((finding) => finding.aiStatus === "confirmed").length;
    const acquitted = findings.filter((finding) => finding.aiStatus === "acquitted").length;
    const needsJudgment = findings.filter((finding) => finding.aiStatus === "needs-judgment").length;
    const pending = findings.length - confirmed - acquitted - needsJudgment;
    const reviewed = confirmed + acquitted;
    meta.review = {
      pending,
      confirmed,
      acquitted,
      needsJudgment,
      reviewed,
      reviewedPrecision: reviewed ? confirmed / reviewed : null,
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  }
}

/** Evidence units for one document, via the evidence.json index (inline or per-doc file). */
export function loadUnits(dossier: string, docId: string): Unit[] {
  if (hasSqliteArtifacts(dossier)) {
    return loadSqliteEvidenceWindow(dossier, docId)?.units ?? [];
  }
  const dir = safeDossier(dossier);
  const index = readJson<Record<string, Unit[] | { file: string }>>(
    path.join(dir, "evidence.json"),
  );
  const entry = index[docId];
  if (Array.isArray(entry)) return entry;
  if (!entry) return [];
  const file = path.resolve(dir, entry.file);
  if (file !== dir && !file.startsWith(`${dir}${path.sep}`)) return [];
  return readJson<Unit[]>(file);
}

export function verifyCitation(dossier: string, citation: Citation): boolean {
  if (hasSqliteArtifacts(dossier)) return verifySqliteCitation(dossier, citation);
  return loadUnits(dossier, citation.docId).some(
    (unit) => unit.ref === citation.ref && unit.text.includes(citation.quote),
  );
}

export function searchEvidence(dossier: string, query: string, docId?: string) {
  if (hasSqliteArtifacts(dossier)) return searchSqliteEvidence(dossier, query, docId, 12);
  return null;
}
