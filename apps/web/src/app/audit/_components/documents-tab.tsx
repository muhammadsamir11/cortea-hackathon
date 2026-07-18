"use client";

import { useMemo, useState } from "react";
import { Badge } from "@almedia/ui/components/badge";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent, CardHeader } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@almedia/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@almedia/ui/components/select";
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
    return data.docs.filter(
      (doc) =>
        (kind === "all" || doc.kind === kind) &&
        (!needle ||
          `${doc.relativePath ?? doc.filename} ${doc.docType ?? ""} ${doc.summary ?? ""}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [data.docs, kind, query]);
  const openDocument = (docId: string, ref: string) => onView({ docId, ref, quote: "" });

  return (
    <div className="p-3 sm:p-4">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${data.docs.length} source artifacts…`}
                className="text-xs"
              />
            </InputGroup>
            <Select value={kind} onValueChange={(value) => setKind(value as DocKind | "all")}>
              <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Filter by format">
                <SelectValue placeholder="All formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                {kinds.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="self-start sm:self-center">
              {docs.length}/{data.docs.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {docs.length === 0 ? (
            <Empty className="min-h-48">
              <EmptyHeader>
                <EmptyTitle>No documents match</EmptyTitle>
                <EmptyDescription>Clear the search or choose another format filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Encoding</TableHead>
                      <TableHead>Deterministic summary</TableHead>
                      <TableHead className="pr-4 text-right">Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="pl-4 font-medium">
                          <Button
                            variant="link"
                            className="h-auto max-w-80 justify-start px-0 text-sm text-foreground"
                            onClick={() => openDocument(doc.id, doc.firstRef ?? "")}
                          >
                            <FileText />
                            <span className="truncate">{doc.relativePath ?? doc.filename}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{doc.docType ?? doc.kind}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{doc.encoding ?? "—"}</TableCell>
                        <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                          {doc.summary ?? "No deterministic summary available."}
                        </TableCell>
                        <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                          {(doc.unitCount ?? 0).toLocaleString("en-US")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-2 p-4 md:hidden">
                {docs.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="ghost"
                    className="h-auto w-full justify-start whitespace-normal px-0 text-left"
                    onClick={() => openDocument(doc.id, doc.firstRef ?? "")}
                  >
                    <FileText className="mt-0.5 shrink-0 self-start text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block break-all text-sm font-medium">{doc.relativePath ?? doc.filename}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{doc.docType ?? doc.kind}</Badge>
                        {doc.encoding ?? "—"} · {(doc.unitCount ?? 0).toLocaleString("en-US")} units
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {doc.summary ?? "No deterministic summary available."}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
