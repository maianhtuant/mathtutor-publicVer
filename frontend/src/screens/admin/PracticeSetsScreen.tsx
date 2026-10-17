import { createElement, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '../../api';
import { useAuth } from '../../auth';
import { FolderRow, PlaceTreeRows } from '../../components/SubjectTree';
import { Badge, Button, Card, ErrorBox, Field, H2, Screen, Select, Table, statusTone } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { indexPlaces, type ContentTree, type Placed } from '../../places';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import { canEdit } from '../../types';

const STATUSES = [['', 'All statuses'], ['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']];

/** Practice sets with search boxes and a subject › course tree to narrow the list (a set belongs to one course). */
export default function PracticeSetsScreen() {
  const { data, error } = useApi<any[]>('/admin/practice-sets');
  const { data: courses } = useApi<any[]>('/admin/courses');
  const { data: tree } = useApi<ContentTree>('/admin/content-tree');
  const places = useMemo(() => indexPlaces(tree), [tree]);
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ courseId: '', title: '', passPercent: '60', timeLimitMinutes: '', maxAttempts: '' });
  const action = useAction();

  // A set's place is its course (and the course's subject), so the tree counts sets per subject and course.
  const courseSubject = useMemo(() => new Map((tree?.courses ?? []).map((c) => [c.id, c.subjectId])), [tree]);
  const placed = (s: any): Placed => ({ courseId: s.courseId, subjectId: courseSubject.get(s.courseId) ?? null });

  const [find, setFind] = useState({ title: '', course: '', status: '', creator: '' });
  const [node, setNode] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const has = (text: unknown, term: string) => !term.trim() || String(text ?? '').toLowerCase().includes(term.trim().toLowerCase());
  const all = data ?? [];
  const rows = all.filter((s) => (!node || places.contains(node, placed(s)))
    && has(s.title, find.title) && has(s.courseTitle, find.course) && has(s.createdByName, find.creator)
    && (!find.status || s.status === find.status));
  const searching = !!(find.title || find.course || find.status || find.creator);
  const countFor = (key: string) => all.filter((s) => places.contains(key, placed(s))).length;
  const choose = (key: string) => {
    setNode(key);
    if (key) setOpen((o) => new Set([...o, ...places.path(key).map((n) => n.key)]));
  };
  const toggle = (key: string) => setOpen((o) => { const n = new Set(o); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const create = () => action.run(async () => {
    const s = await api.post<any>('/admin/practice-sets', {
      courseId: f.courseId, title: f.title, kind: 'practice', passPercent: Number(f.passPercent),
      timeLimitSeconds: f.timeLimitMinutes ? Math.round(Number(f.timeLimitMinutes) * 60) : null,
      maxAttempts: f.maxAttempts ? Number(f.maxAttempts) : null,
    });
    navigate(`/admin/sets/${s.id}`);
  });

  return (
    <Screen wide title="Practice sets" subtitle="Combine template rows (e.g. 5 × LCM + 5 × decimal multiplication) and fixed questions"
      actions={canEdit(useAuth().user?.role)
        ? <Button title={showNew ? 'Cancel' : 'New practice set'} variant={showNew ? 'secondary' : 'primary'} onPress={() => setShowNew(!showNew)} />
        : undefined}>
      <ErrorBox message={error || action.error} />
      {showNew ? (
        <Card>
          <H2>New practice set</H2>
          <Select label="Course" value={f.courseId} onChange={(courseId) => setF({ ...f, courseId })}
            options={(courses ?? []).map((c) => ({ value: c.id, label: c.title }))} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
            <Field label="Title" value={f.title} onChangeText={(title) => setF({ ...f, title })} style={{ flexBasis: 280 }} />
            <Field label="Pass threshold (%)" value={f.passPercent} onChangeText={(passPercent) => setF({ ...f, passPercent })} style={{ flexBasis: 120 }} />
            <Field label="Time limit (minutes)" value={f.timeLimitMinutes} onChangeText={(timeLimitMinutes) => setF({ ...f, timeLimitMinutes })} placeholder="none" style={{ flexBasis: 140 }} />
            <Field label="Max attempts" value={f.maxAttempts} onChangeText={(maxAttempts) => setF({ ...f, maxAttempts })} placeholder="unlimited" style={{ flexBasis: 120 }} />
          </View>
          <View style={{ flexDirection: 'row' }}><Button title="Create draft" onPress={create} disabled={!f.courseId || !f.title} loading={action.busy} /></View>
        </Card>
      ) : null}
      <View style={styles.layout}>
        <Card style={{ flex: 1, minWidth: 0, flexBasis: 560 }}>
          <View style={styles.searchRow}>
            <SearchBox flex={2} value={find.title} onChange={(title) => setFind({ ...find, title })} placeholder="Search practice set" />
            <SearchBox flex={1.5} value={find.course} onChange={(course) => setFind({ ...find, course })} placeholder="Search course" />
            <SearchBox flex={1.2} value={find.creator} onChange={(creator) => setFind({ ...find, creator })} placeholder="Search created by" />
            {createElement('select', {
              value: find.status, 'aria-label': 'Filter by status', onChange: (e: any) => setFind({ ...find, status: e.target.value }),
              style: { padding: '7px 10px', borderRadius: 6, border: `1px solid ${colors.line}`, background: colors.paper, color: colors.ink, fontSize: 13.5 },
            }, STATUSES.map(([v, label]) => createElement('option', { key: v, value: v }, label)))}
            <View style={styles.searchMeta}>
              <Text style={{ fontSize: 12.5, color: colors.ink3 }}>{rows.length} of {all.length}</Text>
              {searching ? (
                <Pressable onPress={() => setFind({ title: '', course: '', status: '', creator: '' })} accessibilityRole="button">
                  {({ hovered }: any) => <Text style={{ fontSize: 12.5, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Clear</Text>}
                </Pressable>
              ) : null}
            </View>
          </View>
          <Table
            onRowPress={(r) => navigate(`/admin/sets/${r.id}`)}
            columns={[
              { key: 'title', title: 'Practice set', flex: 2 },
              { key: 'courseTitle', title: 'Course', flex: 1.5 },
              { key: 'createdByName', title: 'Created by', flex: 1.1 },
              { key: 'status', title: 'Status', render: (r) => <Badge tone={statusTone(r.status)} text={r.status} /> },
              { key: 'questionCount', title: 'Questions' },
              { key: 'maxScore', title: 'Points', render: (r) => <Text>{Number(r.maxScore)}</Text> },
              { key: 'activeAssignments', title: 'Assigned' },
            ]}
            rows={rows}
            empty={all.length ? 'No practice sets match.' : 'No practice sets yet.'}
          />
        </Card>
        <Card style={styles.treePanel}>
          <Text style={styles.treeTitle}>Subjects &amp; courses</Text>
          <View accessibilityRole="tree" aria-label="Filter practice sets by subject or course">
            <FolderRow depth={0} label="All practice sets" count={all.length} selected={!node} onPress={() => choose('')} />
            <PlaceTreeRows places={places} selected={node} onSelect={choose} open={open} onToggle={toggle} count={countFor} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function SearchBox({ flex, value, onChange, placeholder }: { flex: number; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.ink4}
      autoCapitalize="none" aria-label={placeholder} style={[styles.searchInput, { flex }]} />
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center', marginBottom: space(2) },
  searchInput: { minWidth: 140, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13.5, color: colors.ink, backgroundColor: colors.paper },
  searchMeta: { flexDirection: 'row', gap: space(3), alignItems: 'center', minWidth: 90, justifyContent: 'flex-end' },
  // wrap-reverse puts the tree above the table on narrow screens; with it, flex-end aligns both to the top.
  layout: { flexDirection: 'row', flexWrap: 'wrap-reverse', gap: space(4), alignItems: 'flex-end' },
  treePanel: { width: 270, flexGrow: 1, maxWidth: 320, gap: space(2) },
  treeTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink3 },
});
