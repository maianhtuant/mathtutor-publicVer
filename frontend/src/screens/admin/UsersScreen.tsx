import { createElement, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, errorMessage } from '../../api';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, H2, Muted, Notice, Screen, Select, statusTone } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import { useAuth } from '../../auth';
import { roleLabel, roleOptions, type Role } from '../../types';

interface UserRow { id: string; email: string; fullName: string; role: Role; status: 'active' | 'blocked'; tags: string[]; courses: string[] }
type BulkAction = 'assign_set' | 'revoke_set' | 'enroll_course' | 'unenroll_course' | 'block' | 'activate';
interface BulkResult { updated: number; skipped: { email: string; reason: string }[] }

const MORE_ACTIONS: { value: BulkAction; label: string }[] = [
  { value: 'assign_set', label: 'Assign practice set' },
  { value: 'revoke_set', label: 'Revoke practice set' },
  { value: 'enroll_course', label: 'Enroll in course' },
  { value: 'unenroll_course', label: 'Remove from course' },
  { value: 'block', label: 'Block' },
  { value: 'activate', label: 'Unblock' },
];

// Column widths shared by the header, the filter row and the data rows.
const COL = { check: 36, email: 2, name: 1.4, role: 0.85, status: 0.85, courses: 2, tags: 2 };

