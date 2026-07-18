import crypto from "node:crypto";
import { z } from "zod";
import { callObject, getModel } from "../llm";
import { searchSqliteEvidence, verifySqliteCitation } from "../sqlite-store";
import type { Finding } from "../types";

const candidateSchema = z.object({
  findings: z.array(z.object({
    title: z.string().min(8),
    narrative: z.string().min(20),
    fraudType: z.string().min(3),
    severity: z.enum(["high", "medium", "low"]),
    amountInvolved: z.number().nullable(),
    citations: z.array(z.object({
      docId: z.string(),
      ref: z.string(),
      quote: z.string().min(3),
    })).min(1),
  })).max(16),
});

const PROBES = [
  "Bill Hold Gefahrenübergang Warenausgang Umsatz",
  "Insolvenz Forderung Wertberichtigung überfällig",
  "Stornobuchung Generalstorno Neubuchung Festschreibung Freigabe",
  "GEBUCHT OHNE FREIGABE Ersteller Freigeber Journal",
  "Stammdaten geändert genehmigt Kreditlimit Debitor",
  "Steuerbuchungsreferenz Umsatzsteuer Differenz Export",
  "Leistungsdatum Fakturadatum Periodenabgrenzung January cutoff",
  "Kreditlimit überschritten OP-Liste überfällig Altersstruktur",
  "Warenausgang fehlt Rechnung Bill and Hold Konsignation",
  "Intercompany Gesellschafter Verrechnung nahestehend",
];

function stableId(dossier: string, title: string): string {
  return `finding-ai-${crypto.createHash("sha1").update(`${dossier}|${title}`).digest("hex").slice(0, 12)}`;
}

export async function discoverSqliteCandidates(
  dossier: string,
  companyName: string,
  fiscalPeriod: string,
  analysisRunId: string,
  existing: Finding[],
): Promise<{ findings: Finding[]; provider: string }> {
  const packet = PROBES.flatMap((probe) =>
    searchSqliteEvidence(dossier, probe, undefined, 10).hits.map((hit) => ({
      probe,
      docId: hit.docId,
      filename: hit.filename,
      ref: hit.ref,
      text: hit.text.slice(0, 900),
    })),
  );
  const result = await callObject({
    label: "bounded dossier discovery",
    schema: candidateSchema,
    system: `You are a senior forensic accounting candidate screener for ${companyName}, fiscal year ${fiscalPeriod}.
Use only the bounded evidence excerpts supplied. Propose concrete, auditor-useful risks that are NOT already covered by EXISTING FINDINGS
(treat similar titles/schemes as duplicates — e.g. do not restate cutoff, bill-and-hold, master-data, journal-approval, or tax-export gaps already listed).
Prefer distinct schemes: impairment/allowance, credit-limit breaches, missing dispatch, related-party, unusual storno patterns, export gaps, or authorization failures with specific documentary hooks.
Every factual claim must be supported by one or more citations copied exactly from the packet. The quote must be a verbatim
substring of the cited text. Do not claim completeness, guilt, or a final verdict. Return an empty findings array when the excerpts are
ambiguous or merely describe ordinary transactions. Aim for 3–8 high-quality candidates when evidence supports them.`,
    prompt: `EXISTING FINDINGS:\n${JSON.stringify(existing.map((finding) => ({ title: finding.title, checkId: finding.checkId, narrative: finding.narrative })))}\n\nEVIDENCE PACKET:\n${JSON.stringify(packet)}`,
  });
  const known = new Set(existing.map((finding) => finding.title.toLowerCase()));
  const findings = result.findings.flatMap((candidate): Finding[] => {
    const citations = candidate.citations.filter((citation) =>
      verifySqliteCitation(dossier, citation),
    );
    if (!citations.length || known.has(candidate.title.toLowerCase())) return [];
    known.add(candidate.title.toLowerCase());
    return [{
      id: stableId(dossier, candidate.title),
      checkId: "aiDiscovery",
      title: candidate.title,
      tier: "judgment",
      fraudType: candidate.fraudType,
      narrative: candidate.narrative,
      amountInvolved: candidate.amountInvolved,
      severity: candidate.severity,
      factIds: [],
      citations,
      lineItems: [],
      impactCategories: ["other"],
      engineStatus: "detected",
      aiStatus: "needs-judgment",
      origin: "ai-assisted",
      analysisRunId,
    }];
  });
  return { findings, provider: getModel().name };
}
