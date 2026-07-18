import type { Fact, Finding, GraphEdge, MoneyGraph } from "../types";
import type { EntityIndex } from "./entities";

export function buildGraph(facts: Fact[], idx: EntityIndex, findings: Finding[]): MoneyGraph {
  const edgeMap = new Map<string, GraphEdge>();
  for (const f of facts) {
    if (f.kind !== "transaction") continue;
    const from = idx.factRole.get(`${f.id}:payer`);
    const to = idx.factRole.get(`${f.id}:payee`);
    if (!from || !to || from === to) continue;
    const key = `${from}→${to}|${f.currency ?? "EUR"}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { from, to, total: 0, currency: f.currency ?? "EUR", factIds: [], findingIds: [] });
    }
    const e = edgeMap.get(key)!;
    e.total += f.amount ?? 0;
    e.factIds.push(f.id);
  }
  for (const finding of findings) {
    const factSet = new Set(finding.factIds);
    for (const e of edgeMap.values()) {
      if (e.factIds.some((id) => factSet.has(id))) e.findingIds.push(finding.id);
    }
  }
  const usedClusters = new Set<string>();
  for (const e of edgeMap.values()) {
    usedClusters.add(e.from);
    usedClusters.add(e.to);
  }
  return {
    nodes: idx.clusters.filter((c) => usedClusters.has(c.id)),
    edges: [...edgeMap.values()],
    companyClusterId: idx.companyClusterId,
  };
}
