import type { Citation } from "./types";

export interface DossierManifest {
  name: string;
  title: string;
  sourceRoot: string;
  companyName: string;
  fiscalPeriod: string;
  public: boolean;
  /** Parser family used by the dossier. Omitted for legacy fixtures. */
  profile?: "gdpdu";
  /** Capability-based control packs selected for analysis. */
  controlPacks?: string[];
  /** Stable analysis timestamp for reproducible example reports. */
  analysisAsOf?: string;
}

export interface StructuredRow {
  rowNumber: number;
  raw: string;
  values: Record<string, string>;
  citation: Citation;
}

export interface StructuredTable {
  id: string;
  name: string;
  docId: string;
  relativePath: string;
  columns: string[];
  rows: StructuredRow[];
  source: "gdpdu" | "csv" | "xlsx";
  sheet?: string;
}

export interface IntegrityCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface StructuredDataset {
  dossier: string;
  companyName: string;
  fiscalPeriod: string;
  tables: StructuredTable[];
  integrity: {
    ok: boolean;
    checks: IntegrityCheck[];
    warnings: string[];
  };
}

export interface StructuredTableIndex extends Omit<StructuredTable, "rows"> {
  rowCount: number;
  file?: string;
  storage?: "json" | "sqlite";
}

export interface StructuredDatasetIndex extends Omit<StructuredDataset, "tables"> {
  tables: StructuredTableIndex[];
}

export interface EvidenceIndex {
  [docId: string]: { file?: string; count: number; storage?: "json" | "sqlite" };
}
