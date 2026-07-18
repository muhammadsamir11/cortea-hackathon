import { z } from "zod";
import type { DossierDoc, Finding } from "../types";
import { dossierAsPrompt } from "../ingest";
import { callObject } from "../llm";
import { quoteInText } from "../normalize";

const sweepSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string(),
      fraudType: z.string(),
      narrative: z.string().describe("follow-the-money story, concrete names/amounts/dates"),
      amountInvolved: z.number().nullable(),
      citations: z
        .array(
          z.object({
            docId: z.string(),
            ref: z.string(),
            quote: z.string().describe("verbatim substring, 10-80 chars, exact including umlauts"),
          }),
        )
        .min(1),
    }),
  ),
});

export type SweepCandidate = Omit<Finding, "tribunal">;

/** One full-dossier pass for fraud that only shows in prose: contradictions
 * between contracts/minutes/emails and the books, admissions, undisclosed
 * related parties. Judgment tier only — the engine owns the numeric checks. */
export async function proseSweep(
  docs: DossierDoc[],
  companyName: string,
): Promise<SweepCandidate[]> {
  const { candidates } = await callObject({
    label: "prose sweep",
    schema: sweepSchema,
    system: `You are a skeptical forensic auditor reviewing the complete dossier of ${companyName}.
Numeric reconciliation, duplicate detection, three-way matching, IBAN checks, timeline checks and
cycle detection are ALREADY covered by a deterministic engine. Your job is ONLY what prose reveals:
- admissions or instructions in correspondence/minutes that describe improper schemes
- contradictions between what contracts/policies require and what other documents show
- undisclosed related parties, conflicts of interest
- anything material that cannot be derived from numbers alone
STRICT RULES:
- Report at most 8 candidates, only with concrete documentary evidence.
- Every citation quote must be copied verbatim character-for-character (machine-verified; wrong quotes discard the candidate).
- Innocent discrepancies exist in this dossier by design. If a plausible innocent explanation is directly supported by the documents, DO NOT report the item.
- Use the document ids and [REF ...] markers exactly as given.`,
    prompt: dossierAsPrompt(docs),
  });
  let n = 0;
  const out: SweepCandidate[] = [];
  for (const c of candidates) {
    // machine-verify citations right here
    const valid = c.citations.filter((cit) => {
      const doc = docs.find((d) => d.id === cit.docId);
      if (!doc) return false;
      const unit = doc.units.find((u) => u.ref === cit.ref) ?? doc.units.find((u) => quoteInText(cit.quote, u.text));
      if (!unit) return false;
      cit.ref = unit.ref;
      return quoteInText(cit.quote, unit.text);
    });
    if (!valid.length) {
      console.warn(`  [sweep] dropped (citations failed validation): ${c.title}`);
      continue;
    }
    out.push({
      id: `c-sweep-${++n}`,
      checkId: "proseSweep",
      tier: "judgment",
      fraudType: c.fraudType,
      title: c.title,
      narrative: c.narrative,
      amountInvolved: c.amountInvolved,
      severity: (c.amountInvolved ?? 0) >= 25_000 ? "high" : "medium",
      factIds: [],
      citations: valid,
    });
  }
  return out;
}
