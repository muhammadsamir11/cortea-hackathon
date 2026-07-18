"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";
import { cn } from "@almedia/ui/lib/utils";
import { eur } from "../components";
import type { FindingLineItem } from "@almedia/forensic/types";

export type EvidenceNodeData = {
  item: FindingLineItem;
  parentEntityId: string;
  dimmed: boolean;
  selected: boolean;
};

function EvidenceNodeComponent({ data }: NodeProps) {
  const { item, dimmed, selected } = data as EvidenceNodeData;

  return (
    <div
      className={cn(
        "w-[204px] rounded-[min(var(--radius-4xl),24px)] bg-card px-2.5 py-1.5 text-left shadow-sm ring-1 ring-foreground/5 transition-[opacity,box-shadow,ring-color] duration-200 dark:ring-foreground/10",
        selected && "ring-2 ring-primary/40",
        dimmed && "opacity-25",
      )}
    >
      <Handle
        id="evidence"
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-muted-foreground/60"
      />
      <div className="flex items-start gap-1.5">
        <FileText className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium tabular-nums text-foreground">
            {eur(item.amount)}
            {item.documentNumber ? (
              <span className="font-normal text-muted-foreground"> · {item.documentNumber}</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {[item.date, item.description ?? item.label].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

export const EvidenceNode = memo(EvidenceNodeComponent);
