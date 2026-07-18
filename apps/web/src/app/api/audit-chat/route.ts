import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  type UIMessage,
} from "ai";
import { pickModel } from "@almedia/forensic/llm";
import { loadDossier } from "@/lib/audit-data";
import type { Citation, Finding } from "@almedia/forensic/types";

export const maxDuration = 120;

const CITE_RE = /\[cite:([^|\]]+)\|([^|\]]+)\|([^\]]*)\]/g;

function userText(messages: UIMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .flatMap((message) => message.parts)
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}

function selectFindings(findings: Finding[], query: string): Finding[] {
  const terms = new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 3));
  return [...findings]
    .map((finding) => ({
      finding,
      score: [...terms].filter((term) => `${finding.title} ${finding.narrative}`.toLowerCase().includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score || (b.finding.amountInvolved ?? 0) - (a.finding.amountInvolved ?? 0))
    .slice(0, 4)
    .map(({ finding }) => finding);
}

function uniqueCitations(findings: Finding[]): Citation[] {
  const seen = new Set<string>();
  return findings.flatMap((finding) => [
    ...finding.citations,
    ...(finding.lineItems?.flatMap((item) => item.citations) ?? []),
  ]).filter((citation) => {
    const key = `${citation.docId}|${citation.ref}|${citation.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function validateCitations(text: string, allowed: Set<string>): string {
  return text.replace(CITE_RE, (raw, docId: string, ref: string, quote: string) =>
    allowed.has(`${docId.trim()}|${ref.trim()}|${quote.trim()}`) ? raw : "[citation rejected by server]",
  );
}

export async function POST(request: Request) {
  const model = pickModel();
  if (!model) return Response.json({ error: "Optional AI is not configured." }, { status: 503 });
  const { messages, dossier }: { messages: UIMessage[]; dossier: string } = await request.json();
  const data = loadDossier(dossier);
  if (!data) return new Response("unknown dossier", { status: 404 });

  const selected = selectFindings(data.findings, userText(messages));
  const citations = uniqueCitations(selected);
  const allowed = new Set(citations.map((citation) => `${citation.docId}|${citation.ref}|${citation.quote}`));
  const evidencePacket = selected.map((finding) => ({
    id: finding.id,
    title: finding.title,
    narrative: finding.narrative,
    calculations: finding.calculations,
    lineItems: finding.lineItems?.map((item) => ({
      date: item.date,
      documentNumber: item.documentNumber,
      counterparty: item.counterparty,
      description: item.description,
      amount: item.amount,
      citations: item.citations,
    })),
  }));

  const system = `You are the optional prose reviewer in the Cortea forensic workspace.
Use only the retrieved, deterministic evidence packet below. Do not infer facts from general knowledge.
Every factual number, date, document, or party claim must use an exact supplied citation formatted
[cite:DOCID|REF|VERBATIM QUOTE]. If the packet does not support an answer, say so. Answer in the user's language.

RETRIEVED EVIDENCE PACKET:
${JSON.stringify(evidencePacket)}`;

  // Buffer first: no AI text reaches the browser until every citation token has been checked server-side.
  const result = await generateText({ model: model.model, system, messages: await convertToModelMessages(messages) });
  const checked = validateCitations(result.text, allowed);
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: "validated-answer" });
      writer.write({ type: "text-delta", id: "validated-answer", delta: checked });
      writer.write({ type: "text-end", id: "validated-answer" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
