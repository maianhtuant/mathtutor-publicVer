import { ReactNode, createElement, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { indexPlaces, placeIcon, type ContentTree, type PlaceIndex, type PlaceNode } from '../places';
import { indexSubjects, type SubjectNode } from '../subjects';
import { colors, space } from '../theme';
import { TreeIcon } from './web';

/** One row of a folder tree: the caret opens/closes it, the rest selects it. */
export function FolderRow({ depth, label, count, selected, expandable, open, onToggle, onPress, drop, icon = 'folder' }: {
  depth: number; label: string; count?: number; selected: boolean;
  expandable?: boolean; open?: boolean; onToggle?: () => void; onPress: () => void;
  /** Set while something is being dragged: this folder accepts the drop. */
  drop?: { active: boolean; onDragEnter: () => void; onDragLeave: () => void; onDrop: () => void };
  icon?: 'folder' | 'page' | 'book' | 'lesson';
}) {
  const row = (
    <Pressable onPress={onPress} accessibilityRole="treeitem" aria-selected={selected} aria-expanded={expandable ? !!open : undefined}
      style={({ hovered }: any) => [styles.folder, { paddingLeft: 6 + depth * 16 }, hovered && !selected && { backgroundColor: colors.paper2 },
        selected && { backgroundColor: colors.ink }]}>
      <Pressable onPress={(e: any) => { e.stopPropagation?.(); onToggle?.(); }} disabled={!expandable}
        aria-label={expandable ? `${open ? 'Collapse' : 'Expand'} ${label}` : undefined} style={styles.caretBox}>
        <Text style={[styles.caret, selected && { color: colors.paper }]}>{expandable ? (open ? '▼' : '▶') : ''}</Text>
      </Pressable>
      <TreeIcon kind={icon} size={16} />
      <Text style={[styles.folderLabel, selected && { color: colors.paper, fontWeight: '600' }]} numberOfLines={2}>{label}</Text>
      {count != null ? <Text style={[styles.folderCount, selected && { color: colors.paper }]}>{count}</Text> : null}
    </Pressable>
  );
  if (!drop) return row;
  return createElement('div', {
    onDragEnter: (e: any) => { e.preventDefault(); drop.onDragEnter(); },
    onDragOver: (e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
    // Leaving into a child element of the same row is not leaving the folder.
    onDragLeave: (e: any) => { if (!e.currentTarget.contains(e.relatedTarget)) drop.onDragLeave(); },
    onDrop: (e: any) => { e.preventDefault(); drop.onDrop(); },
    style: { borderRadius: 6, outline: drop.active ? `2px solid ${colors.accent}` : '1px dashed transparent',
      background: drop.active ? colors.accentSoft : 'transparent' },
  }, row);
}

/** Open/closed folders; the folders on the path to the selected item open whenever the selection changes. */
function useOpenFolders(pathIds: string[]) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const key = pathIds.join('/');
  useEffect(() => {
    if (pathIds.length) setOpen((o) => new Set([...o, ...pathIds]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return { open, toggle, openAll: (ids: string[]) => setOpen((o) => new Set([...o, ...ids])) };
}

/** Choose one subject (or sub-subject) from the folder tree. */
export function SubjectPicker({ subjects, value, onChange, noneLabel, maxHeight = 320 }: {
  subjects: SubjectNode[] | null | undefined; value: string; onChange: (id: string) => void;
  /** Shown as a first row that clears the subject; omit when a subject is required. */
  noneLabel?: string; maxHeight?: number;
}) {
  const idx = useMemo(() => indexSubjects(subjects), [subjects]);
  const { open, toggle } = useOpenFolders(value ? idx.path(value).map((s) => s.id).slice(0, -1) : []);
  const folder = (n: SubjectNode, depth: number): ReactNode => {
    const kids = idx.children(n.id);
    const isOpen = open.has(n.id);
    return (
      <View key={n.id}>
        <FolderRow depth={depth} label={n.name} selected={value === n.id} expandable={kids.length > 0} open={isOpen}
          onToggle={() => toggle(n.id)} onPress={() => { onChange(n.id); if (kids.length && !isOpen) toggle(n.id); }} />
        {isOpen ? kids.map((k) => folder(k, depth + 1)) : null}
      </View>
    );
  };
  return (
    <ScrollView style={[styles.box, { maxHeight }]} contentContainerStyle={{ padding: space(1) }}>
      <View accessibilityRole="tree" aria-label="Subject">
        {noneLabel != null ? <FolderRow depth={0} label={noneLabel} selected={!value} onPress={() => onChange('')} /> : null}
        {idx.roots.map((r) => folder(r, 0))}
        {!idx.roots.length ? <Text style={styles.empty}>No subjects yet.</Text> : null}
      </View>
    </ScrollView>
  );
}

/** Choose one place for a template: a subject, course, chapter or lesson (Content tree order). */
export function PlacePicker({ tree, value, onChange, noneLabel = 'Nowhere yet', maxHeight = 320 }: {
  tree: ContentTree | null | undefined; value: string; onChange: (key: string) => void; noneLabel?: string; maxHeight?: number;
}) {
  const places = useMemo(() => indexPlaces(tree), [tree]);
  const { open, toggle } = useOpenFolders(value ? places.path(value).map((n) => n.key).slice(0, -1) : []);
  return (
    <ScrollView style={[styles.box, { maxHeight }]} contentContainerStyle={{ padding: space(1) }}>
      <View accessibilityRole="tree" aria-label="Place">
        <FolderRow depth={0} label={noneLabel} selected={!value} onPress={() => onChange('')} />
        <PlaceTreeRows places={places} selected={value} open={open} onToggle={toggle} showEmpty
          onSelect={(key) => { onChange(key); if (places.children(key).length && !open.has(key)) toggle(key); }} />
        {!places.roots.length ? <Text style={styles.empty}>No subjects or courses yet.</Text> : null}
      </View>
    </ScrollView>
  );
}

/**
 * Rows of the subject › course › chapter › lesson tree. With `count`, every row shows how many templates it holds
 * and rows holding none are hidden unless `showEmpty`; `drop` makes rows accept dragged templates.
 */
export function PlaceTreeRows({ places, rootKeys, selected, onSelect, open, onToggle, count, showEmpty, drop }: {
  places: PlaceIndex; rootKeys?: string[]; selected: string; onSelect: (key: string) => void;
  open: Set<string>; onToggle: (key: string) => void; count?: (key: string) => number; showEmpty?: boolean;
  drop?: (key: string, expandable: boolean) => Parameters<typeof FolderRow>[0]['drop'];
}) {
  const shown = (n: PlaceNode) => showEmpty || !count || count(n.key) > 0;
  const row = (n: PlaceNode, depth: number): ReactNode => {
    if (!shown(n)) return null;
    const kids = places.children(n.key).filter(shown);
    const isOpen = open.has(n.key);
    return (
      <View key={n.key}>
        <FolderRow depth={depth} label={n.name} icon={placeIcon(n.type)} count={count?.(n.key)} selected={selected === n.key}
          expandable={kids.length > 0} open={isOpen} onToggle={() => onToggle(n.key)} onPress={() => onSelect(n.key)}
          drop={drop?.(n.key, kids.length > 0)} />
        {isOpen ? kids.map((k) => row(k, depth + 1)) : null}
      </View>
    );
  };
  const roots = rootKeys ? rootKeys.map((k) => places.byKey.get(k)).filter((n): n is PlaceNode => !!n) : places.roots;
  return <>{roots.map((r) => row(r, 0))}</>;
}

export interface TemplateLeaf { id: string; label: string; subjectId?: string | null }

/** Choose one template; templates are listed inside their subject folders, with a search box. */
export function TemplatePicker({ subjects, templates, value, onChange, noneLabel = 'None', maxHeight = 360 }: {
  subjects: SubjectNode[] | null | undefined; templates: TemplateLeaf[] | null | undefined;
  value: string; onChange: (id: string) => void; noneLabel?: string; maxHeight?: number;
}) {
  const idx = useMemo(() => indexSubjects(subjects), [subjects]);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const all = templates ?? [];
  const shown = term ? all.filter((t) => t.label.toLowerCase().includes(term)) : all;
  const selected = all.find((t) => t.id === value);
  const inTree = (t: TemplateLeaf) => !!t.subjectId && idx.byId.has(t.subjectId);
  const { open, toggle } = useOpenFolders(selected && inTree(selected) ? idx.path(selected.subjectId!).map((s) => s.id) : []);
  const under = (id: string) => {
    const ids = idx.descendants(id);
    return shown.filter((t) => t.subjectId && ids.has(t.subjectId)).length;
  };
  const leaves = (list: TemplateLeaf[], depth: number) => list
    .slice().sort((a, b) => a.label.localeCompare(b.label))
    .map((t) => <FolderRow key={t.id} depth={depth} icon="page" label={t.label} selected={value === t.id} onPress={() => onChange(t.id)} />);
  const folder = (n: SubjectNode, depth: number): ReactNode => {
    const count = under(n.id);
    if (!count) return null; // only folders that hold (matching) templates
    const isOpen = !!term || open.has(n.id);
    return (
      <View key={n.id}>
        <FolderRow depth={depth} label={n.name} count={count} selected={false} expandable open={isOpen}
          onToggle={() => toggle(n.id)} onPress={() => toggle(n.id)} />
        {isOpen ? <>
          {idx.children(n.id).map((k) => folder(k, depth + 1))}
          {leaves(shown.filter((t) => t.subjectId === n.id), depth + 1)}
        </> : null}
      </View>
    );
  };
  const loose = shown.filter((t) => !inTree(t));
  const looseOpen = !!term || open.has('__none__');
  return (
    <View style={{ gap: space(2) }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search templates…" placeholderTextColor={colors.ink4}
        aria-label="Search templates" style={styles.search} />
      <ScrollView style={[styles.box, { maxHeight }]} contentContainerStyle={{ padding: space(1) }}>
        <View accessibilityRole="tree" aria-label="Practice template">
          <FolderRow depth={0} icon="page" label={noneLabel} selected={!value} onPress={() => onChange('')} />
          {idx.roots.map((r) => folder(r, 0))}
          {loose.length ? <View>
            <FolderRow depth={0} label="No subject" count={loose.length} selected={false} expandable open={looseOpen}
              onToggle={() => toggle('__none__')} onPress={() => toggle('__none__')} />
            {looseOpen ? leaves(loose, 1) : null}
          </View> : null}
          {term && !shown.length ? <Text style={styles.empty}>No templates match “{q.trim()}”.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  folder: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingVertical: 6, paddingRight: 8, borderRadius: 6 },
  caretBox: { width: 16, alignItems: 'center' },
  caret: { fontSize: 9, color: colors.ink2 },
  folderLabel: { flex: 1, fontSize: 13.5, color: colors.ink },
  folderCount: { fontSize: 12, color: colors.ink3 },
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.paper },
  search: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13.5,
    color: colors.ink, backgroundColor: colors.paper },
  empty: { padding: space(2), fontSize: 13, color: colors.ink3 },
});
