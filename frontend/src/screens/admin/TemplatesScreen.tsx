import { ReactNode, createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '../../api';
import { useAuth } from '../../auth';
import { canEdit } from '../../types';
import { Badge, Button, Card, ErrorBox, Notice, PillTabs, Screen, Table } from '../../components/ui';
import { FolderRow, PlaceTreeRows } from '../../components/SubjectTree';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { indexPlaces, keyOf, splitKey, type ContentTree } from '../../places';
import { colors, space } from '../../theme';

const NONE = '__none__';

interface ImportReport {
  title: string; total: number; subject: string; categories: string[]; locations?: string[];
  published: { template: string; detail: string }[]; drafts: { template: string; detail: string }[];
  skipped: { template: string; detail: string }[];
}

export default function TemplatesScreen() {
  const { data, error, reload } = useApi<any[]>('/admin/math-templates');
  const [report, setReport] = useState<ImportReport | null>(null);
  const action = useAction();

  /** Pick a template bank JSON file and import it (under its subject_path, else GED → one sub-subject per category). */
  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      action.run(async () => {
        let bank: unknown;
        try { bank = JSON.parse(await file.text()); } catch { throw new Error(`${file.name} is not valid JSON`); }
        setReport(await api.post<ImportReport>('/admin/math-templates/import?subject=GED', bank));
        await reload();
      });
    };
    input.click();
  };
  // The tree on the right: subjects › courses › chapters › lessons; a template sits at one of them.
  const { data: tree } = useApi<ContentTree>('/admin/content-tree');
  const [place, setPlace] = useState('');
  const places = useMemo(() => indexPlaces(tree), [tree]);
  const placeName = (t: any) => (keyOf(t) ? places.label(keyOf(t)) || t.subject : 'No place');

  // Archived (inactive) templates are listed only under the Archive tab.
  const [view, setView] = useState<'current' | 'archived'>('current');
  const archivedCount = (data ?? []).filter((t) => !t.active).length;
  const all = (data ?? []).filter((t) => (view === 'archived' ? !t.active : t.active));

  const [find, setFind] = useState({ label: '', subject: '', topic: '' });
  const has = (text: unknown, term: string) => !term.trim() || String(text ?? '').toLowerCase().includes(term.trim().toLowerCase());

  // Filtering by a place includes everything below it (a subject also shows its courses', chapters' and lessons').
  const rows = all.filter((t) => {
    if (place === NONE && keyOf(t)) return false;
    if (place && place !== NONE && !places.contains(place, t)) return false;
    // Place search matches the full path ("GED › Geometry"), so a parent name finds what is below it too.
    return has(t.label, find.label) && has(t.topicCode, find.topic) && has(placeName(t), find.subject);
  });
  const searching = !!(find.label || find.subject || find.topic);
  const countFor = (key: string) => all.filter((t) => places.contains(key, t)).length;
  const unassigned = all.filter((t) => !keyOf(t)).length;
  // Opening a node shows what is inside it; the selected node's path stays open.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const choose = (key: string) => {
    setPlace(key);
    if (key && key !== NONE) setOpen((o) => new Set([...o, ...places.path(key).map((n) => n.key)]));
  };
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // Bulk move: tick templates (filters can change in between; ticks are kept), pick a subject, Move.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const mover = useAction();
  const shown = rows.map((r) => r.id as string);
  const allShown = shown.length > 0 && shown.every((id) => picked.has(id));
  const someShown = shown.some((id) => picked.has(id));
  const hiddenPicked = [...picked].filter((id) => !shown.includes(id)).length;
  const pick = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pickShown = () => setPicked((p) => {
    const n = new Set(p);
    shown.forEach((id) => (allShown ? n.delete(id) : n.add(id)));
    return n;
  });
  /** Move templates to a place (NONE = nowhere); used by the "Move to" bar and by drag and drop. */
  const moveTo = (ids: string[], to: string) => {
    const target = to === NONE ? null : splitKey(to);
    const name = target ? places.label(to) : 'No place';
    const moving = ids.filter((id) => keyOf((data ?? []).find((t) => t.id === id) ?? {}) !== (target ? to : ''));
    if (!moving.length) { mover.setNotice(`Already in “${name}”`); return; }
    mover.run(async () => {
      await api.post('/admin/math-templates/move', { ids: moving, placeType: target ? target.type : 'none', placeId: target?.id ?? null });
      setPicked(new Set());
      setTarget('');
      await reload();
    }, `Moved ${moving.length} template${moving.length === 1 ? '' : 's'} to “${name}”`);
  };
  const moveTemplates = () => moveTo([...picked], target);

  // Drag and drop: drag a row (or any ticked row to take every ticked template) onto a folder in the tree.
  // While dragging, empty folders are shown too, and a collapsed folder opens when held over it.
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDrag = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    setDragIds(null);
    setDropOn(null);
  };
  const dragRow = (r: any, node: ReactNode) => createElement('div', {
    draggable: true,
    style: { cursor: 'grab', opacity: dragIds?.includes(r.id) ? 0.5 : 1 },
    onDragStart: (e: any) => {
      const ids = picked.has(r.id) ? [...picked] : [r.id];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ids.join(','));
      // Drag image says how many templates are moving.
      const ghost = document.createElement('div');
      ghost.textContent = ids.length === 1 ? `Move “${r.label}”` : `Move ${ids.length} templates`;
      Object.assign(ghost.style, { position: 'fixed', top: '-100px', padding: '6px 12px', borderRadius: '999px', font: '600 13px system-ui',
        background: colors.ink, color: colors.paper });
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 12, 12);
      setTimeout(() => ghost.remove(), 0);
      setDragIds(ids);
    },
    onDragEnd: endDrag,
  }, node);
  const dropProps = (id: string, expandable = false) => (dragIds ? {
    active: dropOn === id,
    onDragEnter: () => {
      setDropOn(id);
      if (openTimer.current) clearTimeout(openTimer.current);
      if (expandable && !open.has(id)) openTimer.current = setTimeout(() => setOpen((o) => new Set(o).add(id)), 600);
    },
    onDragLeave: () => setDropOn((d) => (d === id ? null : d)),
    onDrop: () => { const ids = dragIds; endDrag(); moveTo(ids, id); },
  } : undefined);

  // Bulk delete (asks first). Templates still used by practice sets, lessons or videos are kept and listed.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [kept, setKept] = useState<{ id: string; label: string; reason: string }[]>([]);
  useEffect(() => { if (!picked.size) setConfirmDelete(false); }, [picked]);
  const deleteTemplates = () => {
    const ids = [...picked];
    setKept([]);
    mover.run(async () => {
      const r = await api.post<{ deleted: number; kept: { id: string; label: string; reason: string }[] }>('/admin/math-templates/delete', { ids });
      setConfirmDelete(false);
      setKept(r.kept);
      setPicked(new Set(r.kept.map((k) => k.id))); // what could not be deleted stays ticked (e.g. to mark it inactive)
      await reload();
      mover.setNotice(`Deleted ${r.deleted} template${r.deleted === 1 ? '' : 's'}`
        + (r.kept.length ? ` · ${r.kept.length} kept because ${r.kept.length === 1 ? 'it is' : 'they are'} in use` : ''));
    });
  };

  /** Archive (hide from the list, no new questions) or restore templates. */
  const setArchived = (ids: string[], archived: boolean) => mover.run(async () => {
    await api.post('/admin/math-templates/archive', { ids, archived });
    setPicked(new Set());
    setKept([]);
    await reload();
  }, `${archived ? 'Archived' : 'Restored'} ${ids.length} template${ids.length === 1 ? '' : 's'}`
    + (archived ? ' — find them under Archive' : ''));
  const switchView = (v: 'current' | 'archived') => { setView(v); setPicked(new Set()); setKept([]); };

  /** A template's place, shortened to the part below the selected tree node. */
  const relativeLabel = (key: string) => {
    const chain = places.path(key);
    const cut = chain.findIndex((n) => n.key === place);
    const rest = cut >= 0 ? chain.slice(cut + 1) : chain;
    return (rest.length ? rest : chain.slice(-1)).map((n) => n.name).join(' › ');
  };
  return (
    <Screen wide title="Math templates" subtitle="Question families with random variables and SymPy-computed answers"
      actions={canEdit(useAuth().user?.role) ? <>
        <Button variant="secondary" title="Import file…" onPress={pickFile} loading={action.busy} />
        <Button title="New template" onPress={() => navigate('/admin/templates/new')} />
      </> : undefined}>
      <ErrorBox message={error || action.error || mover.error} />
      <Notice message={mover.notice} />
      {kept.length ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, gap: space(1) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>Not deleted — still in use</Text>
            <Button small variant="ghost" title="Close" onPress={() => setKept([])} />
          </View>
          {kept.map((k) => (
            <Text key={k.id} style={{ fontSize: 13, color: colors.ink2 }}>
              <Text style={{ fontWeight: '600' }}>{k.label}</Text> — {k.reason}
            </Text>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) }}>
            <Text style={{ fontSize: 12.5, color: colors.ink3 }}>Remove them from those places first, or archive them instead.</Text>
            {view === 'current' ? (
              <Button small variant="secondary" title={`Archive ${kept.length}`} loading={mover.busy} onPress={() => setArchived(kept.map((k) => k.id), true)} />
            ) : null}
          </View>
        </Card>
      ) : null}
      {action.busy ? <Text style={{ color: colors.ink3 }}>Importing and validating templates… this can take a minute.</Text> : null}
      {report ? <ImportResult report={report} onClose={() => setReport(null)} /> : null}
      <View style={styles.layout}>
      <Card style={{ flex: 1, minWidth: 0, flexBasis: 560 }}>
        <View style={{ marginBottom: space(3) }}>
          <PillTabs small value={view} onChange={switchView} tabs={[
            { value: 'current', label: 'Templates', count: (data?.length ?? 0) - archivedCount },
            { value: 'archived', label: 'Archive', count: archivedCount },
          ]} />
        </View>
        <View style={styles.searchRow}>
          <SearchBox flex={2} value={find.label} onChange={(label) => setFind({ ...find, label })} placeholder="Search label" />
          <SearchBox flex={1.6} value={find.subject} onChange={(v) => setFind({ ...find, subject: v })} placeholder="Search place" />
          <SearchBox flex={1.3} value={find.topic} onChange={(topic) => setFind({ ...find, topic })} placeholder="Search topic" />
          <View style={styles.searchMeta}>
            <Text style={{ fontSize: 12.5, color: colors.ink3 }}>{rows.length} of {all.length}</Text>
            {searching ? (
              <Pressable onPress={() => setFind({ label: '', subject: '', topic: '' })} accessibilityRole="button">
                {({ hovered }: any) => <Text style={{ fontSize: 12.5, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Clear</Text>}
              </Pressable>
            ) : null}
          </View>
        </View>
        {picked.size ? (
          <View style={styles.moveBar}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>
              {picked.size} selected{hiddenPicked ? ` (${hiddenPicked} not shown)` : ''}
            </Text>
            <Text style={{ color: colors.ink3 }}>Move to</Text>
            {createElement('select', {
              value: target, 'aria-label': 'Move selected templates to', onChange: (e: any) => setTarget(e.target.value),
              style: { padding: '7px 10px', borderRadius: 6, border: `1px solid ${colors.line}`, background: colors.paper, color: colors.ink, fontSize: 13.5, maxWidth: 420, minWidth: 220 },
            }, [
              createElement('option', { key: '', value: '' }, 'Choose a subject, course, chapter or lesson…'),
              ...places.ordered.map(({ node, depth }) => createElement('option', { key: node.key, value: node.key },
                `${'\u00a0\u00a0\u00a0'.repeat(depth)}${node.name}`)),
              createElement('option', { key: NONE, value: NONE }, 'No place'),
            ])}
            <Button small title="Move" disabled={!target} loading={mover.busy} onPress={moveTemplates} />
            <View style={{ flex: 1 }} />
            {view === 'current'
              ? <Button small variant="secondary" title={`Archive ${picked.size}`} loading={mover.busy} onPress={() => setArchived([...picked], true)} />
              : <Button small variant="secondary" title={`Restore ${picked.size}`} loading={mover.busy} onPress={() => setArchived([...picked], false)} />}
            {confirmDelete ? (
              <View style={styles.confirm}>
                <Text style={{ color: colors.dangerInk, fontSize: 13 }}>
                  Delete {picked.size} template{picked.size === 1 ? '' : 's'} and all their versions? This cannot be undone.
                </Text>
                <Button small variant="danger" title="Delete" loading={mover.busy} onPress={deleteTemplates} />
                <Button small variant="ghost" title="Cancel" onPress={() => setConfirmDelete(false)} />
              </View>
            ) : (
              <Button small variant="danger" title={`Delete ${picked.size}…`} onPress={() => setConfirmDelete(true)} />
            )}
            <Pressable onPress={() => { setPicked(new Set()); setConfirmDelete(false); }} accessibilityRole="button">
              {({ hovered }: any) => <Text style={{ fontSize: 13, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Clear selection</Text>}
            </Pressable>
          </View>
        ) : null}
        <Table
          onRowPress={(r) => navigate(`/admin/templates/${r.id}`)}
          columns={[
            { key: 'pick', flex: 0.3,
              title: <Tick on={allShown} partial={someShown && !allShown} label="Select all shown templates" onPress={pickShown} />,
              render: (r) => <Tick on={picked.has(r.id)} label={`Select ${r.label}`} onPress={() => pick(r.id)} /> },
            { key: 'label', title: 'Label', flex: 2 },
            { key: 'subject', title: 'Place', flex: 1.6, render: (r) => keyOf(r)
              ? <Badge tone="primary" text={relativeLabel(keyOf(r)) || r.subject} />
              : <Text style={{ color: colors.warning, fontSize: 13 }}>No place — set one</Text> },
            { key: 'topicCode', title: 'Topic', flex: 1.3 },
            { key: 'answerMode', title: 'Answer mode', render: (r) => <Text>{String(r.answerMode).replace('_', ' ')}</Text> },
            { key: 'publishedVersion', title: 'Published', render: (r) => r.publishedVersion ? <Badge tone="success" text={`v${r.publishedVersion}`} /> : <Badge tone="warning" text="none" /> },
          ]}
          rows={rows}
          wrapRow={dragRow}
          empty={view === 'archived' ? (all.length ? 'No archived templates match.' : 'Nothing archived.')
            : all.length ? 'No templates match.' : 'No data yet.'}
        />
      </Card>
      <Card style={styles.treePanel}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.treeTitle}>Subjects &amp; courses</Text>
          <Pressable onPress={() => navigate('/admin/tree')} accessibilityRole="link">
            {({ hovered }: any) => (
              <Text style={{ fontSize: 12.5, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Manage ›</Text>
            )}
          </Pressable>
        </View>
        {dragIds ? <Text style={{ fontSize: 12.5, color: colors.accentInk }}>Drop on a subject, course, chapter or lesson to move {dragIds.length === 1 ? 'it' : `${dragIds.length} templates`} there</Text> : null}
        <View accessibilityRole="tree" aria-label="Filter by place">
          <FolderRow depth={0} label={view === 'archived' ? 'All archived' : 'All templates'} count={all.length} selected={!place} onPress={() => choose('')} />
          {/* While dragging, every node is shown (and a collapsed one opens when held over it). */}
          <PlaceTreeRows places={places} selected={place} onSelect={choose} open={open} onToggle={toggle}
            count={countFor} showEmpty={!!dragIds} drop={(key, expandable) => dropProps(key, expandable)} />
          {unassigned || dragIds ? <FolderRow depth={0} label="No place" count={unassigned} selected={place === NONE} drop={dropProps(NONE)} onPress={() => choose(NONE)} /> : null}
        </View>
      </Card>
      </View>
    </Screen>
  );
}

function ImportResult({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const group = (key: string, title: string, rows: { template: string; detail: string }[], color: string) => rows.length ? (
    <View key={key}>
      <Pressable onPress={() => setOpen(open === key ? null : key)}>
        <Text style={{ color, fontWeight: '600' }}>{open === key ? '▼' : '▶'} {rows.length} {title}</Text>
      </Pressable>
      {open === key ? (
        <View style={{ paddingLeft: space(4), paddingTop: space(1), gap: 2 }}>
          {rows.map((r, i) => <Text key={i} style={{ fontSize: 13, color: colors.ink2 }}>{r.template}{r.detail ? ` — ${r.detail}` : ''}</Text>)}
        </View>
      ) : null}
    </View>
  ) : null;
  return (
    <Card style={{ backgroundColor: colors.lavSoft, borderColor: colors.lavLine, gap: space(2) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Imported “{report.title || 'template file'}” ({report.total} templates)</Text>
        <Button small variant="ghost" title="Close" onPress={onClose} />
      </View>
      <Text style={{ color: colors.ink2 }}>
        {report.published.length || report.drafts.length
          ? `New templates were added under ${report.locations?.length ? report.locations.join(', ') : report.subject}.`
          : 'Nothing new to add — every template in this file was already imported or is not supported yet.'}
      </Text>
      {group('published', 'published and ready for practice sets', report.published, colors.success)}
      {group('drafts', 'saved as drafts (need attention)', report.drafts, colors.warning)}
      {group('skipped', 'skipped', report.skipped, colors.ink3)}
    </Card>
  );
}

function SearchBox({ flex, value, onChange, placeholder }: { flex: number; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.ink4}
      autoCapitalize="none" aria-label={placeholder} style={[styles.searchInput, { flex }]} />
  );
}

/** Row / select-all checkbox; stops the click from opening the template. */
function Tick({ on, partial, label, onPress }: { on: boolean; partial?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={(e: any) => { e.stopPropagation?.(); onPress(); }} accessibilityRole="checkbox"
      aria-checked={partial ? 'mixed' : on} accessibilityLabel={label} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <View style={[styles.box, (on || partial) && styles.boxOn]}>
        {on || partial ? <Text style={styles.tick}>{on ? '✓' : '–'}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moveBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3), padding: space(3), marginBottom: space(2),
    borderRadius: 8, backgroundColor: colors.lavSoft, borderWidth: 1, borderColor: colors.lavLine },
  confirm: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), paddingHorizontal: space(2), paddingVertical: space(1),
    borderRadius: 6, backgroundColor: colors.dangerSoft },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tick: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center', marginBottom: space(2) },
  searchInput: { minWidth: 160, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13.5, color: colors.ink, backgroundColor: colors.paper },
  searchMeta: { flexDirection: 'row', gap: space(3), alignItems: 'center', minWidth: 110, justifyContent: 'flex-end' },
  // wrap-reverse puts the tree above the table on narrow screens; with it, flex-end aligns both to the top.
  layout: { flexDirection: 'row', flexWrap: 'wrap-reverse', gap: space(4), alignItems: 'flex-end' },
  treePanel: { width: 270, flexGrow: 1, maxWidth: 320, gap: space(2) },
  treeTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink3 },
});
