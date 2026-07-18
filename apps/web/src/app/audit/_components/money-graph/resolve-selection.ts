import type { Fact, Finding, FindingLineItem } from "@almedia/forensic/types";
import type { FilteredGraph } from "./filter-graph";
import type { InspectorInfo } from "./graph-inspector";
import { eur } from "../components";

export type Selection =
  | { kind: "node" | "edge"; id: string }
  | { kind: "evidence"; id: string; parentEntityId: string; lineItemId: string };

export function lineItemsForFindings(
  related: Finding[],
  counterpartyNames: string[] | null,
): FindingLineItem[] {
  const nameSet = counterpartyNames
    ? new Set(counterpartyNames.map((n) => n.toLowerCase()))
    : null;
  const items: FindingLineItem[] = [];
  for (const finding of related) {
    for (const item of finding.lineItems ?? []) {
      if (nameSet && item.counterparty && !nameSet.has(item.counterparty.toLowerCase())) {
        continue;
      }
      if (nameSet && !item.counterparty) continue;
      items.push(item);
    }
  }
  return items;
}

export function resolveSelectionInfo(
  selected: Selection,
  graph: FilteredGraph,
  facts: Map<string, Fact>,
  findings: Finding[],
): InspectorInfo | null {
  if (selected.kind === "evidence") {
    const cluster = graph.nodes.find((n) => n.id === selected.parentEntityId);
    if (!cluster) return null;
    const touching = graph.edges.filter(
      (edge) => edge.from === cluster.id || edge.to === cluster.id,
    );
    const findingIds = new Set(touching.flatMap((edge) => edge.findingIds));
    const related = findings.filter((f) => findingIds.has(f.id));
    const allItems = lineItemsForFindings(related, cluster.names);
    const focus = allItems.find((item) => item.id === selected.lineItemId);
    const lineItems = focus ? [focus, ...allItems.filter((i) => i.id !== focus.id)].slice(0, 24) : allItems.slice(0, 24);
    return {
      title: focus
        ? `${eur(focus.amount)}${focus.documentNumber ? ` · ${focus.documentNumber}` : ""}`
        : cluster.names[0] ?? "Evidence",
      subtitle: focus
        ? [focus.date, focus.description ?? focus.label, cluster.names[0]].filter(Boolean).join(" · ")
        : cluster.names.join(" / "),
      facts: [],
      findings: related.filter((f) =>
        (f.lineItems ?? []).some((item) => item.id === selected.lineItemId),
      ),
      lineItems,
    };
  }

  if (selected.kind === "node") {
    const cluster = graph.nodes.find((n) => n.id === selected.id);
    if (!cluster) return null;

    const touching = graph.edges.filter(
      (edge) => edge.from === cluster.id || edge.to === cluster.id,
    );
    const findingIds = new Set(touching.flatMap((edge) => edge.findingIds));
    const related = findings.filter((f) => findingIds.has(f.id));
    const isCompany = cluster.id === graph.companyClusterId;
    const lineItems = lineItemsForFindings(related, isCompany ? null : cluster.names).slice(
      0,
      24,
    );
    const clusterFacts = cluster.factIds
      .map((id) => facts.get(id))
      .filter(Boolean) as Fact[];

    const evidenceBits = [
      related.length > 0
        ? `${related.length} finding${related.length === 1 ? "" : "s"}`
        : null,
      lineItems.length > 0
        ? `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`
        : null,
      clusterFacts.length > 0
        ? `${clusterFacts.length} fact${clusterFacts.length === 1 ? "" : "s"}`
        : null,
      cluster.ibans.length > 0 ? cluster.ibans.join(" · ") : null,
    ].filter(Boolean);

    return {
      title: cluster.names.join(" / "),
      subtitle: evidenceBits.join(" · ") || "No linked evidence",
      facts: clusterFacts.slice(0, 12),
      findings: related,
      lineItems,
    };
  }

  const idx = Number(selected.id.replace("edge-", ""));
  const edge = graph.edges[idx];
  if (!edge) return null;
  const fromNode = graph.nodes.find((n) => n.id === edge.from);
  const toNode = graph.nodes.find((n) => n.id === edge.to);
  const from = fromNode?.names[0] ?? edge.from;
  const to = toNode?.names[0] ?? edge.to;
  const related = findings.filter((f) => edge.findingIds.includes(f.id));
  const counterparty =
    edge.to === graph.companyClusterId
      ? fromNode
      : edge.from === graph.companyClusterId
        ? toNode
        : toNode;
  const lineItems = lineItemsForFindings(
    related,
    counterparty?.names ?? [to, from].filter(Boolean),
  ).slice(0, 24);
  const edgeFacts = edge.factIds.map((id) => facts.get(id)).filter(Boolean) as Fact[];

  return {
    title: `${from} → ${to}`,
    subtitle: `${eur(edge.total)} total · ${edge.currency}`,
    facts: edgeFacts,
    findings: related,
    lineItems,
  };
}
