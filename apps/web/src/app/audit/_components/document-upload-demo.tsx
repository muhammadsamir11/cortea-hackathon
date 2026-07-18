"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@almedia/ui/components/badge";
import { Button } from "@almedia/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@almedia/ui/components/item";
import { Progress } from "@almedia/ui/components/progress";
import { cn } from "@almedia/ui/lib/utils";
import { FileUp, Info, Upload, X } from "lucide-react";

const ACCEPT = ".pdf,.xlsx,.xls,.csv,.tsv,.txt,.json";
const MAX_QUEUE = 5;

type QueueStatus = "uploading" | "queued";

type QueueItem = {
  id: string;
  name: string;
  sizeLabel: string;
  progress: number;
  status: QueueStatus;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toQueueItems(files: FileList | File[]): QueueItem[] {
  return Array.from(files).map((file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    sizeLabel: formatBytes(file.size),
    progress: 8,
    status: "uploading" as const,
  }));
}

export function DocumentUploadDemo() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Map<string, number>>(new Map());
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values())
        window.clearInterval(timer);
      timersRef.current.clear();
    };
  }, []);

  const startStaging = (ids: string[]) => {
    for (const id of ids) {
      if (timersRef.current.has(id)) continue;
      const tick = window.setInterval(() => {
        setQueue((prev) => {
          const row = prev.find((item) => item.id === id);
          if (!row || row.status !== "uploading") {
            window.clearInterval(tick);
            timersRef.current.delete(id);
            return prev;
          }
          const next = Math.min(100, row.progress + 14 + Math.random() * 16);
          if (next >= 100) {
            window.clearInterval(tick);
            timersRef.current.delete(id);
            return prev.map((item) =>
              item.id === id
                ? { ...item, progress: 100, status: "queued" as const }
                : item,
            );
          }
          return prev.map((item) =>
            item.id === id ? { ...item, progress: next } : item,
          );
        });
      }, 160);
      timersRef.current.set(id, tick);
    }
  };

  const enqueue = (files: FileList | File[]) => {
    const next = toQueueItems(files);
    if (next.length === 0) return;
    let keptIds: string[] = [];
    setQueue((prev) => {
      const merged = [...next, ...prev].slice(0, MAX_QUEUE);
      const kept = new Set(merged.map((item) => item.id));
      keptIds = next.map((item) => item.id).filter((id) => kept.has(id));
      for (const [id, timer] of timersRef.current) {
        if (!kept.has(id)) {
          window.clearInterval(timer);
          timersRef.current.delete(id);
        }
      }
      return merged;
    });
    startStaging(keptIds);
  };

  const dismiss = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearInterval(timer);
      timersRef.current.delete(id);
    }
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0)
            enqueue(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:flex-row sm:items-center sm:justify-between",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <Upload className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em]">
              Drop files here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, XLSX, CSV, TSV, TXT, JSON — kept in this browser only (demo)
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) enqueue(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full font-mono text-xs uppercase tracking-wide sm:w-auto"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp data-icon="inline-start" />
            Browse
          </Button>
        </div>
      </div>

      {/* <Alert>
          <Info />
          <AlertTitle className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Demo only
          </AlertTitle>
          <AlertDescription>
            Files are not written to the dossier. Use{" "}
            <code className="text-foreground">pnpm ingest</code> for real ingest.
          </AlertDescription>
        </Alert> */}

      {queue.length > 0 ? (
        <ItemGroup className="gap-2">
          {queue.map((item) => (
            <Item
              key={item.id}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              <ItemMedia variant="icon">
                <FileUp className="size-4 text-muted-foreground" />
              </ItemMedia>
              <ItemContent className="min-w-0 gap-1.5">
                <ItemTitle className="max-w-full truncate font-mono text-xs">
                  {item.name}
                </ItemTitle>
                <ItemDescription className="text-xs">
                  {item.sizeLabel}
                  {item.status === "uploading" ? " · Preparing…" : ""}
                </ItemDescription>
                {item.status === "uploading" ? (
                  <Progress value={item.progress} className="mt-0.5 h-1.5" />
                ) : null}
              </ItemContent>
              <ItemActions>
                {item.status === "queued" ? (
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] uppercase tracking-wide"
                  >
                    Queued · demo
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Dismiss ${item.name}`}
                  onClick={() => dismiss(item.id)}
                >
                  <X />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : null}
    </div>
  );
}
