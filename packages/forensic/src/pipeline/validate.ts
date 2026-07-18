import type { Citation, DossierDoc, Fact } from "../types";
import { quoteInText } from "../normalize";

export interface ValidationStats {
  facts: number;
  verifiedFacts: number;
  citations: number;
  verifiedCitations: number;
  repairedRefs: number;
  droppedFacts: { factId: string; docId: string; quotes: string[] }[];
}

/**
 * "No number without a source", enforced mechanically:
 * every citation quote must literally appear in the referenced unit.
 * If the ref is wrong but the quote exists elsewhere in the same document,
 * the ref is repaired. Facts whose every citation fails are excluded.
 */
export function validateFacts(
  facts: Fact[],
  docs: DossierDoc[],
): { verified: Fact[]; stats: ValidationStats } {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const stats: ValidationStats = {
    facts: facts.length,
    verifiedFacts: 0,
    citations: 0,
    verifiedCitations: 0,
    repairedRefs: 0,
    droppedFacts: [],
  };
  const verified: Fact[] = [];
  for (const fact of facts) {
    const doc = byId.get(fact.docId);
    const good: Citation[] = [];
    for (const cit of fact.citations) {
      stats.citations++;
      if (!doc) continue;
      const unit = doc.units.find((u) => u.ref === cit.ref);
      if (unit && quoteInText(cit.quote, unit.text)) {
        good.push(cit);
        stats.verifiedCitations++;
        continue;
      }
      // Repair: locate the quote anywhere in the document.
      const home = doc.units.find((u) => quoteInText(cit.quote, u.text));
      if (home) {
        good.push({ ...cit, ref: home.ref });
        stats.verifiedCitations++;
        stats.repairedRefs++;
      }
    }
    if (good.length > 0) {
      verified.push({ ...fact, citations: good, verified: true });
      stats.verifiedFacts++;
    } else {
      stats.droppedFacts.push({
        factId: fact.id,
        docId: fact.docId,
        quotes: fact.citations.map((c) => c.quote),
      });
    }
  }
  return { verified, stats };
}
