# Cortea

Offline-first forensic accounting workspace for the **Muster Verpackungen GmbH** exercise. The public demo parses all 35 source artifacts, verifies the supplied GDPdU exports, runs four deterministic controls, and links every affected record to an exact source row, sheet, or page. No AI key is required.

## Run the exercise

```bash
pnpm install
pnpm ingest muster-verpackungen
pnpm analyze muster-verpackungen --no-ai
pnpm dev:web
```

Open [http://localhost:3001/audit](http://localhost:3001/audit). `muster-verpackungen` is the only public selector entry. The bundled `synthetic` dossier remains available as a development regression fixture.

## Quality gates

```bash
pnpm check-types
pnpm test
pnpm benchmark:muster
pnpm build
```

The benchmark asserts the eight GDPdU hashes and record counts, a balanced ledger, exactly four scheme-level findings, all expected amounts and line-item counts, deterministic IDs/output, adjusted profit of EUR 2,257,041.80, and zero hits across the seven legitimate decoys. The sealed ground-truth Markdown is test context only; ingestion, analysis, APIs, chat, and UI never load it.

## Architecture

- `dossier/muster-verpackungen/manifest.json` points to the public source root under `examples/`; path resolution is recursive and containment-checked.
- `packages/forensic/src/structured-ingest.ts` parses GDPdU descriptors, quoted semicolon records, Windows-1252 text, German numbers, CSV, and XLSX.
- `packages/forensic/src/normalized-records.ts` exposes typed, source-verified accounting records while preserving signed ledger values and distinct accounting dates.
- `packages/forensic/src/structured-engine.ts` implements vendor-control, capitalized-repair, cut-off, and split-payment checks.
- `data/muster-verpackungen/` stores compact indexes plus split record/evidence artifacts. The 20,258-row ledger is never part of the initial browser payload.
- `apps/web/src/app/api/dossier/[name]/` provides summary, evidence-neighborhood, paginated records, and safe source-file routes.

Optional prose review and chat can be enabled with `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`. The server retrieves a bounded evidence packet and validates every returned citation token before displaying the response. Deterministic accounting findings remain authoritative.
