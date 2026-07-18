import fs from "node:fs";
import path from "node:path";
import type { DossierDoc, Finding, Unit } from "@almedia/forensic/types";

/** The dossier on trial. The demo workbench is locked to this dossier too. */
export const DOSSIER = "muster-verpackungen";

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

const dataDir = () => path.join(repoRoot(), "data", DOSSIER);

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadDocs(): DossierDoc[] {
  return readJson<DossierDoc[]>(path.join(dataDir(), "documents.json"));
}

export function loadFindings(): Finding[] {
  return readJson<Finding[]>(path.join(dataDir(), "findings.json"));
}

/** Same formatting as @almedia/forensic writeJson so diffs and resets stay clean. */
export function saveFindings(findings: Finding[]): void {
  fs.writeFileSync(
    path.join(dataDir(), "findings.json"),
    JSON.stringify(findings, null, 1),
  );
}

/** Evidence units for one document, via the evidence.json index (inline or per-doc file). */
export function loadUnits(docId: string): Unit[] {
  const dir = dataDir();
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
