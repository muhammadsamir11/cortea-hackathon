import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { EntityCluster, Finding, FindingLineItem } from "@almedia/forensic/types";
import { eur } from "../components";
import type { FilteredGraph } from "./filter-graph";
import { lineItemsForFindings } from "./resolve-selection";
import type { EvidenceNodeData } from "./evidence-node";

export type EntityNodeData = {
  cluster: EntityCluster;
  isCompany: boolean;
  hot: boolean;
  dimmed: boolean;
  selected: boolean;
  evidenceCount: number;
  evidenceHidden: number;
  /** True when this node is a money-flow source (needs right flow-out handle) */
  hasOutgoingFlow: boolean;
};

export const NODE_W = 220;
export const NODE_H = 72;
export const EVIDENCE_W = 204;
export const EVIDENCE_H = 46;
export const EVIDENCE_GAP = 10;
export const EVIDENCE_OFFSET_X = 48;
export const MAX_EVIDENCE_SUBNODES = 4;

function evidenceForCluster(
  cluster: EntityCluster,
  graph: FilteredGraph,
  findings: Finding[],
  isCompany: boolean,
): FindingLineItem[] {
  if (isCompany) return [];
  const touching = graph.edges.filter(
    (edge) => edge.from === cluster.id || edge.to === cluster.id,
  );
  const findingIds = new Set(touching.flatMap((edge) => edge.findingIds));
  const related = findings.filter((f) => findingIds.has(f.id));
  return lineItemsForFindings(related, cluster.names);
}

export function buildFlowElements(
  graph: FilteredGraph,
  openFindings: Set<string>,
  selectedId: string | null,
  findings: Finding[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const evidenceByCluster = new Map<string, FindingLineItem[]>();
  for (const cluster of graph.nodes) {
    const isCompany = cluster.id === graph.companyClusterId;
    evidenceByCluster.set(
      cluster.id,
      evidenceForCluster(cluster, graph, findings, isCompany),
    );
  }

  const g = new dagre.graphlib.Graph();
  const maxEvidenceShown = Math.max(
    0,
    ...[...evidenceByCluster.values()].map((items) =>
      Math.min(items.length, MAX_EVIDENCE_SUBNODES),
    ),
  );
  const evidenceStackH =
    maxEvidenceShown > 0
      ? maxEvidenceShown * EVIDENCE_H + Math.max(0, maxEvidenceShown - 1) * EVIDENCE_GAP
      : 0;
  const evidenceLaneW = maxEvidenceShown > 0 ? EVIDENCE_OFFSET_X + EVIDENCE_W : 0;

  g.setGraph({
    rankdir: "LR",
    nodesep: Math.max(56, evidenceStackH + 24),
    ranksep: 160 + evidenceLaneW,
    marginx: 24,
    marginy: 24 + Math.ceil(evidenceStackH / 2),
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of graph.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
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
  const hasSearch = graph.matchedNodeIds !== null;
  const outgoingFlow = new Set(graph.edges.map((edge) => edge.from));

  const nodes: Node[] = [];
  const evidenceEdges: Edge[] = [];

  for (const c of graph.nodes) {
    const layout = g.node(c.id);
    const isCompany = c.id === graph.companyClusterId;
    const matched = !hasSearch || graph.matchedNodeIds!.has(c.id);
    const dimmed = hasSearch && !matched;
    const items = evidenceByCluster.get(c.id) ?? [];
    const shownItems = items.slice(0, MAX_EVIDENCE_SUBNODES);
    const parentX = layout.x - NODE_W / 2;
    const parentY = layout.y - NODE_H / 2;
    const stackH =
      shownItems.length * EVIDENCE_H + Math.max(0, shownItems.length - 1) * EVIDENCE_GAP;
    const stackStartY = parentY + (NODE_H - stackH) / 2;
    const hasOutgoingFlow = outgoingFlow.has(c.id);

    nodes.push({
      id: c.id,
      type: "entity",
      position: { x: parentX, y: parentY },
      selected: selectedId === c.id,
      data: {
        cluster: c,
        isCompany,
        hot: hotNodes.has(c.id) && !isCompany,
        dimmed,
        selected: selectedId === c.id,
        evidenceCount: shownItems.length,
        evidenceHidden: Math.max(0, items.length - shownItems.length),
        hasOutgoingFlow,
      } satisfies EntityNodeData,
    });

    shownItems.forEach((item, index) => {
      const evidenceId = `evidence-${item.id}`;
      nodes.push({
        id: evidenceId,
        type: "evidence",
        position: {
          x: parentX + NODE_W + EVIDENCE_OFFSET_X,
          y: stackStartY + index * (EVIDENCE_H + EVIDENCE_GAP),
        },
        selected: selectedId === evidenceId,
        data: {
          item,
          parentEntityId: c.id,
          dimmed,
          selected: selectedId === evidenceId,
        } satisfies EvidenceNodeData,
      });
      evidenceEdges.push({
        id: `evidence-edge-${item.id}`,
        source: c.id,
        target: evidenceId,
        sourceHandle: "evidence",
        targetHandle: "evidence",
        type: "default",
        selectable: false,
        focusable: false,
        style: {
          stroke: "var(--muted-foreground)",
          strokeWidth: 1.25,
          opacity: dimmed ? 0.2 : 0.45,
        },
      });
    });
  }

  const moneyEdges: Edge[] = graph.edges.map((e, i) => {
    const id = `edge-${i}`;
    const hot = e.findingIds.some((id) => openFindings.has(id));
    const endpointsDimmed =
      hasSearch &&
      !graph.matchedNodeIds!.has(e.from) &&
      !graph.matchedNodeIds!.has(e.to);
    const selected = selectedId === id;
    return {
      id,
      source: e.from,
      target: e.to,
      sourceHandle: "flow-out",
      targetHandle: "flow-in",
      animated: hot && !endpointsDimmed,
      label: eur(e.total),
      selected,
      labelStyle: {
        fill: hot ? "var(--destructive)" : "var(--muted-foreground)",
        fontSize: 11,
        fontWeight: selected ? 600 : 500,
      },
      labelBgStyle: {
        fill: "var(--card)",
        fillOpacity: 0.94,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
      style: {
        stroke: selected
          ? "var(--primary)"
          : hot
            ? "var(--destructive)"
            : "var(--border)",
        strokeWidth: (1.25 + 4.5 * Math.sqrt(e.total / maxTotal)) * (selected ? 1.15 : 1),
        opacity: endpointsDimmed ? 0.22 : 1,
      },
    };
  });

  return { nodes, edges: [...moneyEdges, ...evidenceEdges] };
}
