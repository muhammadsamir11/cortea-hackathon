"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@almedia/ui/components/card";
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
import { Badge, CitationChip, eur, verdictOf } from "./components";

type NodeData = { cluster: EntityCluster; isCompany: boolean; hot: boolean };

function EntityNode({ data }: NodeProps) {
  const { cluster, isCompany, hot } = data as NodeData;
  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 font-mono text-xs shadow-lg ${
        isCompany
          ? "border-emerald-500 bg-emerald-950/90 text-emerald-200"
          : hot
            ? "border-red-500 bg-red-950/80 text-red-100 shadow-red-900/50"
            : "border-zinc-700 bg-zinc-900 text-zinc-300"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-600" />
      <p className="max-w-[190px] truncate font-semibold">{cluster.names[0]}</p>
      {cluster.names.length > 1 && (
        <p className="max-w-[190px] truncate text-[10px] text-amber-400">
          ⚠ alias: {cluster.names.slice(1).join(", ")}
        </p>
      )}
      {cluster.ibans.length > 0 && (
        <p className="text-[10px] opacity-60">
          {cluster.ibans.length} account{cluster.ibans.length > 1 ? "s" : ""}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-zinc-600" />
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
        labelStyle: { fill: hot ? "#fca5a5" : "#a1a1aa", fontFamily: "monospace", fontSize: 11 },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.9 },
        style: {
          stroke: hot ? "#ef4444" : "#3f3f46",
          strokeWidth: 1.5 + 4 * Math.sqrt(e.total / maxTotal),
        },
      };
    });
    return { nodes, edges };
  }, [graph, openFindings]);

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

  return (
    <div className="relative h-full min-h-[480px]">
      <div className="absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-md border bg-card/95 p-2 shadow-lg backdrop-blur">
        <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Finding scope</label>
        <select
          value={activeFindingId}
          onChange={(event) => { setActiveFindingId(event.target.value); setSelected(null); }}
          className="mt-1 max-w-[min(34rem,70vw)] bg-transparent font-mono text-[11px] text-foreground outline-none"
        >
          <option value="all">All detected risk flows</option>
          {data.findings.map((finding) => <option key={finding.id} value={finding.id}>{finding.title}</option>)}
        </select>
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
        colorMode="dark"
      >
        <Background color="#27272a" gap={24} />
      </ReactFlow>
      <Card className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] bg-card/90 py-0 backdrop-blur">
        <CardContent className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-emerald-500">■</span> audited company&nbsp;&nbsp;
          <span className="text-red-500">■</span> open finding&nbsp;&nbsp;
          <span className="text-amber-500">⚠</span> aliases collapsed
        </CardContent>
      </Card>
      {selectedInfo && (
        <Card className="absolute bottom-3 left-3 max-h-[48%] w-[min(440px,calc(100%-1.5rem))] bg-card/95 shadow-2xl backdrop-blur">
          <CardContent>
          <ScrollArea className="max-h-[calc(48vh-2rem)]">
          <p className="font-mono text-sm text-foreground">{selectedInfo.title}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{selectedInfo.sub}</p>
          {selectedInfo.findings.length > 0 && (
            <div className="mt-2 space-y-1">
              {selectedInfo.findings.map((f) => (
                <div key={f.id}>
                  <p className="font-mono text-[11px] text-destructive">⚑ {f.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{f.citations.slice(0, 4).map((citation, index) => <CitationChip key={`${citation.ref}-${index}`} citation={citation} docs={data.docs} onView={onView} />)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {selectedInfo.facts.map((f) => (
              <div key={f.id} className="border-l pl-2">
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
          <Badge variant="secondary" className="mt-2">click canvas to close</Badge>
          </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
