"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, TriangleAlert } from "lucide-react";
import { cn } from "@almedia/ui/lib/utils";
import type { EntityNodeData } from "./build-flow";

function EntityNodeComponent({ data }: NodeProps) {
  const {
    cluster,
    isCompany,
    hot,
    dimmed,
    selected,
    evidenceCount,
    evidenceHidden,
    hasOutgoingFlow,
  } = data as EntityNodeData;
  const aliasCount = Math.max(0, cluster.names.length - 1);
  const showFlowOut = hasOutgoingFlow;
  const showEvidence = evidenceCount > 0;

  return (
    <div
      className={cn(
        "w-[220px] rounded-[min(var(--radius-4xl),24px)] px-3 py-2.5 text-left shadow-sm ring-1 transition-[opacity,box-shadow,ring-color] duration-200",
        isCompany && "bg-primary/10 text-foreground ring-primary/25",
        !isCompany && hot && "bg-destructive/8 text-foreground ring-destructive/20",
        !isCompany && !hot && "bg-card text-foreground ring-foreground/5 dark:ring-foreground/10",
        selected && "shadow-md ring-2 ring-primary/35",
        dimmed && "opacity-25",
      )}
    >
      <Handle
        id="flow-in"
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-muted-foreground/70"
      />
      <div className="flex items-start gap-2">
        {isCompany ? (
          <Building2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight tracking-tight">
            {cluster.names[0]}
          </p>
          {aliasCount > 0 ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-warn">
              <TriangleAlert className="size-2.5 shrink-0" aria-hidden />
              <span className="truncate">
                {aliasCount} alias{aliasCount > 1 ? "es" : ""}: {cluster.names.slice(1).join(", ")}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {evidenceCount > 0
              ? `${evidenceCount} evidence link${evidenceCount > 1 ? "s" : ""}${
                  evidenceHidden > 0 ? ` · +${evidenceHidden} more` : ""
                }`
              : cluster.ibans.length > 0
                ? `${cluster.ibans.length} account${cluster.ibans.length > 1 ? "s" : ""}`
                : isCompany
                  ? "Audited company"
                  : "Counterparty"}
          </p>
        </div>
      </div>
      {showFlowOut ? (
        <Handle
          id="flow-out"
          type="source"
          position={Position.Right}
          style={{ top: showEvidence ? "30%" : "50%" }}
          className="!size-2 !border-0 !bg-muted-foreground/70"
        />
      ) : null}
      {showEvidence ? (
        <Handle
          id="evidence"
          type="source"
          position={Position.Right}
          style={{ top: showFlowOut ? "70%" : "50%" }}
          className="!size-2 !border-0 !bg-muted-foreground/60"
        />
      ) : null}
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
