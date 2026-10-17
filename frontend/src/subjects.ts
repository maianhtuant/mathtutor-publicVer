/**
 * Subject hierarchy helpers (any depth: Math › Pre-Algebra › Fractions).
 * Every page that shows subjects uses these so ordering, names and counts match.
 */
export interface SubjectNode {
  id: string;
  name: string;
  parentId: string | null;
  displayOrder?: number;
  active?: boolean;
  description?: string | null;
  videoCount?: number;
}

export interface SubjectIndex<T extends SubjectNode> {
  roots: T[];
  byId: Map<string, T>;
  children: (id: string) => T[];
  /** The subject itself plus all sub-subjects below it. */
  descendants: (id: string) => Set<string>;
  /** Root-to-leaf chain ending with the subject. */
  path: (id: string) => T[];
  /** "Math › Pre-Algebra › Fractions" */
  label: (id: string) => string;
  /** Depth-first order with depth, for pickers and flat lists. */
  ordered: { subject: T; depth: number }[];
}

const byOrder = (a: SubjectNode, b: SubjectNode) =>
  (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name);

export function indexSubjects<T extends SubjectNode>(list: T[] | null | undefined): SubjectIndex<T> {
  const all = list ?? [];
  const byId = new Map(all.map((s) => [s.id, s]));
  const kids = new Map<string, T[]>();
  const roots: T[] = [];
  for (const s of all) {
    // A parent that no longer exists is treated as top level.
    if (s.parentId && byId.has(s.parentId)) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s]);
    else roots.push(s);
  }
  roots.sort(byOrder);
  kids.forEach((v) => v.sort(byOrder));
  const children = (id: string) => kids.get(id) ?? [];

  const descendants = (id: string) => {
    const out = new Set<string>();
    const walk = (x: string) => {
      if (out.has(x)) return; // guards against bad data loops
      out.add(x);
      children(x).forEach((c) => walk(c.id));
    };
    walk(id);
    return out;
  };

  const path = (id: string) => {
    const chain: T[] = [];
    const seen = new Set<string>();
    let cur = byId.get(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain;
  };

  const ordered: { subject: T; depth: number }[] = [];
  const visit = (s: T, depth: number, seen: Set<string>) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    ordered.push({ subject: s, depth });
    children(s.id).forEach((c) => visit(c, depth + 1, seen));
  };
  const seen = new Set<string>();
  roots.forEach((r) => visit(r, 0, seen));

  return {
    roots, byId, children, descendants, path, ordered,
    label: (id) => path(id).map((s) => s.name).join(' › '),
  };
}

/** Picker options in tree order with full-path labels; optionally hide one subject's own branch. */
export function subjectOptions<T extends SubjectNode>(idx: SubjectIndex<T>, excludeBranchOf?: string) {
  const hidden = excludeBranchOf ? idx.descendants(excludeBranchOf) : new Set<string>();
  return idx.ordered.filter((o) => !hidden.has(o.subject.id)).map((o) => ({ value: o.subject.id, label: idx.label(o.subject.id) }));
}
