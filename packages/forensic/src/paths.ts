import fs from "node:fs";
import path from "node:path";
import type { DossierManifest } from "./structured-types";

/** Repo root = nearest ancestor with pnpm-workspace.yaml. */
export function repoRoot(from: string = process.cwd()): string {
  let dir = path.resolve(from);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function dossierDir(name: string): string {
  return dossierSource(name).sourceRoot;
}

export function dossierManifestPath(name: string): string {
  return path.join(repoRoot(), "dossier", name, "manifest.json");
}

export function readDossierManifest(name: string): DossierManifest | null {
  const file = dossierManifestPath(name);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as DossierManifest;
  return raw;
}

export function dossierSource(name: string): { sourceRoot: string; manifest: DossierManifest | null } {
  const manifest = readDossierManifest(name);
  if (!manifest) return { sourceRoot: path.join(repoRoot(), "dossier", name), manifest: null };
  const manifestDir = path.dirname(dossierManifestPath(name));
  const sourceRoot = path.resolve(manifestDir, manifest.sourceRoot);
  const root = repoRoot();
  if (sourceRoot !== root && !sourceRoot.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Dossier sourceRoot escapes the repository: ${manifest.sourceRoot}`);
  }
  return { sourceRoot, manifest };
}

export function dataDir(name: string): string {
  const configuredRoot = process.env.CORTEA_DATA_ROOT;
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(repoRoot(), "data");
  const p = path.join(root, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1));
}
