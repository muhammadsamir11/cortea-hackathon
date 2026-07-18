import { z } from "zod";
import type { Citation, DossierDoc, Finding } from "../types";
import type { Candidate } from "../engine/checks";
import { dossierAsPrompt } from "../ingest";
import { callObject, pool } from "../llm";
import { quoteInText } from "../normalize";

const defenseSchema = z.object({
  defense: z
    .string()
    .describe("the strongest innocent explanation, grounded in the documents; or state that none exists"),
  defenseCitations: z.array(
    z.object({ docId: z.string(), ref: z.string(), quote: z.string() }),
  ),
  strength: z.enum(["none", "weak", "strong"]),
});

const verdictSchema = z.object({
  verdict: z.enum(["confirmed", "needs-judgment", "acquitted"]),
  reasoning: z.string(),
});

const FULL_DOSSIER_CHAR_BUDGET = 400_000;

/** Structured ledgers are huge — pass cited units + prose/policy, not every row. */
function evidencePackForCandidate(cand: Candidate, docs: DossierDoc[]): string {
  const cited = new Map<string, Set<string>>();
  const addCitation = (c: Citation) => {
    const refs = cited.get(c.docId) ?? new Set<string>();
    refs.add(c.ref);
    cited.set(c.docId, refs);
  };
  for (const c of cand.citations) addCitation(c);
  for (const li of cand.lineItems ?? []) {
    for (const c of li.citations ?? []) addCitation(c);
  }

  const pack: DossierDoc[] = [];
  for (const doc of docs) {
    const isProse =
      doc.docType === "Audit policy" || doc.docType === "Supporting report";
    const refs = cited.get(doc.id);
    if (!refs && !isProse) continue;
    const units = refs
      ? doc.units.filter((u) => refs.has(u.ref))
      : doc.units;
    if (units.length === 0) continue;
    pack.push({ ...doc, units });
  }

  // Fall back to a truncated full dossier only for tiny corpora (legacy PDF dossiers).
  if (pack.length === 0) {
    const full = dossierAsPrompt(docs);
    return full.length <= FULL_DOSSIER_CHAR_BUDGET
      ? full
      : `${full.slice(0, FULL_DOSSIER_CHAR_BUDGET)}\n\n[…dossier truncated for context window…]`;
  }
  return dossierAsPrompt(pack);
}

/** Every candidate stands trial: a defense agent hunts for the innocent
 * explanation (credit notes, corrections, FX, timing); a judge weighs it.
 * This is the false-positive firewall. */
export async function tribunal(
  candidates: Candidate[],
  docs: DossierDoc[],
  companyName: string,
): Promise<Finding[]> {
  return pool(
    candidates.map((cand) => async (): Promise<Finding> => {
      try {
        const evidence = evidencePackForCandidate(cand, docs);
        const defense = await callObject({
          label: `defense: ${cand.title.slice(0, 40)}`,
          schema: defenseSchema,
          system: `You are defense counsel for the management of ${companyName} in an audit.
An automated forensic engine raised an allegation. Search the provided evidence pack for the strongest
INNOCENT explanation: credit notes, correcting entries, FX or timing differences, legitimate
business reasons, documents the engine may have missed. Cite verbatim quotes (machine-verified).
If no honest defense exists, say so plainly — do not invent one.`,
          prompt: `ALLEGATION:\n${JSON.stringify({ title: cand.title, narrative: cand.narrative, fraudType: cand.fraudType }, null, 1)}\n\nEVIDENCE PACK:\n${evidence}`,
        });
        const validCitations = defense.defenseCitations.filter((cit) => {
          const doc = docs.find((d) => d.id === cit.docId);
          const unit = doc?.units.find((u) => u.ref === cit.ref) ?? doc?.units.find((u) => quoteInText(cit.quote, u.text));
          if (unit) cit.ref = unit.ref;
          return !!unit && quoteInText(cit.quote, unit.text);
        });
        const { verdict, reasoning } = await callObject({
          label: `verdict: ${cand.title.slice(0, 40)}`,
          schema: verdictSchema,
          system: `You are a skeptical senior auditor ruling on an allegation.
Rules:
- "acquitted" ONLY if the defense's cited evidence concretely and fully neutralizes the allegation
  (e.g. a credit note that exactly reverses an apparent duplicate, a documented FX rate explaining a difference).
- "confirmed" when the documentary evidence supports the allegation and the defense is absent, speculative, or only partial.
- "needs-judgment" when material questions remain that an auditor must resolve with additional evidence.
- False accusations are costly; so is letting fraud through. Decide on the evidence, not on suspicion.
- Note: defense citations listed as INVALID failed machine verification against the documents — ignore them.`,
          prompt:
            `ALLEGATION (tier: ${cand.tier}):\n${JSON.stringify({ title: cand.title, narrative: cand.narrative }, null, 1)}` +
            `\n\nDEFENSE (claimed strength: ${defense.strength}):\n${defense.defense}` +
            `\nVALID defense citations: ${JSON.stringify(validCitations)}` +
            `\nINVALID (failed verification): ${defense.defenseCitations.length - validCitations.length}`,
        });
        return { ...cand, tribunal: { defense: defense.defense, defenseCitations: validCitations, verdict, reasoning } };
      } catch (err) {
        console.error(`  tribunal failed for ${cand.id}:`, err);
        return {
          ...cand,
          tribunal: {
            defense: "Tribunal unavailable (LLM error) — verdict defaults to auditor judgment.",
            defenseCitations: [],
            verdict: "needs-judgment",
            reasoning: "Automated tribunal errored; treat with manual care.",
          },
        };
      }
    }),
    4,
  );
}
