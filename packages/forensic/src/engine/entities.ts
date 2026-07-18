import type { EntityCluster, Fact } from "../types";
import { nameKey, namesSimilar, normalizeIban } from "../normalize";

interface Mention {
  factId: string;
  name?: string;
  iban?: string;
  vatId?: string;
  accountNumber?: string;
  address?: string;
  /** true when the IBAN comes from a document that *declares* bank details
   * (invoice, contract, entity master data) rather than a payment that used it */
  declaredIban: boolean;
  role: "payer" | "payee" | "entity";
}

export interface EntityIndex {
  clusters: EntityCluster[];
  /** cluster id per fact role, e.g. `${factId}:payer` -> cluster id */
  factRole: Map<string, string>;
  declaredIbans: Map<string, Set<string>>; // clusterId -> IBANs declared in docs
  paidIbans: Map<string, Set<string>>; // clusterId -> IBANs actually paid to
  companyClusterId: string | null;
  resolveName(name: string): string | null;
  /** Similar-name pairs are review hints only and never cause an automatic merge. */
  reviewSuggestions: Array<{ left: string; right: string }>;
}

function mentionsOf(fact: Fact): Mention[] {
  const m: Mention[] = [];
  const declared = fact.kind === "invoice" || fact.kind === "entity" || fact.kind === "contract_term";
  if (fact.payerName) {
    m.push({ factId: fact.id, name: fact.payerName, iban: normalizeIban(fact.payerIban) ?? undefined, declaredIban: declared, role: "payer" });
  }
  if (fact.payeeName) {
    m.push({ factId: fact.id, name: fact.payeeName, iban: normalizeIban(fact.payeeIban) ?? undefined, declaredIban: declared, role: "payee" });
  }
  if (fact.entityName) {
    m.push({
      factId: fact.id,
      name: fact.entityName,
      iban: normalizeIban(fact.entityIban) ?? undefined,
      vatId: fact.entityVatId,
      accountNumber: fact.entityAccountNumber,
      address: fact.entityAddress,
      declaredIban: true,
      role: "entity",
    });
  }
  return m;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
  keys() {
    return [...this.parent.keys()];
  }
}

export function buildEntityIndex(facts: Fact[], companyName: string): EntityIndex {
  const uf = new UnionFind();
  const mentions = facts.flatMap(mentionsOf);

  const authoritativeKey = (mention: Mention): string | null =>
    mention.accountNumber
      ? `account:${mention.accountNumber.trim()}`
      : mention.vatId
        ? `vat:${mention.vatId.trim().toUpperCase()}`
        : mention.name
          ? `name:${nameKey(mention.name)}`
          : mention.iban
            ? `iban:${mention.iban}`
            : null;

  // Account number and VAT ID are authoritative. Names never override a conflict.
  for (const mention of mentions) {
    const key = authoritativeKey(mention);
    if (key) uf.find(key);
  }
  // Attach name-only mentions only when the exact normalized name maps to one authoritative identity.
  const rootsByName = new Map<string, Set<string>>();
  for (const mention of mentions) {
    if (!mention.name || (!mention.accountNumber && !mention.vatId)) continue;
    const root = authoritativeKey(mention);
    if (!root) continue;
    const roots = rootsByName.get(nameKey(mention.name)) ?? new Set<string>();
    roots.add(root);
    rootsByName.set(nameKey(mention.name), roots);
  }
  for (const [normalizedName, roots] of rootsByName) {
    if (roots.size === 1) uf.union(`name:${normalizedName}`, [...roots][0]!);
  }

  // Similar names become review suggestions, not merge instructions.
  const nameKeys = [...new Set(mentions.filter((m) => m.name).map((m) => nameKey(m.name!)))];
  const reviewSuggestions: Array<{ left: string; right: string }> = [];
  for (let i = 0; i < nameKeys.length; i++) {
    for (let j = i + 1; j < nameKeys.length; j++) {
      if (namesSimilar(nameKeys[i]!, nameKeys[j]!)) {
        reviewSuggestions.push({ left: nameKeys[i]!, right: nameKeys[j]! });
      }
    }
  }

  // Materialize clusters.
  const byRoot = new Map<string, { names: Set<string>; accounts: Set<string>; ibans: Set<string>; vats: Set<string>; addrs: Set<string>; factIds: Set<string> }>();
  const factRole = new Map<string, string>();
  const declaredIbans = new Map<string, Set<string>>();
  const paidIbans = new Map<string, Set<string>>();

  const rootOf = (mention: Mention) => {
    const key = authoritativeKey(mention);
    return key ? uf.find(key) : null;
  };

  const rootIds = new Map<string, string>();
  let counter = 0;
  for (const m of mentions) {
    const root = rootOf(m);
    if (!root) continue;
    let cid = rootIds.get(root);
    if (!cid) {
      cid = `e-${++counter}`;
      rootIds.set(root, cid);
      byRoot.set(root, { names: new Set(), accounts: new Set(), ibans: new Set(), vats: new Set(), addrs: new Set(), factIds: new Set() });
    }
    const agg = byRoot.get(root)!;
    if (m.name) agg.names.add(m.name.trim());
    if (m.accountNumber) agg.accounts.add(m.accountNumber.trim());
    if (m.iban) agg.ibans.add(m.iban);
    if (m.vatId) agg.vats.add(m.vatId);
    if (m.address) agg.addrs.add(m.address);
    agg.factIds.add(m.factId);
    factRole.set(`${m.factId}:${m.role}`, cid);
    const bucket = m.declaredIban ? declaredIbans : paidIbans;
    if (m.iban) {
      if (!bucket.has(cid)) bucket.set(cid, new Set());
      bucket.get(cid)!.add(m.iban);
    }
  }

  const clusters: EntityCluster[] = [...rootIds.entries()].map(([root, cid]) => {
    const agg = byRoot.get(root)!;
    return {
      id: cid,
      names: [...agg.names],
      accountNumbers: [...agg.accounts],
      ibans: [...agg.ibans],
      vatIds: [...agg.vats],
      addresses: [...agg.addrs],
      factIds: [...agg.factIds],
    };
  });

  const companyClusterId =
    clusters.find((cluster) => cluster.names.some((name) => nameKey(name) === nameKey(companyName)))?.id ?? null;

  const idsByName = new Map<string, Set<string>>();
  for (const cluster of clusters) for (const name of cluster.names) {
    const ids = idsByName.get(nameKey(name)) ?? new Set<string>();
    ids.add(cluster.id);
    idsByName.set(nameKey(name), ids);
  }

  return {
    clusters,
    factRole,
    declaredIbans,
    paidIbans,
    companyClusterId,
    reviewSuggestions,
    resolveName(name: string) {
      const exact = idsByName.get(nameKey(name));
      return exact?.size === 1 ? [...exact][0]! : null;
    },
  };
}
