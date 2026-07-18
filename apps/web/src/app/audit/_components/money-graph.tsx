"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Badge } from "@almedia/ui/components/badge";
import { Card, CardContent } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@almedia/ui/components/select";
import { ScrollArea } from "@almedia/ui/components/scroll-area";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { Citation, EntityCluster, Fact, Finding } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { CitationChip, eur, verdictOf } from "./components";

type NodeData = { cluster: EntityCluster; isCompany: boolean; hot: boolean };

function EntityNode({ data }: NodeProps) {
  const { cluster, isCompany, hot } = data as NodeData;
  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 font-mono text-xs shadow-sm ${
        isCompany
          ? "border-primary bg-primary/10 text-foreground"
          : hot
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-border bg-card text-foreground"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <p className="max-w-[190px] truncate font-semibold">{cluster.names[0]}</p>
      {cluster.names.length > 1 && (
        <p className="max-w-[190px] truncate text-[10px] text-warn">
          ⚠ alias: {cluster.names.slice(1).join(", ")}
        </p>
      )}
      {cluster.ibans.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {cluster.ibans.length} account{cluster.ibans.length > 1 ? "s" : ""}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

export function MoneyGraphView({
  data,
  onView,
}: {
  data: DossierData;
  onView: (c: Citation) => void;
}) {
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "light" ? "light" : "dark";
  const [activeFindingId, setActiveFindingId] = useState(data.findings[0]?.id ?? "all");
  const [selected, setSelected] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const facts = useMemo(() => new Map(data.facts.map((f) => [f.id, f])), [data.facts]);
  const openFindings = useMemo(
    () => new Set(data.findings.filter((f) => verdictOf(f) !== "acquitted").map((f) => f.id)),
    [data.findings],
  );
  const graph = useMemo(() => {
    if (activeFindingId === "all") return data.graph;
    const edges = data.graph.edges.filter((edge) => edge.findingIds.includes(activeFindingId));
    const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    return { ...data.graph, edges, nodes: data.graph.nodes.filter((node) => nodeIds.has(node.id)) };
  }, [activeFindingId, data.graph]);

  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 160 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of graph.nodes) g.setNode(n.id, { width: 210, height: 64 });
    for (const e of graph.edges) g.setEdge(e.from, e.to);
    dagre.layout(g);

    const hotNodes = new Set<string>();
    for (const e of graph.edges) {
      if (e.findingIds.some((id) => openFindings.has(id))) {
        hotNodes.add(e.from);
        hotNodes.add(e.to);
      }
    }
    const maxTotal = Math.max(1, ...graph.edges.map((e) => e.total));
    const isLight = colorMode === "light";
    const nodes: Node[] = graph.nodes.map((c) => ({
      id: c.id,
      type: "entity",
      position: { x: g.node(c.id).x - 105, y: g.node(c.id).y - 32 },
      data: {
        cluster: c,
        isCompany: c.id === graph.companyClusterId,
        hot: hotNodes.has(c.id) && c.id !== graph.companyClusterId,
      } satisfies NodeData,
    }));
    const edges: Edge[] = graph.edges.map((e, i) => {
      const hot = e.findingIds.some((id) => openFindings.has(id));
      return {
        id: `edge-${i}`,
        source: e.from,
        target: e.to,
        animated: hot,
        label: eur(e.total),
        labelStyle: {
          fill: hot ? "var(--destructive)" : "var(--muted-foreground)",
          fontFamily: "monospace",
          fontSize: 11,
        },
        labelBgStyle: {
          fill: isLight ? "var(--card)" : "var(--card)",
          fillOpacity: 0.92,
        },
        style: {
          stroke: hot ? "var(--destructive)" : "var(--border)",
          strokeWidth: 1.5 + 4 * Math.sqrt(e.total / maxTotal),
        },
      };
    });
    return { nodes, edges };
  }, [graph, openFindings, colorMode]);

  const selectedInfo = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "node") {
      const c = graph.nodes.find((n) => n.id === selected.id);
      if (!c) return null;
      const clusterFacts = c.factIds.map((id) => facts.get(id)).filter(Boolean) as Fact[];
      return { title: c.names.join(" / "), sub: c.ibans.join(" · "), facts: clusterFacts.slice(0, 8), findings: [] as Finding[] };
    }
    const idx = Number(selected.id.replace("edge-", ""));
    const e = graph.edges[idx];
    if (!e) return null;
    const from = graph.nodes.find((n) => n.id === e.from)?.names[0];
    const to = graph.nodes.find((n) => n.id === e.to)?.names[0];
    return {
      title: `${from} → ${to}`,
      sub: `${eur(e.total)} total`,
      facts: e.factIds.map((id) => facts.get(id)).filter(Boolean) as Fact[],
      findings: data.findings.filter((f) => e.findingIds.includes(f.id)),
    };
  }, [selected, data.findings, graph, facts]);

  if (graph.nodes.length === 0) {
    return (
      <Empty className="h-full min-h-[480px]">
        <EmptyHeader>
          <EmptyTitle>No graph for this scope</EmptyTitle>
          <EmptyDescription>Choose another finding scope or review open findings in Report.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="relative h-full min-h-[480px] bg-background">
      <div className="absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Finding scope
        </label>
        <Select
          value={activeFindingId}
          onValueChange={(value) => {
            setActiveFindingId(value);
            setSelected(null);
          }}
        >
          <SelectTrigger size="sm" className="max-w-[min(34rem,70vw)] font-mono text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="all">All detected risk flows</SelectItem>
            {data.findings.map((finding) => (
              <SelectItem key={finding.id} value={finding.id}>
                {finding.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => setSelected({ kind: "node", id: n.id })}
        onEdgeClick={(_, e) => setSelected({ kind: "edge", id: e.id })}
        onPaneClick={() => setSelected(null)}
        colorMode={colorMode}
      >
        <Background className="!bg-muted/30" gap={24} />
      </ReactFlow>
      <Card className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] bg-card/90 py-0 backdrop-blur">
        <CardContent className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-primary">■</span> audited company&nbsp;&nbsp;
          <span className="text-destructive">■</span> open finding&nbsp;&nbsp;
          <span className="text-warn">⚠</span> aliases collapsed
        </CardContent>
      </Card>
      {selectedInfo ? (
        <Card className="absolute bottom-3 left-3 max-h-[48%] w-[min(440px,calc(100%-1.5rem))] bg-card/95 shadow-md backdrop-blur">
          <CardContent>
            <ScrollArea className="max-h-[calc(48vh-2rem)]">
              <p className="font-mono text-sm text-foreground">{selectedInfo.title}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{selectedInfo.sub}</p>
              {selectedInfo.findings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedInfo.findings.map((f) => (
                    <div key={f.id}>
                      <p className="font-mono text-[11px] text-destructive">⚑ {f.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.citations.slice(0, 4).map((citation, index) => (
                          <CitationChip
                            key={`${citation.ref}-${index}`}
                            citation={citation}
                            docs={data.docs}
                            onView={onView}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 space-y-2">
                {selectedInfo.facts.map((f) => (
                  <div key={f.id} className="border-l border-border pl-2">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {[f.date, f.docNumber, f.amount != null ? eur(f.amount) : null, f.description ?? f.label]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {f.citations.map((c, i) => (
                        <CitationChip key={i} citation={c} docs={data.docs} onView={onView} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Badge variant="secondary" className="mt-2">
                click canvas to close
              </Badge>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card className="pointer-events-none absolute bottom-3 left-3 max-w-xs bg-card/90 py-0 backdrop-blur">
          <CardContent className="px-3 py-2">
            <Empty className="min-h-0 border-0 p-0">
              <EmptyHeader className="gap-1">
                <EmptyTitle className="font-mono text-xs">No selection</EmptyTitle>
                <EmptyDescription className="text-[11px]">
                  Click a node or edge to inspect counterparties and citations.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
