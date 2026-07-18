"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { Button } from "@almedia/ui/components/button";
import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { verdictOf } from "../components";
import { buildFlowElements } from "./build-flow";
import { filterGraph, type GraphFilters } from "./filter-graph";
import { nodeTypes } from "./node-types";
import { GraphToolbar } from "./graph-toolbar";
import { GraphInspector } from "./graph-inspector";
import { resolveSelectionInfo, type Selection } from "./resolve-selection";
import type { EvidenceNodeData } from "./evidence-node";

function GraphCanvas({
  data,
  onView,
  findingId,
  variant = "full",
}: {
  data: DossierData;
  onView: (c: Citation) => void;
  findingId?: string;
  variant?: "full" | "mini";
}) {
  const mini = variant === "mini";
  const { resolvedTheme } = useTheme();
  const { fitView } = useReactFlow();
  const searchRef = useRef<HTMLInputElement>(null);
  // next-themes resolves after mount; keep SSR + first client paint aligned
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => setThemeReady(true), []);
  const colorMode =
    themeReady && resolvedTheme === "light" ? "light" : "dark";

  const [filters, setFilters] = useState<GraphFilters>({
    findingId: findingId ?? "all",
    query: "",
    minAmount: 0,
    riskOnly: false,
  });
  const [selected, setSelected] = useState<Selection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!findingId) return;
    setFilters((prev) =>
      prev.findingId === findingId ? prev : { ...prev, findingId },
    );
  }, [findingId]);

  const facts = useMemo(() => new Map(data.facts.map((f) => [f.id, f])), [data.facts]);
  const openFindings = useMemo(
    () => new Set(data.findings.filter((f) => verdictOf(f) !== "acquitted").map((f) => f.id)),
    [data.findings],
  );

  const graph = useMemo(
    () => filterGraph(data.graph, filters, openFindings),
    [data.graph, filters, openFindings],
  );

  const selectedId = selected?.id ?? null;
  const { nodes, edges } = useMemo(
    () => buildFlowElements(graph, openFindings, selectedId, data.findings),
    [graph, openFindings, selectedId, data.findings],
  );

  const selectedInfo = useMemo(
    () => (selected ? resolveSelectionInfo(selected, graph, facts, data.findings) : null),
    [selected, graph, facts, data.findings],
  );

  const clearSelection = useCallback(() => {
    setSelected(null);
    setDrawerOpen(false);
  }, []);

  const openDrawer = useCallback((next: Selection) => {
    setSelected(next);
    setDrawerOpen(true);
  }, []);

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      if (node.type === "evidence") {
        const data = node.data as EvidenceNodeData;
        openDrawer({
          kind: "evidence",
          id: node.id,
          parentEntityId: data.parentEntityId,
          lineItemId: data.item.id,
        });
      } else {
        openDrawer({ kind: "node", id: node.id });
      }
      void fitView({
        nodes: [node],
        padding: 0.4,
        duration: 320,
        maxZoom: 1.35,
      });
    },
    [fitView, openDrawer],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        clearSelection();
        return;
      }
      if (typing) return;
      if (!mini && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void fitView({ padding: 0.18, duration: 280 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, fitView, mini]);

  const onFilterChange = useCallback((next: Partial<GraphFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    clearSelection();
  }, [clearSelection]);

  const emptyFiltered = graph.nodes.length === 0 || graph.edges.length === 0;

  return (
    <div
      className={
        mini
          ? "relative h-80 min-w-0 overflow-hidden rounded-xl bg-background ring-1 ring-foreground/5 dark:ring-foreground/10"
          : "relative h-full min-h-[480px] min-w-0 overflow-hidden bg-background"
      }
    >
      <ReactFlow
        nodes={emptyFiltered ? [] : nodes}
        edges={emptyFiltered ? [] : edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: mini ? 0.24 : 0.18 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        panOnScroll
        selectionOnDrag={false}
        onNodeClick={onNodeClick}
        onEdgeClick={(_, edge) => openDrawer({ kind: "edge", id: edge.id })}
        onPaneClick={() => {
          if (!drawerOpen) clearSelection();
        }}
        colorMode={colorMode}
        className="!bg-transparent"
        minZoom={0.25}
        maxZoom={1.75}
      >
        <Background gap={22} size={1} className="!bg-muted/25" />
        {!mini ? (
          <GraphToolbar
            filters={filters}
            findings={data.findings}
            searchRef={searchRef}
            onChange={onFilterChange}
            onClearSelection={clearSelection}
            hasSelection={Boolean(selected)}
          />
        ) : null}
        {emptyFiltered ? (
          <Panel position="top-center" className={mini ? "!m-3" : "!mt-16"}>
            <Card size="sm" className="max-w-sm backdrop-blur-md">
              <CardHeader>
                <CardTitle>
                  {mini ? "No money flows for this finding" : "No flows match these filters"}
                </CardTitle>
                {!mini ? (
                  <CardDescription>
                    Widen the finding filter, lower the minimum amount, or turn off Risk only.
                  </CardDescription>
                ) : (
                  <CardDescription>
                    This finding is not linked to any money flows yet.
                  </CardDescription>
                )}
              </CardHeader>
              {!mini ? (
                <CardFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onFilterChange({
                        findingId: "all",
                        query: "",
                        minAmount: 0,
                        riskOnly: false,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </Panel>
        ) : (
          <Controls
            showInteractive={false}
            className="!m-3 overflow-hidden rounded-[min(var(--radius-4xl),24px)] bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10 [&>button]:!border-border [&>button]:!bg-transparent"
          />
        )}
      </ReactFlow>

      <GraphInspector
        info={selectedInfo}
        open={drawerOpen && Boolean(selectedInfo)}
        docs={data.docs}
        onView={onView}
        onOpenChange={(open) => {
          if (!open) clearSelection();
          else setDrawerOpen(true);
        }}
      />
    </div>
  );
}

export function MoneyGraphView({
  data,
  onView,
  findingId,
  variant = "full",
}: {
  data: DossierData;
  onView: (c: Citation) => void;
  findingId?: string;
  variant?: "full" | "mini";
}) {
  const mini = variant === "mini";

  if (data.graph.nodes.length === 0) {
    return (
      <Empty className={mini ? "h-80" : "h-full min-h-[480px]"}>
        <EmptyHeader>
          <EmptyTitle>No graph for this dossier</EmptyTitle>
          <EmptyDescription>
            Run analysis to build money flows from the verified facts.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ReactFlowProvider key={findingId ?? "all"}>
      <GraphCanvas data={data} onView={onView} findingId={findingId} variant={variant} />
    </ReactFlowProvider>
  );
}
