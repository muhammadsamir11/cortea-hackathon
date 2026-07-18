"use client";

import { useMemo, useState } from "react";
import { Badge } from "@almedia/ui/components/badge";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent } from "@almedia/ui/components/card";
import { Input } from "@almedia/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@almedia/ui/components/table";
import { FileText, Search } from "lucide-react";
import type { Citation, DocKind } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";

export function DocumentsTab({ data, onView }: { data: DossierData; onView: (citation: Citation) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DocKind | "all">("all");
  const kinds = useMemo(() => [...new Set(data.docs.map((doc) => doc.kind))].sort(), [data.docs]);
  const docs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.docs.filter((doc) =>
      (kind === "all" || doc.kind === kind) &&
      (!needle || `${doc.relativePath ?? doc.filename} ${doc.docType ?? ""} ${doc.summary ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [data.docs, kind, query]);
  const openDocument = (docId: string, ref: string) => onView({ docId, ref, quote: "" });

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 35 source artifacts…" className="pl-9 font-mono text-xs" />
        </label>
        <select value={kind} onChange={(event) => setKind(event.target.value as DocKind | "all")} className="h-9 rounded-md border bg-background px-3 font-mono text-xs">
          <option value="all">All formats</option>
          {kinds.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
        </select>
        <Badge variant="secondary" className="self-start font-mono sm:self-center">{docs.length}/{data.docs.length}</Badge>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"><TableHead>File</TableHead><TableHead>Type</TableHead><TableHead>Encoding</TableHead><TableHead>Deterministic summary</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell><Button variant="link" className="h-auto max-w-80 justify-start px-0 font-mono text-xs text-emerald-600 dark:text-emerald-300" onClick={() => openDocument(doc.id, doc.firstRef ?? "")}><FileText /><span className="truncate">{doc.relativePath ?? doc.filename}</span></Button></TableCell>
                <TableCell><Badge variant="secondary">{doc.docType ?? doc.kind}</Badge></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{doc.encoding ?? "—"}</TableCell>
                <TableCell className="max-w-md whitespace-normal text-xs text-muted-foreground">{doc.summary ?? "No deterministic summary available."}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">{(doc.unitCount ?? 0).toLocaleString("en-US")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-2 md:hidden">
        {docs.map((doc) => (
          <Card key={doc.id}><CardContent><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal px-0 text-left font-mono" onClick={() => openDocument(doc.id, doc.firstRef ?? "")}><FileText className="mt-0.5 shrink-0 self-start text-emerald-500"/><span className="min-w-0"><span className="block break-all text-sm font-medium">{doc.relativePath ?? doc.filename}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{doc.docType ?? doc.kind}</Badge>{doc.encoding ?? "—"} · {(doc.unitCount ?? 0).toLocaleString("en-US")} units</span><span className="mt-2 block font-sans text-xs text-muted-foreground">{doc.summary ?? "No deterministic summary available."}</span></span></Button></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
