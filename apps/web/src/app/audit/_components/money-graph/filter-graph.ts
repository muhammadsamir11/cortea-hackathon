import type { MoneyGraph } from "@almedia/forensic/types";

export type GraphFilters = {
  findingId: string;
  query: string;
  minAmount: number;
  riskOnly: boolean;
};

export type FilteredGraph = MoneyGraph & {
  /** Node ids matching search; null when search is inactive */
  matchedNodeIds: Set<string> | null;
};

function nodeMatchesQuery(
  node: MoneyGraph["nodes"][number],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    ...node.names,
    ...node.ibans,
    ...(node.accountNumbers ?? []),
    ...node.vatIds,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Apply investigation filters. Search dims matches; it does not remove nodes. */
export function filterGraph(
  graph: MoneyGraph,
  filters: GraphFilters,
  openFindingIds: Set<string>,
): FilteredGraph {
  let edges = graph.edges;

  if (filters.findingId !== "all") {
    edges = edges.filter((edge) => edge.findingIds.includes(filters.findingId));
  }

  if (filters.riskOnly) {
    edges = edges.filter((edge) =>
      edge.findingIds.some((id) => openFindingIds.has(id)),
    );
  }

  if (filters.minAmount > 0) {
    edges = edges.filter((edge) => edge.total >= filters.minAmount);
  }

  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  // Keep company cluster even if temporarily unconnected after filters
  if (graph.companyClusterId) connected.add(graph.companyClusterId);

  const nodes =
    filters.findingId === "all" &&
    !filters.riskOnly &&
    filters.minAmount <= 0
      ? graph.nodes
      : graph.nodes.filter((node) => connected.has(node.id));

  const query = filters.query.trim();
  const matchedNodeIds =
    query.length === 0
      ? null
      : new Set(nodes.filter((node) => nodeMatchesQuery(node, query)).map((n) => n.id));

  return {
    ...graph,
    nodes,
    edges,
    matchedNodeIds,
  };
}
