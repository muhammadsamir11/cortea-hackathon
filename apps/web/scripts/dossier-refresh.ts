import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isAiConfigured } from "@almedia/forensic/llm";
import { readDossierManifest, repoRoot } from "@almedia/forensic/paths";

function copyReviewHistory(source: string, destination: string): void {
  const files = ["findings.json", "meta.json", "report.md"];
  const existing = files.filter((file) => fs.existsSync(path.join(source, file)));
  if (!existing.length) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const file of existing) fs.copyFileSync(path.join(source, file), path.join(destination, file));
}

function runScript(script: "ingest" | "analyze", name: string, args: string[], env: NodeJS.ProcessEnv): void {
  execFileSync("pnpm", ["--filter", "web", script, name, ...args], {
    cwd: repoRoot(),
    env,
    stdio: "inherit",
  });
}

function main(): void {
  const name = process.argv[2];
  if (!name || !/^[a-z0-9_-]+$/.test(name)) throw new Error("A valid dossier name is required.");
  if (name === "muster-verpackungen") {
    throw new Error("The regression baseline cannot be refreshed with dossier:refresh.");
  }
  const discover = process.argv.includes("--discover");
  const noAi = process.argv.includes("--no-ai");
  if (discover === noAi) throw new Error("Choose exactly one analysis mode: --discover or --no-ai.");
  if (discover && !isAiConfigured()) {
    throw new Error("--discover requires OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. No active data was changed.");
  }
  const manifest = readDossierManifest(name);
  if (!manifest?.profile) throw new Error(`No imported structured dossier manifest found for ${name}.`);

  const root = repoRoot();
  const dataRoot = path.join(root, "data");
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  const stagingRoot = path.join(dataRoot, ".staging", runId);
  const staged = path.join(stagingRoot, name);
  const target = path.join(dataRoot, name);
  const backup = path.join(dataRoot, ".staging", `${runId}-previous`);
  const environment = {
    ...process.env,
    CORTEA_DATA_ROOT: stagingRoot,
    CORTEA_ANALYSIS_RUN_ID: runId,
  };

  fs.mkdirSync(stagingRoot, { recursive: true });
  try {
    runScript("ingest", name, [], environment);
    runScript("analyze", name, [discover ? "--discover" : "--no-ai"], environment);
    if (!fs.existsSync(path.join(staged, "findings.json")) || !fs.existsSync(path.join(staged, "records.sqlite"))) {
      throw new Error("Staged refresh is incomplete; active data was not changed.");
    }

    if (fs.existsSync(target)) fs.renameSync(target, backup);
    try {
      fs.renameSync(staged, target);
    } catch (error) {
      if (fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
      throw error;
    }
    if (fs.existsSync(backup)) {
      copyReviewHistory(backup, path.join(dataRoot, ".history", name, runId));
      fs.rmSync(backup, { recursive: true, force: true });
    }
    if (fs.existsSync(stagingRoot)) fs.rmSync(stagingRoot, { recursive: true, force: true });
    console.log(`Activated ${name} analysis ${runId}.`);
  } catch (error) {
    if (fs.existsSync(stagingRoot)) fs.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

