"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@almedia/ui/components/alert";
import { Card, CardContent } from "@almedia/ui/components/card";
import { cn } from "@almedia/ui/lib/utils";
import type { Citation, Unit } from "@almedia/forensic/types";
import type { DossierData, EvidencePacket } from "@/lib/audit-data";
import { quoteInText } from "@almedia/forensic/normalize";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <p className="p-4 text-xs text-muted-foreground">loading PDF…</p>,
});

function Highlighted({ text, quote }: { text: string; quote: string }) {
  if (quote) {
    const idx = text.toLowerCase().indexOf(quote.toLowerCase());
    if (idx >= 0) {
      return <>{text.slice(0, idx)}<mark className="rounded-sm bg-amber-400/30 px-0.5 text-foreground">{text.slice(idx, idx + quote.length)}</mark>{text.slice(idx + quote.length)}</>;
    }
  }
  return <>{text}</>;
}

function UnitBlock({ unit, citation, active }: { unit: Unit; citation: Citation; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);
  return (
    <Card ref={ref} size="sm" className={cn(active && "ring-amber-500/50")}>
      <CardContent>
        <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{unit.ref}</p>
        <pre className="font-sans whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
          <Highlighted text={unit.text} quote={active ? citation.quote : ""} />
        </pre>
      </CardContent>
    </Card>
  );
}

function EvidenceTable({ packet, citation }: { packet: EvidencePacket; citation: Citation }) {
  const table = packet.table!;
  return (
    <div className="overflow-auto p-3">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {table.name} · cited row with four neighboring rows
      </p>
      <table className="min-w-max border-collapse text-[11px]">
        <thead className="sticky top-0 z-10 bg-card">
          <tr>
            <th className="border px-2 py-1.5 text-left text-muted-foreground">Reference</th>
            {table.columns.map((column) => <th key={column} className="border px-2 py-1.5 text-left text-muted-foreground">{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const active = row.citation.ref === packet.activeRef;
            return (
              <tr key={row.citation.ref} className={active ? "bg-amber-500/15 ring-1 ring-inset ring-amber-500/50" : "odd:bg-muted/20"}>
                <td className="border px-2 py-1.5 text-emerald-600 dark:text-emerald-300">{row.citation.ref}</td>
                {table.columns.map((column) => (
                  <td key={column} className="max-w-80 whitespace-pre-wrap border px-2 py-1.5 align-top">
                    <Highlighted text={row.values[column] ?? ""} quote={active ? citation.quote : ""} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceViewer({ citation, data }: { citation: Citation; data: DossierData }) {
  const doc = data.docs.find((candidate) => candidate.id === citation.docId);
  const [packet, setPacket] = useState<EvidencePacket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc || doc.kind === "pdf") return;
    const controller = new AbortController();
    setPacket(null);
    setError(null);
    fetch(`/api/dossier/${encodeURIComponent(data.name)}/evidence?docId=${encodeURIComponent(citation.docId)}&ref=${encodeURIComponent(citation.ref)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Evidence service returned ${response.status}`);
        return response.json() as Promise<EvidencePacket>;
      })
      .then(setPacket)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Evidence unavailable");
      });
    return () => controller.abort();
  }, [citation.docId, citation.ref, data.name, doc]);

  if (!doc) return <Alert variant="destructive" className="m-4"><AlertDescription>Unknown document: {citation.docId}</AlertDescription></Alert>;
  const activeRef = packet?.activeRef ?? packet?.units.find((unit) => citation.quote && quoteInText(citation.quote, unit.text))?.ref;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2">
        <p className="text-xs text-foreground">{doc.relativePath ?? doc.filename}</p>
        <p className="text-[10px] text-muted-foreground">{doc.docType ?? doc.kind} · {citation.ref}</p>
        {citation.quote && <Alert className="mt-2 border-amber-500/30 bg-amber-500/10 py-2"><AlertDescription className="text-[11px]">“{citation.quote}”</AlertDescription></Alert>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {doc.kind === "pdf" ? (
          <PdfViewer url={`/api/dossier/${data.name}/file/${doc.id}`} citationRef={citation.ref} quote={citation.quote} />
        ) : error ? (
          <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert>
        ) : !packet ? (
          <p className="p-4 text-xs text-muted-foreground">loading cited rows…</p>
        ) : packet.table ? (
          <EvidenceTable packet={packet} citation={citation} />
        ) : packet.units.length ? (
          <div className="space-y-2 p-3">
            {packet.units.map((unit) => <UnitBlock key={unit.ref} unit={unit} citation={citation} active={unit.ref === activeRef} />)}
          </div>
        ) : (
          <Alert className="m-3"><AlertDescription>This artifact was registered, but no readable evidence units were extracted.</AlertDescription></Alert>
        )}
      </div>
    </div>
  );
}
