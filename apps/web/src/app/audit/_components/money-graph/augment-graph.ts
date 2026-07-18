import type { Finding, MoneyGraph } from "@almedia/forensic/types";

function stableEntityId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sinkLabel(finding: Finding): string {
  switch (finding.checkId) {
    case "taxCompleteness":
      return "VAT export gap";
    case "journalChangeControl":
      return "Journal control breach";
    case "aiDiscovery":
      return finding.title.length > 42 ? `${finding.title.slice(0, 42)}…` : finding.title;
    default:
      return finding.fraudType?.replaceAll("_", " ") || finding.checkId || "Control gap";
  }
}

function edgeTotal(finding: Finding): number {
  if (finding.amountInvolved != null && finding.amountInvolved > 0) {
    return finding.amountInvolved;
  }
  const fromItems = (finding.lineItems ?? []).reduce((sum, item) => sum + (item.amount || 0), 0);
  if (fromItems > 0) return fromItems;
  // Keep a visible edge for control-only findings (e.g. storno volume).
  return Math.max(1, finding.lineItems?.length ?? 0);
}

/**
 * Findings without counterparty-linked line items never get edges from the
 * SQLite control graph builder. Synthesize scheme-level flows so the mini
 * graph (and filtered full graph) stay useful.
 */
export function augmentGraphWithFindingFlows(
  graph: MoneyGraph,
  findings: Finding[],
): MoneyGraph {
  const companyId = graph.companyClusterId;
  if (!companyId || !findings.length) return graph;

  const covered = new Set(graph.edges.flatMap((edge) => edge.findingIds));
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const finding of findings) {
    if (covered.has(finding.id)) continue;

    const namedItems = (finding.lineItems ?? []).filter((item) => item.counterparty?.trim());
    if (namedItems.length) {
      const byParty = new Map<string, number>();
      for (const item of namedItems) {
        const name = item.counterparty!.trim();
        byParty.set(name, (byParty.get(name) ?? 0) + item.amount);
      }
      for (const [name, amount] of byParty) {
        const sinkId = stableEntityId("entity-party", name);
        if (!nodeIds.has(sinkId)) {
          nodes.push({
            id: sinkId,
            names: [name],
            ibans: [],
            vatIds: [],
            addresses: [],
            factIds: [],
          });
          nodeIds.add(sinkId);
        }
        edges.push({
          from: companyId,
          to: sinkId,
          total: amount,
          currency: "EUR",
          factIds: [],
          findingIds: [finding.id],
        });
      }
      continue;
    }

    const hasSignal =
      (finding.amountInvolved != null && finding.amountInvolved > 0) ||
      (finding.lineItems?.length ?? 0) > 0 ||
      finding.origin === "ai-assisted";
    if (!hasSignal) continue;

    const sinkId = `entity-finding-${finding.id}`;
    if (!nodeIds.has(sinkId)) {
      nodes.push({
        id: sinkId,
        names: [sinkLabel(finding)],
        ibans: [],
        vatIds: [],
        addresses: [],
        factIds: [],
      });
      nodeIds.add(sinkId);
    }
    edges.push({
      from: companyId,
      to: sinkId,
      total: edgeTotal(finding),
      currency: "EUR",
      factIds: [],
      findingIds: [finding.id],
    });
  }

  return { ...graph, nodes, edges };
}
