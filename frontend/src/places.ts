/**
 * Places for math templates: one tree of subjects › courses › chapters › lessons (from /admin/content-tree).
 * A node key is "subject:<id>", "course:<id>", "chapter:<id>" or "lesson:<id>"; "" means none.
 */
import { indexSubjects, type SubjectNode } from './subjects';

export type PlaceType = 'subject' | 'course' | 'chapter' | 'lesson';

export interface ContentTree {
  subjects: SubjectNode[];
  courses: { id: string; title: string; subjectId: string | null }[];
  chapters: { id: string; courseId: string; title: string; position: number }[];
  lessons: { id: string; chapterId: string; courseId: string; title: string; position: number }[];
}

/** What a template (or published version) says about its place; subject/course/chapter include the ones above. */
export interface Placed {
  placeType?: PlaceType | null; placeId?: string | null;
  subjectId?: string | null; courseId?: string | null; chapterId?: string | null; lessonId?: string | null;
}

export interface PlaceNode { key: string; type: PlaceType; id: string; name: string; parentKey: string | null }

export const placeKey = (type: PlaceType | null | undefined, id: string | null | undefined) => (type && id ? `${type}:${id}` : '');
export const keyOf = (t: Placed) => placeKey(t.placeType, t.placeId);
export function splitKey(key: string): { type: PlaceType; id: string } | null {
  const i = key.indexOf(':');
  return i > 0 ? { type: key.slice(0, i) as PlaceType, id: key.slice(i + 1) } : null;
}

export interface PlaceIndex {
  roots: PlaceNode[];
  byKey: Map<string, PlaceNode>;
  children: (key: string) => PlaceNode[];
  /** Root-to-node chain. */
  path: (key: string) => PlaceNode[];
  /** "Math › Arithmetic Foundations › 1. Numbers › 1.2 Place value" */
  label: (key: string) => string;
  /** Is the template at this node or anywhere below it? A subject also holds its courses' templates. */
  contains: (key: string, t: Placed) => boolean;
  /** Depth-first order with depth, for pickers and flat lists. */
  ordered: { node: PlaceNode; depth: number }[];
}

export function indexPlaces(tree: ContentTree | null | undefined): PlaceIndex {
  const subjects = indexSubjects(tree?.subjects);
  const byKey = new Map<string, PlaceNode>();
  const kids = new Map<string, PlaceNode[]>();
  const add = (n: PlaceNode) => {
    byKey.set(n.key, n);
    if (n.parentKey) kids.set(n.parentKey, [...(kids.get(n.parentKey) ?? []), n]);
  };
  // Sub-subjects first, then the subject's courses; a course without a (known) subject is top level.
  subjects.ordered.forEach(({ subject: s }) => add({
    key: placeKey('subject', s.id), type: 'subject', id: s.id, name: s.name,
    parentKey: s.parentId && subjects.byId.has(s.parentId) ? placeKey('subject', s.parentId) : null,
  }));
  (tree?.courses ?? []).forEach((c) => add({
    key: placeKey('course', c.id), type: 'course', id: c.id, name: c.title,
    parentKey: c.subjectId && subjects.byId.has(c.subjectId) ? placeKey('subject', c.subjectId) : null,
  }));
  const chapters = [...(tree?.chapters ?? [])].sort((a, b) => a.position - b.position);
  const chapterPos = new Map(chapters.map((c) => [c.id, c.position]));
  chapters.forEach((c) => add({
    key: placeKey('chapter', c.id), type: 'chapter', id: c.id, name: `${c.position}. ${c.title}`, parentKey: placeKey('course', c.courseId),
  }));
  [...(tree?.lessons ?? [])].sort((a, b) => a.position - b.position).forEach((l) => add({
    key: placeKey('lesson', l.id), type: 'lesson', id: l.id, name: `${chapterPos.get(l.chapterId) ?? ''}.${l.position} ${l.title}`,
    parentKey: placeKey('chapter', l.chapterId),
  }));
  const roots = [...byKey.values()].filter((n) => !n.parentKey || !byKey.has(n.parentKey));
  const children = (key: string) => kids.get(key) ?? [];

  const path = (key: string) => {
    const chain: PlaceNode[] = [];
    const seen = new Set<string>();
    let cur = byKey.get(key);
    while (cur && !seen.has(cur.key)) {
      seen.add(cur.key);
      chain.unshift(cur);
      cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined;
    }
    return chain;
  };

  const contains = (key: string, t: Placed) => {
    const k = splitKey(key);
    if (!k) return false;
    if (k.type === 'subject') return !!t.subjectId && subjects.descendants(k.id).has(t.subjectId);
    if (k.type === 'course') return t.courseId === k.id;
    if (k.type === 'chapter') return t.chapterId === k.id;
    return t.lessonId === k.id;
  };

  const ordered: { node: PlaceNode; depth: number }[] = [];
  const visit = (n: PlaceNode, depth: number, seen: Set<string>) => {
    if (seen.has(n.key)) return;
    seen.add(n.key);
    ordered.push({ node: n, depth });
    children(n.key).forEach((c) => visit(c, depth + 1, seen));
  };
  const seen = new Set<string>();
  roots.forEach((r) => visit(r, 0, seen));

  return { roots, byKey, children, path, label: (key) => path(key).map((n) => n.name).join(' › '), contains, ordered };
}

/** Icon for each kind of place, matching the Content tree page. */
export const placeIcon = (type: PlaceType) =>
  (type === 'subject' ? 'folder' : type === 'course' ? 'book' : type === 'chapter' ? 'page' : 'lesson') as 'folder' | 'book' | 'page' | 'lesson';
