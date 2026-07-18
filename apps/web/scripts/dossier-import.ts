import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { repoRoot, writeJson } from "@almedia/forensic/paths";
import type { DossierManifest } from "@almedia/forensic/structured-types";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function directoryBytes(root: string): number {
  return fs.readdirSync(root, { withFileTypes: true }).reduce((total, entry) => {
    const file = path.join(root, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(file) : fs.statSync(file).size);
  }, 0);
}

function ensureFreeSpace(destination: string, requiredBytes: number): void {
  const stats = fs.statfsSync(destination);
  const available = Number(stats.bavail) * Number(stats.bsize);
  if (available < requiredBytes) {
    throw new Error(
      `Not enough free space: ${(available / 1024 ** 3).toFixed(1)} GiB available, ` +
        `${(requiredBytes / 1024 ** 3).toFixed(1)} GiB required for source and generated artifacts.`,
    );
  }
}

function main(): void {
  const name = process.argv[2];
  const sourceArg = option("--source");
  const companyName = option("--company");
  const fiscalPeriod = option("--period");
  const profile = option("--profile");
  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    throw new Error("A lowercase dossier name containing only letters, numbers, _ or - is required.");
  }
  if (!sourceArg || !companyName || !fiscalPeriod) {
    throw new Error("Required options: --source <folder> --company <name> --period <year>.");
  }
  if (!process.argv.includes("--copy")) {
    throw new Error("This importer requires --copy so the registered source remains inside the repository.");
  }
  if (profile !== "gdpdu") throw new Error("The supported import profile is --profile gdpdu.");

  const source = path.resolve(sourceArg);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Source directory does not exist: ${source}`);
  }
  const root = repoRoot();
  const dossierDirectory = path.join(root, "dossier", name);
  const destination = path.join(dossierDirectory, "source");
  if (fs.existsSync(destination)) {
    throw new Error(`Refusing to overwrite existing dossier source: ${destination}`);
  }

  fs.mkdirSync(dossierDirectory, { recursive: true });
  const sourceBytes = directoryBytes(source);
  ensureFreeSpace(dossierDirectory, Math.ceil(sourceBytes * 3));
  const temporary = path.join(dossierDirectory, `.source-import-${crypto.randomUUID()}`);
  try {
    fs.cpSync(source, temporary, { recursive: true, errorOnExist: true, force: false });
    if (directoryBytes(temporary) !== sourceBytes) {
      throw new Error("Copied source size does not match the input; import was not activated.");
    }
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }

  const manifest: DossierManifest = {
    name,
    title: `${companyName} — Audit ${fiscalPeriod}`,
    sourceRoot: "./source",
    companyName,
    fiscalPeriod,
    public: true,
    profile: "gdpdu",
    controlPacks: [
      "core-integrity",
      "revenue-receivables",
      "access-journals",
      "tax-completeness",
    ],
  };
  writeJson(path.join(dossierDirectory, "manifest.json"), manifest);
  console.log(`Imported ${name}: ${(sourceBytes / 1024 ** 2).toFixed(1)} MiB copied to ${destination}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