const cleanTag = (t: string) => t.trim().replace(/^#+/, '').replace(/\s+/g, '-');

/** Accounts with a search box under every column, inline tags, and actions for many selected accounts. */
export default function UsersScreen() {
  const role = useAuth().user?.role;
  const isAdmin = role === 'ADMIN';
  const teacher = role === 'TEACHER';
  const { data, error, setData, reload } = useApi<UserRow[]>('/admin/users');
  const { data: sets } = useApi<any[]>('/admin/practice-sets');
  const { data: courses } = useApi<any[]>('/admin/courses');
  const [f, setF] = useState({ email: '', name: '', role: '', status: '', courses: '', tags: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState('');
  const [bulk, setBulk] = useState<BulkAction>('assign_set');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<BulkResult | null>(null);
  const [showNew, setShowNew] = useState(false);
  const action = useAction();

  const rows = useMemo(() => {
    const has = (v: string, q: string) => v.toLowerCase().includes(q.trim().toLowerCase());
    const tagQ = cleanTag(f.tags).toLowerCase();
    return (data ?? []).filter((u) => has(u.email, f.email) && has(u.fullName, f.name)
      && (!f.role || u.role === f.role) && (!f.status || u.status === f.status)
      && (!f.courses.trim() || u.courses.some((c) => has(c, f.courses)))
      && (!tagQ || u.tags.some((t) => t.toLowerCase().includes(tagQ))));
  }, [data, f]);
  const filtersActive = Object.values(f).some(Boolean);

  const visibleIds = rows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allVisibleSelected) visibleIds.forEach((id) => n.delete(id)); else visibleIds.forEach((id) => n.add(id));
    return n;
  });

  /** Run a bulk action for the given accounts and refresh the list. */
  const runBulk = (userIds: string[], body: Record<string, unknown>, done?: string) => action.run(async () => {
    const r = await api.post<BulkResult>('/admin/users/bulk', { userIds, ...body });
    setResult(r);
    await reload();
    return r;
  }, done);

  const addTagToSelected = (remove = false) => {
    const tag = cleanTag(bulkTag);
    if (!tag) return;
    runBulk([...selected], { action: remove ? 'remove_tag' : 'add_tag', tag },
      `${remove ? 'Removed' : 'Added'} #${tag} ${remove ? 'from' : 'to'} ${selected.size} account${selected.size === 1 ? '' : 's'}`);
    setBulkTag('');
  };

  // Single-row tag edits update the row in place (no full reload flicker).
  const setRowTags = async (u: UserRow, tags: string[]) => {
    try {
      const updated = await api.patch<UserRow>(`/admin/users/${u.id}`, { tags });
      setData((data ?? []).map((x) => (x.id === u.id ? { ...x, tags: updated.tags } : x)));
    } catch (e) {
      action.setError(errorMessage(e));
    }
  };

  const needsSet = bulk === 'assign_set' || bulk === 'revoke_set';
  const needsCourse = bulk === 'enroll_course' || bulk === 'unenroll_course';
  const ready = selected.size > 0 && (!needsSet || !!target) && (!needsCourse || !!target);

  return (
    <Screen kicker={teacher ? 'Teacher' : 'Admin'} title={teacher ? 'My students' : 'Users'}
      subtitle={teacher ? 'Students in your courses and classes. Tick students, then assign or revoke practice sets below the list.'
        : 'Type in the boxes under each column to search. Tick accounts, then use the actions below the list.'}
      actions={isAdmin || teacher
        ? <Button title={showNew ? 'Cancel' : teacher ? 'New student' : 'New account'} variant={showNew ? 'secondary' : 'primary'} onPress={() => setShowNew(!showNew)} />
        : undefined}>
      <ErrorBox message={error || action.error} />
      <Notice message={action.notice} />
      {showNew ? (teacher ? <NewStudent onCreated={() => { setShowNew(false); reload(); }} />
        : <NewAccount onCreated={() => { setShowNew(false); reload(); }} />) : null}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={[styles.tr, styles.th]}>
          <CheckBox on={allVisibleSelected} onPress={toggleAll} label="Select all shown" />
          <Text style={[styles.thText, { flex: COL.email }]}>Email</Text>
          <Text style={[styles.thText, { flex: COL.name }]}>Name</Text>
          <Text style={[styles.thText, { flex: COL.role }]}>Role</Text>
          <Text style={[styles.thText, { flex: COL.status }]}>Status</Text>
          <Text style={[styles.thText, { flex: COL.courses }]}>Courses</Text>
          <Text style={[styles.thText, { flex: COL.tags }]}>Tags</Text>
        </View>
        <View style={[styles.tr, styles.filterRow]}>
          <View style={{ width: COL.check }}>
            {filtersActive ? (
              <Pressable onPress={() => setF({ email: '', name: '', role: '', status: '', courses: '', tags: '' })} accessibilityLabel="Clear all column filters">
                <Text style={{ color: colors.accentInk, fontSize: 16 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <ColumnSearch flex={COL.email} value={f.email} onChange={(email) => setF({ ...f, email })} placeholder="Search email" />
          <ColumnSearch flex={COL.name} value={f.name} onChange={(name) => setF({ ...f, name })} placeholder="Search name" />
          <ColumnSelect flex={COL.role} value={f.role} onChange={(role) => setF({ ...f, role })}
            options={[['', 'All'], ...roleOptions.map((o) => [o.value, o.label] as [string, string])]} label="Filter role" />
          <ColumnSelect flex={COL.status} value={f.status} onChange={(status) => setF({ ...f, status })}
            options={[['', 'All'], ['active', 'Active'], ['blocked', 'Blocked']]} label="Filter status" />
          <ColumnSearch flex={COL.courses} value={f.courses} onChange={(courses) => setF({ ...f, courses })} placeholder="Search course" />
          <ColumnSearch flex={COL.tags} value={f.tags} onChange={(tags) => setF({ ...f, tags })} placeholder="Search #tag" />
        </View>

        {rows.length === 0 ? <Text style={{ padding: space(4), color: colors.ink3 }}>{data ? 'No accounts match.' : 'Loading…'}</Text> : null}
        {rows.map((u) => (
          <View key={u.id} style={[styles.tr, selected.has(u.id) && { backgroundColor: colors.lavSoft }]}>
            <CheckBox on={selected.has(u.id)} onPress={() => toggle(u.id)} label={`Select ${u.email}`} />
            <Pressable onPress={() => navigate(`/admin/users/${u.id}`)} style={{ flex: COL.email }} accessibilityRole="link">
              {({ hovered }: any) => <Text style={[styles.cell, { fontWeight: '500' }, hovered && { textDecorationLine: 'underline' }]} numberOfLines={1}>{u.email}</Text>}
            </Pressable>
            <Text style={[styles.cell, { flex: COL.name }]} numberOfLines={1}>{u.fullName}</Text>
            <View style={{ flex: COL.role }}><Badge tone={u.role === 'USER' ? 'neutral' : 'primary'} text={roleLabel[u.role] ?? u.role} /></View>
            <View style={{ flex: COL.status }}><Badge tone={statusTone(u.status)} text={u.status} /></View>
            <View style={{ flex: COL.courses, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingRight: space(2) }}>
              {u.courses.length ? u.courses.map((c) => (
                <Pressable key={c} onPress={() => setF({ ...f, courses: c })} accessibilityLabel={`Filter by course ${c}`} style={styles.course}>
                  <Text style={styles.courseText} numberOfLines={1}>{c}</Text>
                </Pressable>
              )) : <Text style={{ color: colors.ink4, fontSize: 13 }}>—</Text>}
            </View>
            <View style={{ flex: COL.tags }}>
              <RowTags tags={u.tags} readOnly={!isAdmin} onFilter={(t) => setF({ ...f, tags: t })}
                onAdd={(t) => setRowTags(u, [...u.tags, t])} onRemove={(t) => setRowTags(u, u.tags.filter((x) => x !== t))} />
            </View>
          </View>
        ))}
        {rows.length ? (
          <Text style={styles.footer}>
            {rows.length} of {data?.length ?? 0} account{(data?.length ?? 0) === 1 ? '' : 's'} shown · click an email to open the account, a course or tag to filter by it
          </Text>
        ) : null}
      </Card>

      {selected.size > 0 && (isAdmin || teacher) ? (
        // Pinned to the bottom of the window so it stays visible while scrolling and ticking accounts.
        <View style={styles.bulkBar} role="region" aria-label="Actions for selected accounts">
          <View style={styles.barRow}>
            <Text style={styles.barCount}>{selected.size} selected</Text>
            <View style={styles.divider} />
            {isAdmin ? <>
              <TextInput value={bulkTag} onChangeText={setBulkTag} onSubmitEditing={() => addTagToSelected()} placeholder="#tag"
                placeholderTextColor={colors.ink4} autoCapitalize="none" aria-label="Tag for selected accounts" style={styles.tagInput} />
              <Button small title="Add tag" onPress={() => addTagToSelected()} disabled={!cleanTag(bulkTag)} loading={action.busy} />
              <Button small variant="secondary" title="Remove tag" onPress={() => addTagToSelected(true)} disabled={!cleanTag(bulkTag)} />
            </> : null}
            <View style={{ flex: 1 }} />
            <Button small variant="ghost" title="Clear selection" onPress={() => { setSelected(new Set()); setResult(null); }} />
          </View>
          <View style={styles.barRow}>
            <NativeSelect value={bulk} label="Action" width={200}
              options={MORE_ACTIONS.filter((a) => isAdmin || a.value === 'assign_set' || a.value === 'revoke_set').map((a) => [a.value, a.label])}
              onChange={(v) => { setBulk(v as BulkAction); setTarget(''); setResult(null); }} />
            {needsSet ? (
              <NativeSelect value={target} label="Practice set" width={300} onChange={setTarget}
                options={[['', 'Choose a practice set…'], ...(sets ?? []).map((x) => [x.id as string, `${x.title}${x.status !== 'published' ? ` (${x.status})` : ''}`] as [string, string])]} />
            ) : null}
            {needsCourse ? (
              <NativeSelect value={target} label="Course" width={300} onChange={setTarget}
                options={[['', 'Choose a course…'], ...(courses ?? []).map((c) => [c.id as string, `${c.title}${c.status !== 'published' ? ` (${c.status})` : ''}`] as [string, string])]} />
            ) : null}
            <Button small title={`Apply to ${selected.size}`} disabled={!ready} loading={action.busy}
              onPress={() => runBulk([...selected], { action: bulk, setId: needsSet ? target : undefined, courseId: needsCourse ? target : undefined })} />
            {bulk === 'assign_set' ? <Text style={styles.note}>Enrolls students in the set's course if needed · staff accounts are skipped</Text> : null}
            {bulk === 'unenroll_course' ? <Text style={styles.note}>They lose access to the course; progress and results are kept · enrolling again restores it</Text> : null}
          </View>
          {result && result.skipped.length ? result.skipped.map((sk, i) => (
            <Text key={i} style={{ color: colors.warning, fontSize: 13 }}>Skipped {sk.email}: {sk.reason}</Text>
          )) : null}
        </View>
      ) : null}
    </Screen>
  );
}

/** Tag chips with × to remove, and "+ tag" to add one inline. */
/** Tags on a row; clicking one filters by it. Only admins add or remove tags (readOnly for everyone else). */
function RowTags({ tags, onAdd, onRemove, onFilter, readOnly }: {
  tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; onFilter: (t: string) => void; readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const submit = () => {
    const t = cleanTag(value);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onAdd(t);
    setValue('');
    setAdding(false);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {tags.map((t) => (
        <View key={t} style={styles.tag}>
          <Pressable onPress={() => onFilter(t)} accessibilityLabel={`Filter by #${t}`}><Text style={styles.tagText}>#{t}</Text></Pressable>
          {readOnly ? null : (
            <Pressable onPress={() => onRemove(t)} accessibilityLabel={`Remove #${t}`} style={{ paddingLeft: 4 }}>
              <Text style={[styles.tagText, { opacity: 0.6 }]}>×</Text>
            </Pressable>
          )}
        </View>
      ))}
      {readOnly ? null : adding ? (
        <TextInput autoFocus value={value} onChangeText={setValue} onSubmitEditing={submit} onBlur={submit} placeholder="#tag"
          placeholderTextColor={colors.ink4} autoCapitalize="none" aria-label="New tag"
          onKeyPress={(e: any) => { if (e.nativeEvent.key === 'Escape') { setValue(''); setAdding(false); } }}
          style={[styles.tagInput, { minWidth: 90, paddingVertical: 2 }]} />
      ) : (
        <Pressable onPress={() => setAdding(true)} style={({ hovered }: any) => [styles.addTag, hovered && { backgroundColor: colors.paper2 }]}
          accessibilityLabel="Add tag">
          <Text style={styles.addTagText}>+ tag</Text>
        </Pressable>
      )}
    </View>
  );
}

function ColumnSearch({ flex, value, onChange, placeholder }: { flex: number; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ flex, paddingRight: space(2) }}>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.ink4}
        autoCapitalize="none" aria-label={placeholder} style={styles.colInput} />
    </View>
  );
}

function NativeSelect({ value, onChange, options, label, width }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; label: string; width: number;
}) {
  return createElement('select', {
    value, 'aria-label': label, onChange: (e: any) => onChange(e.target.value),
    style: { width, padding: '6px 8px', borderRadius: 999, border: `1px solid ${colors.lineStrong}`, background: colors.paper,
      color: colors.ink, fontSize: 13.5, fontFamily: 'inherit' },
  }, options.map(([v, l]) => createElement('option', { key: v, value: v }, l)));
}

/** Native dropdown (web) so the filter row stays compact. */
function ColumnSelect({ flex, value, onChange, options, label }: {
  flex: number; value: string; onChange: (v: string) => void; options: [string, string][]; label: string;
}) {
  return (
    <View style={{ flex, paddingRight: space(2) }}>
      {createElement('select', {
        value, 'aria-label': label,
        onChange: (e: any) => onChange(e.target.value),
        style: {
          width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${colors.line}`,
          background: colors.paper, color: colors.ink, fontSize: 13.5, fontFamily: 'inherit',
        },
      }, options.map(([v, l]) => createElement('option', { key: v, value: v }, l)))}
    </View>
  );
}

function CheckBox({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={label} style={{ width: COL.check }}>
      <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
    </Pressable>
  );
}

/**
 * A teacher's new student: always a student account, placed in one or more of the teacher's courses and/or
 * classes (tags) so it shows up under My students.
 */
function NewStudent({ onCreated }: { onCreated: () => void }) {
  const { user: me } = useAuth();
  const { data: teaching } = useApi<{ courses: { id: string; title: string }[]; tags: string[] }>(`/admin/users/${me?.id}/teaching`);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const action = useAction();
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const create = () => action.run(async () => {
    await api.post('/admin/users', { ...form, role: 'USER', courseIds, tags });
    onCreated();
  });
  const none = teaching && !teaching.courses.length && !teaching.tags.length;
  return (
    <Card>
      <H2>New student</H2>
      <ErrorBox message={action.error} />
      {none ? <Muted>You have no courses or classes yet. Ask an administrator to add them on your user page first.</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Field label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" style={{ flexBasis: 240 }} />
        <Field label="Full name" value={form.fullName} onChangeText={(fullName) => setForm({ ...form, fullName })} style={{ flexBasis: 200 }} />
        <Field label="Initial password" value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry hint="At least 8 characters" style={{ flexBasis: 200 }} />
      </View>
      {teaching?.courses.length ? <Text style={styles.pickTitle}>ENROLL IN</Text> : null}
      {(teaching?.courses ?? []).map((c) => (
        <Checkbox key={c.id} label={c.title} value={courseIds.includes(c.id)} onChange={() => setCourseIds(flip(courseIds, c.id))} />
      ))}
      {teaching?.tags.length ? <Text style={styles.pickTitle}>CLASS</Text> : null}
      {(teaching?.tags ?? []).map((t) => (
        <Checkbox key={t} label={`#${t}`} value={tags.includes(t)} onChange={() => setTags(flip(tags, t))} />
      ))}
      <View style={{ flexDirection: 'row' }}>
        <Button title="Create student" onPress={create} loading={action.busy} disabled={!courseIds.length && !tags.length} />
      </View>
    </Card>
  );
}

function NewAccount({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ email: '', fullName: '', password: '', role: 'USER' as Role, tags: '' });
  const action = useAction();
  const create = () => action.run(async () => {
    await api.post('/admin/users', { ...form, tags: form.tags.split(',').map(cleanTag).filter(Boolean) });
    onCreated();
  });
  return (
    <Card>
      <H2>New account</H2>
      <ErrorBox message={action.error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Field label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" style={{ flexBasis: 240 }} />
        <Field label="Full name" value={form.fullName} onChangeText={(fullName) => setForm({ ...form, fullName })} style={{ flexBasis: 200 }} />
        <Field label="Initial password" value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry hint="At least 8 characters" style={{ flexBasis: 200 }} />
        <Field label="Tags (comma separated)" value={form.tags} onChangeText={(tags) => setForm({ ...form, tags })} autoCapitalize="none" placeholder="#NOCE, #fall-2026" style={{ flexBasis: 240 }} />
      </View>
      <Select label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })}
        options={roleOptions} />
      <View style={{ flexDirection: 'row' }}><Button title="Create account" onPress={create} loading={action.busy} /></View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pickTitle: { fontSize: 12, letterSpacing: 1, color: colors.ink3, marginTop: space(2), marginBottom: space(2) },
  bulkBar: {
    position: 'sticky' as any, bottom: 0, zIndex: 20, gap: space(2), paddingVertical: space(3), paddingHorizontal: space(4),
    backgroundColor: colors.lavSoft, borderWidth: 1, borderColor: colors.lavLine, borderRadius: 12,
    ...({ boxShadow: '0 -6px 24px rgba(34, 25, 14, 0.12)' } as any),
  },
  barRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  barCount: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  divider: { width: 1, height: 22, backgroundColor: colors.lavLine, marginHorizontal: space(1) },
  note: { fontSize: 13, color: colors.ink3 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(1) },
  th: { backgroundColor: colors.paper2, paddingBottom: 6 },
  filterRow: { backgroundColor: colors.paper2, paddingTop: 0 },
  thText: { fontSize: 12, fontWeight: '600', color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  colInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13.5, color: colors.ink, backgroundColor: colors.paper },
  cell: { fontSize: 14, color: colors.ink },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tick: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  course: { backgroundColor: colors.lav, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '100%' as any },
  courseText: { fontSize: 12, color: colors.link, fontWeight: '600' },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, color: colors.accentInk, fontWeight: '600' },
  addTag: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  addTagText: { fontSize: 12, color: colors.ink3, fontWeight: '600' },
  tagInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 13, color: colors.ink, backgroundColor: colors.paper, minWidth: 140 },
  footer: { padding: space(3), fontSize: 12.5, color: colors.ink3 },
});
