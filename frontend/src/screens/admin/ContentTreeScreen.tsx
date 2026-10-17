import { ReactNode, createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, api } from '../../api';
import { Badge, ErrorBox, Loading, Notice, Screen, statusTone } from '../../components/ui';
import { TreeIcon } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, space } from '../../theme';
import { SubjectNode, indexSubjects, subjectOptions } from '../../subjects';
import { Button, Card, Checkbox, Field, H2, Select } from '../../components/ui';

interface Tree {
  subjects: SubjectNode[];
  courses: { id: string; title: string; status: string; subjectId: string | null }[];
  chapters: { id: string; courseId: string; title: string; position: number }[];
  lessons: { id: string; chapterId: string; courseId: string; title: string; position: number; status: string }[];
}

const UNASSIGNED = 'unassigned';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Subject → sub-subjects (any depth) → course → chapter → lesson tree with inline actions (admin).
 * mode="subjects" renders the same tree without courses, plus a details editor: the Subjects page
 * and the Content Tree therefore always show the same hierarchy, order and counts.
 */
export default function ContentTreeScreen({ mode = 'content' }: { mode?: 'content' | 'subjects' }) {
  const subjectsOnly = mode === 'subjects';
  const [editing, setEditing] = useState<SubjectNode | 'new' | null>(null);
  const { data, error, loading, reload } = useApi<Tree>('/admin/content-tree');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const action = useAction();

  const idx = useMemo(() => {
    const d = data ?? { subjects: [], courses: [], chapters: [], lessons: [] };
    const group = <T, K extends keyof T>(list: T[], key: K) => {
      const m = new Map<string, T[]>();
      list.forEach((x) => { const k = (x[key] as unknown as string | null) ?? UNASSIGNED; m.set(k, [...(m.get(k) ?? []), x]); });
      return m;
    };
    const subj = indexSubjects(d.subjects);
    return {
      subj,
      roots: subj.roots,
      courses: group(d.courses, 'subjectId'),
      chapters: group(d.chapters, 'courseId'),
      lessons: group(d.lessons, 'chapterId'),
    };
  }, [data]);

  // Open the first subject and its first course on first load, like the reference screen.
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (!data || initialised) return;
    setInitialised(true);
    const first = idx.roots[0]?.id;
    if (!first) return;
    const firstCourse = idx.courses.get(first)?.[0]?.id;
    const firstChapters = firstCourse ? (idx.chapters.get(firstCourse) ?? []).map((c) => c.id) : [];
    setOpen(new Set([first, ...(firstCourse ? [firstCourse] : []), ...firstChapters]));
  }, [data, idx, initialised]);

  // Row shortcut ("+ Lesson" on a chapter, ...) expands that row and opens its inline add box.
  // (Declared before the early return below: hooks must run in the same order on every render.)
  const [adding, setAdding] = useState<string | null>(null);
  // A course that still has content or removed students' history needs a second, explicit confirmation.
  const [wipe, setWipe] = useState<{ id: string; title: string; message: string } | null>(null);
  // Drag and drop among siblings (same kind and same parent only).
  const [drag, setDrag] = useState<{ id: string; group: string } | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; after: boolean } | null>(null);

  if (loading && !data) return <Loading />;

  const startAdd = (key: string, rowId: string) => { setOpen((x) => new Set(x).add(rowId)); setAdding(key); };
  const addProps = (key: string) => ({ autoOpen: adding === key, onClose: () => setAdding((a) => (a === key ? null : a)) });

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setOpen(new Set([
    ...(data?.subjects.map((s) => s.id) ?? []), UNASSIGNED, ...(data?.courses.map((c) => c.id) ?? []), ...(data?.chapters.map((c) => c.id) ?? []),
  ]));

  const create = (fn: () => Promise<unknown>, openId?: string) => action.run(async () => {
    await fn();
    await reload();
    if (openId) setOpen((s) => new Set(s).add(openId));
  });

  /** Run a change, refresh the tree, and report success/failure at the top of the page. */
  const mutate = (fn: () => Promise<unknown>, success: string) => action.run(async () => {
    await fn();
    await reload();
  }, success);

  const statusOps = (kind: 'courses' | 'lessons', id: string, status: string, name: string) => ({
    publish: status !== 'published' ? () => mutate(() => api.patch(`/admin/${kind}/${id}`, { status: 'published' }), `Published “${name}”`) : undefined,
    archive: status !== 'archived' ? () => mutate(() => api.patch(`/admin/${kind}/${id}`, { status: 'archived' }), `Archived “${name}”`) : undefined,
  });

  // Counts include every sub-subject below, so a parent's numbers match what is inside it.
  const totals = (subjectId: string) => {
    const ids = subjectId === UNASSIGNED ? new Set([UNASSIGNED]) : idx.subj.descendants(subjectId);
    let courses = 0;
    let videos = 0;
    let templates = 0;
    ids.forEach((id) => {
      courses += idx.courses.get(id)?.length ?? 0;
      videos += Number(idx.subj.byId.get(id)?.videoCount ?? 0);
      templates += Number((idx.subj.byId.get(id) as any)?.templateCount ?? 0);
    });
    const parts = [courses && plural(courses, 'course'), videos && plural(videos, 'video'), templates && plural(templates, 'template')].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'empty';
  };

  type Orderable = 'subjects' | 'courses' | 'chapters' | 'lessons';

  /** Move `id` before/after `targetId` among its siblings and save the new sibling order. */
  const move = (kind: Orderable, siblings: { id: string; name: string }[], id: string, targetId: string, after: boolean) => {
    const ids = siblings.map((x) => x.id);
    const next = ids.filter((x) => x !== id);
    next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, id);
    if (next.every((x, i) => x === ids[i])) return;
    const name = siblings.find((x) => x.id === id)?.name ?? '';
    mutate(() => api.post(`/admin/${kind}/reorder`, { ids: next }), `Moved “${name}”`);
  };

  /**
   * Reordering of one row among its siblings: ↑/↓ actions plus drag and drop. `group` is the parent's id;
   * a drop is only accepted from a row of the same kind under the same parent.
   */
  const reorderable = (kind: Orderable, group: string, siblings: { id: string; name: string }[], id: string) => {
    const at = siblings.findIndex((x) => x.id === id);
    const key = `${kind}:${group}`;
    const clear = () => { setDrag(null); setDropAt(null); };
    return {
      grip: siblings.length > 1,
      moves: {
        moveUp: at > 0 ? () => move(kind, siblings, id, siblings[at - 1].id, false) : undefined,
        moveDown: at >= 0 && at < siblings.length - 1 ? () => move(kind, siblings, id, siblings[at + 1].id, true) : undefined,
      },
      drag: {
        enabled: siblings.length > 1,
        dragging: drag?.id === id,
        dropLine: dropAt?.id === id ? (dropAt.after ? 'after' as const : 'before' as const) : null,
        onDragStart: () => setDrag({ id, group: key }),
        onDragOver: (after: boolean) => {
          if (!drag || drag.group !== key || drag.id === id) return false;
          if (dropAt?.id !== id || dropAt.after !== after) setDropAt({ id, after });
          return true;
        },
        onDrop: (after: boolean) => { if (drag) move(kind, siblings, drag.id, id, after); clear(); },
        onDragEnd: clear,
      },
    };
  };

  /** A sub-subject used as a "chapter" by mistake becomes a real chapter (then lessons can be added). */
  const toChapter = (s: SubjectNode) => action.run(async () => {
    const r = await api.post<{ courseId: string; chapterId: string }>(`/admin/subjects/${s.id}/to-chapter`);
    await reload();
    setOpen((x) => new Set([...x, ...(s.parentId ? [s.parentId] : []), r.courseId, r.chapterId]));
    setAdding(`lesson:${r.chapterId}`);
  }, `“${s.name}” is now a chapter — type a lesson title below it`);

  // Template-only folders (e.g. "GED templates") don't need the "add a course" hint.
  const holdsTemplates = (subjectId: string) =>
    [...idx.subj.descendants(subjectId)].some((id) => Number((idx.subj.byId.get(id) as any)?.templateCount ?? 0) > 0);

  const renderSubject = (s: { id: string; name: string; active?: boolean }, depth: number, siblings: SubjectNode[] = []): ReactNode => {
    const children = s.id === UNASSIGNED ? [] : idx.subj.children(s.id);
    const courses = subjectsOnly ? [] : idx.courses.get(s.id) ?? [];
    const isOpen = open.has(s.id);
    const node = idx.subj.byId.get(s.id);
    // Empty sub-subject: offer to turn it into a chapter (lessons only live in a course's chapters).
    const order = reorderable('subjects', node?.parentId ?? 'root', siblings, s.id);
    const canBeChapter = !subjectsOnly && !!node?.parentId && children.length === 0 && courses.length === 0
      && Number(node?.videoCount ?? 0) === 0;
    return (
      <View key={s.id}>
        <DragRow {...order.drag} enabled={!!node && order.drag.enabled}>
        <Row depth={depth} open={isOpen} onToggle={() => toggle(s.id)} selected={selected === s.id} onSelect={() => setSelected(s.id)}
          icon={<TreeIcon kind="folder" />} label={s.name} meta={totals(s.id)} grip={!!node && order.grip}
          badge={s.active === false ? <Badge tone="neutral" text="Inactive" /> : null} strong
          ops={s.id === UNASSIGNED ? undefined : {
            editValue: s.name,
            rename: (name) => mutate(() => api.patch(`/admin/subjects/${s.id}`, { name }), `Renamed to “${name}”`),
            remove: () => mutate(() => api.del(`/admin/subjects/${s.id}`), `Deleted subject “${s.name}”`),
            edit: () => setEditing(idx.subj.byId.get(s.id) ?? null),
            ...order.moves,
            adds: [
              ...(canBeChapter ? [{ label: 'Make it a chapter', onPress: () => toChapter(node!) }] : []),
              ...(!subjectsOnly ? [{ label: '+ Course', onPress: () => startAdd(`course:${s.id}`, s.id) }] : []),
              { label: '+ Sub-subject', onPress: () => startAdd(`subject:${s.id}`, s.id) },
            ],
          }} />
        </DragRow>
        {isOpen ? (
          <Branch>
            {children.map((c) => renderSubject(c, depth + 1, children))}
            {courses.map((c) => renderCourse(c, depth + 1, courses))}
            {!subjectsOnly && s.id !== UNASSIGNED && courses.length === 0 && !holdsTemplates(s.id) ? (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>
                  Lessons go inside a course’s chapters. Add a course here{canBeChapter ? ', or turn this sub-subject into a chapter' : ''}.
                </Text>
                {canBeChapter ? (
                  <Pressable onPress={() => toChapter(node!)} style={({ hovered }: any) => [styles.addPill, { borderStyle: 'solid' }, hovered && { backgroundColor: colors.paper2 }]}>
                    <Text style={styles.addText}>Make “{s.name}” a chapter</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {s.id !== UNASSIGNED ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <AddInline depth={depth + 1} label="+ New sub-subject" placeholder={`Sub-subject of ${s.name}`} {...addProps(`subject:${s.id}`)}
                  onAdd={(name) => create(() => api.post('/admin/subjects', { name, parentId: s.id }), s.id)} />
                {!subjectsOnly ? (
                  <AddInline depth={depth + 1} label="+ New course" placeholder="Course title" {...addProps(`course:${s.id}`)}
                    onAdd={(title) => create(() => api.post('/admin/courses', { title, subjectId: s.id }), s.id)} />
                ) : null}
              </View>
            ) : null}
          </Branch>
        ) : null}
      </View>
    );
  };

  const removeCourse = (c: Tree['courses'][number]) => action.run(async () => {
    setWipe(null);
    try {
      await api.del(`/admin/courses/${c.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'course_not_empty') { setWipe({ id: c.id, title: c.title, message: e.message }); return; }
      throw e;
    }
    await reload();
    action.setNotice(`Deleted course “${c.title}”`);
  });
  const wipeCourse = (id: string, title: string) => mutate(async () => {
    await api.del(`/admin/courses/${id}?everything=true`);
    setWipe(null);
  }, `Deleted course “${title}” and everything in it`);

  const renderCourse = (c: Tree['courses'][number], depth: number, siblings: Tree['courses']) => {
    const chapters = idx.chapters.get(c.id) ?? [];
    const isOpen = open.has(c.id);
    const order = reorderable('courses', c.subjectId ?? UNASSIGNED, siblings.map((x) => ({ id: x.id, name: x.title })), c.id);
    return (
      <View key={c.id}>
        <DragRow {...order.drag}>
        <Row depth={depth} grip={order.grip} open={isOpen} onToggle={() => toggle(c.id)} selected={selected === c.id || isOpen} onSelect={() => setSelected(c.id)}
          icon={<TreeIcon kind="book" />} label={c.title} meta={plural(chapters.length, 'chapter')} strong
          badge={c.status !== 'published' ? <Badge tone={statusTone(c.status)} text={c.status} /> : null}
          onOpen={() => navigate(`/admin/content/${c.id}`)}
          ops={{
            editValue: c.title,
            rename: (title) => mutate(() => api.patch(`/admin/courses/${c.id}`, { title }), `Renamed to “${title}”`),
            remove: () => removeCourse(c),
            ...statusOps('courses', c.id, c.status, c.title),
            ...order.moves,
            adds: [{ label: '+ Chapter', onPress: () => startAdd(`chapter:${c.id}`, c.id) }],
          }} />
        </DragRow>
        {wipe?.id === c.id ? (
          <View style={styles.wipe}>
            <Text style={{ fontWeight: '700', color: colors.dangerInk }}>Delete “{c.title}” and everything in it?</Text>
            <Text style={{ fontSize: 13, color: colors.ink2 }}>{wipe.message.replace(/ Delete it with everything in it\?$/, '')}</Text>
            <Text style={{ fontSize: 13, color: colors.ink2 }}>All of it will be deleted permanently. This cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(1) }}>
              <Button small variant="danger" title="Delete everything" loading={action.busy} onPress={() => wipeCourse(c.id, c.title)} />
              <Button small variant="ghost" title="Cancel" onPress={() => setWipe(null)} />
            </View>
          </View>
        ) : null}
        {isOpen ? (
          <Branch>
            {chapters.map((ch) => renderChapter(ch, depth + 1, chapters))}
            <AddInline depth={depth + 1} label="+ New chapter" placeholder="Chapter title" {...addProps(`chapter:${c.id}`)}
              onAdd={(title) => create(() => api.post(`/admin/courses/${c.id}/chapters`, { title }), c.id)} />
          </Branch>
        ) : null}
      </View>
    );
  };

  const renderChapter = (ch: Tree['chapters'][number], depth: number, siblings: Tree['chapters']) => {
    const lessons = idx.lessons.get(ch.id) ?? [];
    const isOpen = open.has(ch.id);
    const order = reorderable('chapters', ch.courseId, siblings.map((x) => ({ id: x.id, name: x.title })), ch.id);
    const lessonSiblings = lessons.map((x) => ({ id: x.id, name: x.title }));
    return (
      <View key={ch.id}>
        <DragRow {...order.drag}>
        <Row depth={depth} grip={order.grip} open={isOpen} onToggle={() => toggle(ch.id)} selected={selected === ch.id} onSelect={() => setSelected(ch.id)}
          icon={<TreeIcon kind="page" />} label={`${ch.position}. ${ch.title}`} meta={plural(lessons.length, 'lesson')}
          ops={{
            editValue: ch.title,
            rename: (title) => mutate(() => api.patch(`/admin/chapters/${ch.id}`, { title }), `Renamed to “${title}”`),
            remove: () => mutate(() => api.del(`/admin/chapters/${ch.id}`), `Deleted chapter “${ch.title}”`),
            ...order.moves,
            adds: [{ label: '+ Lesson', onPress: () => startAdd(`lesson:${ch.id}`, ch.id) }],
          }} />
        </DragRow>
        {isOpen ? (
          <Branch>
            {lessons.map((l) => { const lo = reorderable('lessons', ch.id, lessonSiblings, l.id); return (
              <DragRow key={l.id} {...lo.drag}>
              <Row depth={depth + 1} leaf grip={lo.grip} selected={selected === l.id} onSelect={() => setSelected(l.id)}
                icon={<TreeIcon kind="lesson" size={16} />} label={`${ch.position}.${l.position} ${l.title}`}
                badge={l.status !== 'published' ? <Badge tone={statusTone(l.status)} text={l.status} /> : null}
                meta="open editor ›" onOpen={() => navigate(`/admin/lessons/${l.id}`)}
                ops={{
                  editValue: l.title,
                  rename: (title) => mutate(() => api.patch(`/admin/lessons/${l.id}`, { title }), `Renamed to “${title}”`),
                  remove: () => mutate(() => api.del(`/admin/lessons/${l.id}`), `Deleted lesson “${l.title}”`),
                  ...statusOps('lessons', l.id, l.status, l.title),
                  ...lo.moves,
                }} />
              </DragRow>
            ); })}
            <AddInline depth={depth + 1} label="+ New lesson" placeholder="Lesson title (created as draft)" {...addProps(`lesson:${ch.id}`)}
              onAdd={(title) => create(() => api.post(`/admin/chapters/${ch.id}/lessons`, { title, content: '' }), ch.id)} />
          </Branch>
        ) : null}
      </View>
    );
  };

  const unassigned = idx.courses.get(UNASSIGNED) ?? [];
  const subjectCount = idx.roots.length;

  return (
    <Screen footer={false}>
      <View>
        <Text style={styles.h1} role="heading" aria-level={1}>{subjectsOnly ? 'Subjects' : 'Content Tree'}</Text>
        <Text style={styles.sub}>
          {plural(subjectCount, 'subject')}{data && data.subjects.length > subjectCount ? ` · ${plural(data.subjects.length - subjectCount, 'sub-subject')}` : ''}
        </Text>
      </View>
      <View style={styles.toolbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' }}>
          {subjectsOnly
            ? <LinkText onPress={() => navigate('/admin/tree')}>Open content tree</LinkText>
            : <LinkText onPress={() => navigate('/admin/subjects')}>Manage subjects</LinkText>}
          <Text style={{ color: colors.ink4 }}>·</Text>
          <LinkText onPress={() => navigate('/admin/content')}>Manage courses & chapters</LinkText>
        </View>
        <View style={{ flexDirection: 'row', gap: space(6) }}>
          <LinkText small onPress={expandAll}>Expand all</LinkText>
          <LinkText small onPress={() => setOpen(new Set())}>Collapse all</LinkText>
        </View>
      </View>
      <ErrorBox message={error || action.error} />
      <Notice message={action.notice} />
      {editing ? (
        <SubjectForm subject={editing === 'new' ? null : editing} options={subjectOptions(idx.subj, editing === 'new' ? undefined : editing.id)}
          onCancel={() => setEditing(null)}
          onSave={(body) => mutate(async () => {
            if (editing === 'new') await api.post('/admin/subjects', body);
            else await api.patch(`/admin/subjects/${editing.id}`, body);
            setEditing(null);
          }, 'Subject saved')} />
      ) : null}

      <View style={{ maxWidth: 1040 }}>
        {idx.roots.map((s) => renderSubject(s, 0, idx.roots))}
        {unassigned.length && !subjectsOnly ? renderSubject({ id: UNASSIGNED, name: 'Unassigned courses' }, 0) : null}
        <AddInline depth={0} label="+ New subject" placeholder="Subject name, e.g. Science"
          onAdd={(name) => create(() => api.post('/admin/subjects', { name }))} />
        {data && idx.roots.length === 0 && !unassigned.length ? (
          <Text style={{ color: colors.ink3 }}>No subjects yet — create one under Manage subjects.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

type RowOps = {
  editValue: string;
  rename: (name: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
  publish?: () => Promise<unknown>;
  edit?: () => void;
  adds?: { label: string; onPress: () => void }[];
  archive?: () => Promise<unknown>;
  moveUp?: () => void;
  moveDown?: () => void;
};

/**
 * Makes a tree row draggable (HTML5 drag and drop; react-native-web renders to the DOM). The parent decides
 * where a drop is allowed; the drop goes before or after this row depending on which half the mouse is over.
 */
function DragRow({ enabled, dragging, dropLine, onDragStart, onDragOver, onDrop, onDragEnd, children }: {
  enabled: boolean; dragging?: boolean; dropLine?: 'before' | 'after' | null; onDragStart?: () => void;
  onDragOver?: (after: boolean) => boolean; onDrop?: (after: boolean) => void; onDragEnd?: () => void; children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  const half = (e: any) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
  const line = `inset 0 ${dropLine === 'after' ? -2 : 2}px 0 ${colors.accent}`;
  return createElement('div', {
    draggable: true,
    // Text inputs (rename) inside the row must keep normal mouse selection.
    onMouseDown: (e: any) => { e.currentTarget.draggable = !(e.target instanceof HTMLInputElement); },
    onDragStart: (e: any) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      onDragStart?.();
    },
    onDragOver: (e: any) => { if (onDragOver?.(half(e))) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } },
    onDrop: (e: any) => { e.preventDefault(); onDrop?.(half(e)); },
    onDragEnd: () => onDragEnd?.(),
    style: { borderRadius: 6, opacity: dragging ? 0.45 : 1, boxShadow: dropLine ? line : 'none' },
  }, children);
}

function Row({ open, leaf, onToggle, selected, onSelect, onOpen, icon, label, meta, badge, strong, ops, grip }: {
  depth: number; grip?: boolean; open?: boolean; leaf?: boolean; onToggle?: () => void; selected?: boolean; onSelect?: () => void;
  onOpen?: () => void; icon: ReactNode; label: string; meta?: string; badge?: ReactNode; strong?: boolean; ops?: RowOps;
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view');
  const [value, setValue] = useState('');
  const [hover, setHover] = useState(false);
  // Hover is tracked on the whole row (pointerenter/leave include the action buttons inside it); hiding waits a
  // moment so the actions don't vanish while the mouse travels to them.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setHover(true); };
  const leave = () => { hideTimer.current = setTimeout(() => setHover(false), 250); };
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const startRename = () => { setValue(ops!.editValue); setMode('rename'); };
  const saveRename = async () => {
    const v = value.trim();
    if (v && v !== ops!.editValue) await ops!.rename(v);
    setMode('view');
  };

  if (mode === 'rename') {
    return (
      <View style={[styles.row, styles.rowOn]}>
        <Text style={styles.caret}>{leaf ? '' : open ? '▼' : '▶'}</Text>
        {icon}
        <TextInput autoFocus value={value} onChangeText={setValue} onSubmitEditing={saveRename} aria-label="New name"
          onKeyPress={(e: any) => { if (e.nativeEvent.key === 'Escape') setMode('view'); }}
          style={styles.renameInput} />
        <Act label="Save" strong onPress={saveRename} />
        <Act label="Cancel" onPress={() => setMode('view')} />
      </View>
    );
  }

  const showActions = !!ops && (hover || selected || mode === 'confirm');
  return (
    <View {...({ onPointerEnter: enter, onPointerLeave: leave } as any)}>
    <Pressable
      onPress={() => { onSelect?.(); if (leaf) onOpen?.(); else onToggle?.(); }}
      accessibilityRole="button" aria-expanded={leaf ? undefined : open}
      style={[styles.row, (selected || hover) && styles.rowOn, mode === 'confirm' && { backgroundColor: colors.dangerSoft }]}
    >
      {grip ? <Text style={[styles.grip, { opacity: hover ? 1 : 0 }]} aria-hidden>⋮⋮</Text> : null}
      <Text style={styles.caret}>{leaf ? '' : open ? '▼' : '▶'}</Text>
      {icon}
      <Text style={[styles.label, strong && { fontWeight: '600' }]} numberOfLines={1}>{label}</Text>
      {badge}
      <View style={{ flex: 1 }} />
      {mode === 'confirm' ? (
        <View style={styles.actions}>
          <Text style={{ fontSize: 13, color: colors.dangerInk }}>Delete “{ops!.editValue}”?</Text>
          <Act label="Delete" danger strong onPress={async () => { await ops!.remove(); setMode('view'); }} />
          <Act label="Cancel" onPress={() => setMode('view')} />
        </View>
      ) : showActions ? (
        <View style={styles.actions}>
          {ops!.moveUp ? <Act label="↑" hint="Move up" onPress={ops!.moveUp} /> : null}
          {ops!.moveDown ? <Act label="↓" hint="Move down" onPress={ops!.moveDown} /> : null}
          {ops!.adds?.map((a) => <Act key={a.label} label={a.label} strong onPress={a.onPress} />)}
          {onOpen ? <Act label={leaf ? 'Open editor' : 'Open'} onPress={onOpen} /> : null}
          <Act label="Rename" onPress={startRename} />
          {ops!.edit ? <Act label="Edit details" onPress={ops!.edit} /> : null}
          {ops!.publish ? <Act label="Publish" onPress={ops!.publish} /> : null}
          {ops!.archive ? <Act label="Archive" onPress={ops!.archive} /> : null}
          <Act label="Delete" danger onPress={() => setMode('confirm')} />
        </View>
      ) : meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </Pressable>
    </View>
  );
}

/** Small text action inside a tree row; stops the click from toggling the row. */
function Act({ label, hint, onPress, danger, strong }: {
  label: string; hint?: string; onPress: () => void; danger?: boolean; strong?: boolean;
}) {
  return (
    <Pressable onPress={(e: any) => { e.stopPropagation?.(); onPress(); }} accessibilityRole="button"
      aria-label={hint} {...({ title: hint } as any)}
      style={({ hovered }: any) => [styles.act, hovered && { backgroundColor: danger ? colors.dangerSoft : colors.paper3 },
        strong && danger && { backgroundColor: colors.danger }]}>
      <Text style={[styles.actText, danger && { color: colors.danger }, strong && { fontWeight: '700' }, strong && danger && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

/** Full subject editor: name, description, parent (any level, own branch excluded), order, active. */
function SubjectForm({ subject, options, onSave, onCancel }: {
  subject: SubjectNode | null; options: { value: string; label: string }[];
  onSave: (body: object) => Promise<unknown>; onCancel: () => void;
}) {
  const [name, setName] = useState(subject?.name ?? '');
  const [description, setDescription] = useState(subject?.description ?? '');
  const [parentId, setParentId] = useState(subject?.parentId ?? '');
  const [order, setOrder] = useState(String(subject?.displayOrder ?? 0));
  const [active, setActive] = useState(subject?.active ?? true);
  return (
    <Card style={{ maxWidth: 1040 }}>
      <H2>{subject ? `Edit “${subject.name}”` : 'New subject'}</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Field label="Name *" value={name} onChangeText={setName} style={{ flexBasis: 240 }} />
        <Field label="Display order" value={order} onChangeText={setOrder} style={{ flexBasis: 110, flexGrow: 0 }} />
      </View>
      <Field label="Description" value={description} onChangeText={setDescription} />
      <Select label="Parent subject" value={parentId} onChange={setParentId}
        options={[{ value: '', label: 'None (top level)' }, ...options]} />
      <Checkbox label="Active (shown on the Lessons page)" value={active} onChange={setActive} />
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button title="Save" disabled={!name.trim()} onPress={() => onSave({
          name, description, displayOrder: Number(order) || 0, active, parentId: parentId || null, clearParent: !parentId,
        })} />
        <Button variant="secondary" title="Cancel" onPress={onCancel} />
      </View>
    </Card>
  );
}

/** Children of an expanded node, with the thin vertical guide line from the reference. */
function Branch({ children }: { children: ReactNode }) {
  return <View style={styles.branch}>{children}</View>;
}

function AddInline({ depth, label, placeholder, onAdd, autoOpen, onClose }: {
  depth: number; label: string; placeholder: string; onAdd: (title: string) => Promise<unknown>;
  autoOpen?: boolean; onClose?: () => void;
}) {
  const indent = depth === 0 ? 0 : space(8);
  const [editing, setEditing] = useState(!!autoOpen);
  const [value, setValue] = useState('');
  useEffect(() => { if (autoOpen) setEditing(true); }, [autoOpen]);
  const close = () => { setEditing(false); setValue(''); onClose?.(); };
  const submit = async () => {
    if (!value.trim()) return;
    await onAdd(value.trim());
    close();
  };
  if (!editing) {
    return (
      <View style={{ flexDirection: 'row', paddingVertical: space(2), paddingLeft: indent, paddingRight: space(2) }}>
        <Pressable onPress={() => setEditing(true)} style={({ hovered }: any) => [styles.addPill, hovered && { backgroundColor: colors.paper2 }]}>
          <Text style={styles.addText}>{label}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), paddingLeft: indent, flexWrap: 'wrap' }}>
      <TextInput autoFocus value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor={colors.ink4}
        onSubmitEditing={submit} aria-label={placeholder}
        onKeyPress={(e: any) => { if (e.nativeEvent.key === 'Escape') close(); }}
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, minWidth: 260, fontSize: 14, color: colors.ink, backgroundColor: colors.paper }} />
      <Pressable onPress={submit} style={[styles.addPill, { borderStyle: 'solid', backgroundColor: colors.ink, borderColor: colors.ink }]}>
        <Text style={[styles.addText, { color: colors.paper }]}>Add</Text>
      </Pressable>
      <Pressable onPress={close}><Text style={{ color: colors.ink3, fontSize: 13 }}>Cancel</Text></Pressable>
    </View>
  );
}

function LinkText({ children, onPress, small }: { children: ReactNode; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }: any) => (
        <Text style={[{ color: colors.ink, fontWeight: small ? '500' : '600', fontSize: small ? 13.5 : 16 }, hovered && { textDecorationLine: 'underline' }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.sans, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: colors.ink },
  sub: { color: colors.ink3, fontSize: 13, marginTop: space(1) },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space(3), maxWidth: 1040 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingVertical: 9, paddingHorizontal: space(2.5), borderRadius: 6 },
  rowOn: { backgroundColor: colors.paper2 },
  grip: { width: 10, marginLeft: -space(1.5), fontSize: 12, letterSpacing: -3, color: colors.ink4, cursor: 'grab' } as any,
  caret: { width: 14, fontSize: 9, color: colors.ink2, textAlign: 'center' },
  label: { fontSize: 15, color: colors.ink, flexShrink: 1 },
  meta: { fontSize: 12, color: colors.ink3, marginLeft: space(3) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' },
  act: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  actText: { fontSize: 12.5, color: colors.ink2, fontWeight: '500' },
  renameInput: { flex: 1, borderWidth: 1, borderColor: colors.ink3, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, fontSize: 15, color: colors.ink, backgroundColor: colors.paper },
  branch: { marginLeft: space(4), paddingLeft: space(3.5), borderLeftWidth: 1, borderLeftColor: colors.line },
  wipe: { marginLeft: space(8), marginVertical: space(1), padding: space(3), gap: space(1), borderRadius: 8,
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(3), paddingLeft: space(8), paddingVertical: space(2) },
  hintText: { fontSize: 13, color: colors.ink3, fontStyle: 'italic' },
  addPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  addText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
});
