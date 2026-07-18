"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@almedia/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** Renders the cited page and best-effort highlights quote tokens in the text layer. */
export default function PdfViewer({
  url,
  citationRef,
  quote,
}: {
  url: string;
  citationRef: string;
  quote: string;
}) {
  const targetPage = Number(/^p\.(\d+)/.exec(citationRef)?.[1] ?? 1);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(targetPage);
  const [pageWidth, setPageWidth] = useState(620);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setPageWidth(Math.min(620, Math.max(280, entry.contentRect.width - 24)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const tokens = useMemo(
    () =>
      quote
        .toLowerCase()
        .split(/[^a-z0-9äöüß.,]+/i)
        .filter((t) => t.length >= 4 || /\d/.test(t)),
    [quote],
  );

  const textRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!tokens.length) return str;
      const low = str.toLowerCase();
      if (tokens.some((t) => low.includes(t))) {
        return `<mark style="background:rgba(251,191,36,.45);color:inherit;border-radius:2px">${str}</mark>`;
      }
      return str;
    },
    [tokens],
  );

  return (
    <div ref={containerRef} className="flex w-full flex-col items-center gap-2 overflow-auto p-3">
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span>
          page {page} / {numPages || "?"}
        </span>
        <Button
          disabled={page >= numPages}
          onClick={() => setPage((p) => p + 1)}
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<p className="font-mono text-xs text-muted-foreground">rendering…</p>}
        error={<p className="font-mono text-xs text-red-400">failed to load PDF</p>}
      >
        <Page
          pageNumber={Math.min(Math.max(page, 1), Math.max(numPages, 1))}
          width={pageWidth}
          customTextRenderer={textRenderer}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
