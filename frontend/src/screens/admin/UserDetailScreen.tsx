import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { api } from '../../api';
import { useAuth } from '../../auth';
import { Badge, Button, Card, Checkbox, ErrorBox, H2, Loading, Muted, Notice, Screen, Select, Table, formatDate, statusTone } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import { canEdit, roleLabel, roleOptions, type Role } from '../../types';
import { topicLabel } from '../student/DashboardScreen';

export default function UserDetailScreen({ id }: { id: string }) {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'ADMIN';
  const mayAssign = canEdit(me?.role);
  const { data: user, setData: setUser, error } = useApi<any>(`/admin/users/${id}`);
  const { data: assignments, reload: reloadAssignments } = useApi<any[]>(`/admin/users/${id}/practice-assignments`);
  const { data: results } = useApi<any>(`/admin/users/${id}/practice-results`);
  const action = useAction();

  if (!user) return error ? <Screen title="Account"><ErrorBox message={error} /></Screen> : <Loading />;
  const isStudent = user.role === 'USER';

  const toggle = (row: any) => action.run(async () => {
    if (row.assignment === 'active') await api.del(`/admin/users/${id}/practice-assignments/${row.setId}`);
    else await api.put(`/admin/users/${id}/practice-assignments/${row.setId}`);
    await reloadAssignments();
  }, row.assignment === 'active' ? `Access to “${row.title}” revoked` : `“${row.title}” assigned`);

  const setStatus = (status: string) => action.run(async () => setUser(await api.patch(`/admin/users/${id}`, { status })),
    status === 'blocked' ? 'Account blocked' : 'Account unblocked');

  return (
    <Screen title={user.fullName} subtitle={user.email}
      actions={<>
        <Badge tone={statusTone(user.status)} text={user.status} />
        {isAdmin && me?.id !== id ? (user.status === 'active'
          ? <Button variant="danger" title="Block" onPress={() => setStatus('blocked')} />
          : <Button variant="secondary" title="Unblock" onPress={() => setStatus('active')} />) : null}
      </>}>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      <Card>
        <H2>Profile</H2>
        {isAdmin && me?.id !== id ? (
          // Admins change anyone's role but their own (so there is always an admin left).
          <View style={{ maxWidth: 260 }}>
            <Select label="Role" value={user.role as Role} options={roleOptions}
              onChange={(role) => role !== user.role && action.run(async () => setUser(await api.patch(`/admin/users/${id}`, { role })),
                `Role changed to ${roleLabel[role]}${role === 'TEACHER' ? ': choose their courses and classes under Teaches' : ''}`)} />
          </View>
        ) : null}
        <Muted>{isAdmin && me?.id !== id ? '' : `Role: ${roleLabel[user.role as Role] ?? user.role} · `}Created {formatDate(user.createdAt)}</Muted>
        {isAdmin && me?.id !== id ? (
          <NewPassword onSave={(password) => action.run(async () => { await api.patch(`/admin/users/${id}`, { password }); },
            'Password changed. Give the new password to the user; they can change it under Account.')} />
        ) : null}
        <TagEditor tags={user.tags ?? []} readOnly={!isAdmin}
          onSave={(tags) => action.run(async () => setUser(await api.patch(`/admin/users/${id}`, { tags })), 'Tags saved')} />
        <Muted style={{ marginTop: space(1) }}>Enrolled in: {user.enrollments.map((e: any) => e.title).join(', ') || 'no courses'}</Muted>
      </Card>

      {user.role === 'TEACHER' ? (
        <Teaching teaching={user.teaching} editable={isAdmin}
          onSave={(body) => action.run(async () => {
            const teaching = await api.put(`/admin/users/${id}/teaching`, body);
            setUser({ ...user, teaching });
          }, 'Saved')} />
      ) : null}

      {isStudent ? (
        <Card>
          <H2>Practice access</H2>
          <Muted style={{ marginBottom: space(3) }}>
            Access is granted per set. Assigning enrolls the student in the set's course if needed; revoking keeps all results.
          </Muted>
          <Table
            columns={[
              { key: 'title', title: 'Practice set', flex: 2 },
              { key: 'courseTitle', title: 'Course', flex: 1.5 },
              { key: 'setStatus', title: 'Set status', render: (r) => <Badge tone={statusTone(r.setStatus)} text={r.setStatus} /> },
              { key: 'assignment', title: 'Access', render: (r) => <Badge tone={r.assignment === 'active' ? 'success' : r.assignment === 'revoked' ? 'danger' : 'neutral'} text={r.assignment === 'active' ? 'Assigned' : r.assignment === 'revoked' ? 'Revoked' : 'Not assigned'} /> },
              { key: 'attempts', title: 'Attempts', flex: 0.7 },
              { key: 'action', title: '', render: (r) => !mayAssign ? null : <Button small variant={r.assignment === 'active' ? 'danger' : 'secondary'} title={r.assignment === 'active' ? 'Revoke' : r.assignment === 'revoked' ? 'Re-grant' : 'Assign'} onPress={() => toggle(r)} disabled={action.busy} /> },
            ]}
            rows={assignments ?? []}
          />
        </Card>
      ) : null}

      {isStudent && results ? (
        <>
          <Card>
            <H2>Practice history</H2>
            <Table
              onRowPress={(r) => navigate(`/admin/attempts/${r.id}`)}
              columns={[
                { key: 'setTitle', title: 'Practice set', flex: 2 },
                { key: 'attemptNo', title: '#', flex: 0.5 },
                { key: 'status', title: 'Status', render: (r) => <Badge tone={statusTone(r.status)} text={r.status.replace('_', ' ')} /> },
                { key: 'score', title: 'Score', render: (r) => <Text>{r.score == null ? '—' : `${Number(r.score)} / ${Number(r.maxScore)}`}</Text> },
                { key: 'passed', title: 'Result', render: (r) => r.passed == null ? <Text>—</Text> : <Badge tone={r.passed ? 'success' : 'danger'} text={r.passed ? 'Passed' : 'Not passed'} /> },
                { key: 'startedAt', title: 'Started', flex: 1.4, render: (r) => <Text>{formatDate(r.startedAt)}</Text> },
                { key: 'submittedAt', title: 'Submitted', flex: 1.4, render: (r) => <Text>{formatDate(r.submittedAt)}</Text> },
              ]}
              rows={results.attempts}
            />
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4) }}>
            <Card style={{ flexGrow: 1, flexBasis: 400 }}>
              <H2>Accuracy by skill</H2>
              <Table columns={[
                { key: 'topicCode', title: 'Skill', flex: 2, render: (r) => <Text>{topicLabel(r.topicCode)}</Text> },
                { key: 'correctQuestions', title: 'Correct' },
                { key: 'totalQuestions', title: 'Total' },
                { key: 'accuracyPercent', title: '%', render: (r) => <Text>{Number(r.accuracyPercent)}%</Text> },
              ]} rows={results.topics} />
            </Card>
            <Card style={{ flexGrow: 1, flexBasis: 400 }}>
              <H2>Lessons</H2>
              <Table columns={[
                { key: 'courseTitle', title: 'Course', flex: 2 },
                { key: 'completedLessons', title: 'Done', render: (r) => <Text>{r.completedLessons}/{r.totalLessons}</Text> },
                { key: 'completionPercent', title: '%', render: (r) => <Text>{Number(r.completionPercent)}%</Text> },
              ]} rows={results.courses} />
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** Edit an account's tags: remove with ×, add by typing and pressing Enter. */
/**
 * A teacher's courses and class tags: their students are those enrolled in these courses or carrying one of
 * these tags. Only admins change it.
 */
function Teaching({ teaching, editable, onSave }: {
  teaching: { courses: { id: string; title: string }[]; tags: string[]; studentCount: number } | undefined;
  editable: boolean; onSave: (body: { courseIds: string[]; tags: string[] }) => void;
}) {
  const { data: tree } = useApi<{ courses: { id: string; title: string; status: string }[] }>('/admin/content-tree');
  const courseIds = (teaching?.courses ?? []).map((c) => c.id);
  const tags = teaching?.tags ?? [];
  const setCourse = (cid: string, on: boolean) =>
    onSave({ courseIds: on ? [...courseIds, cid] : courseIds.filter((x) => x !== cid), tags });
  return (
    <Card>
      <H2>Teaches</H2>
      <Muted style={{ marginBottom: space(3) }}>
        Their students are those enrolled in these courses or tagged with one of these classes · {teaching?.studentCount ?? 0} student
        {teaching?.studentCount === 1 ? '' : 's'} now.
      </Muted>
      <Text style={{ fontSize: 12, letterSpacing: 1, color: colors.ink3, marginBottom: space(2) }}>COURSES</Text>
      {editable ? (tree?.courses ?? []).map((c) => (
        <Checkbox key={c.id} label={`${c.title}${c.status !== 'published' ? ` (${c.status})` : ''}`}
          value={courseIds.includes(c.id)} onChange={(on) => setCourse(c.id, on)} />
      )) : <Muted>{teaching?.courses.map((c) => c.title).join(', ') || 'No courses'}</Muted>}
      <TagEditor label="CLASS TAGS" tags={tags} readOnly={!editable} onSave={(t) => onSave({ courseIds, tags: t })} />
    </Card>
  );
}

/** Admin sets a new password for someone who forgot theirs (they can change it later under Account). */
function NewPassword({ onSave }: { onSave: (password: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) {
    return (
      <View style={{ flexDirection: 'row', marginTop: space(2) }}>
        <Button small variant="secondary" title="Set new password…" onPress={() => setOpen(true)} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), marginTop: space(2) }}>
      <TextInput value={value} onChangeText={setValue} secureTextEntry placeholder="New password (8+ characters)" placeholderTextColor={colors.ink4}
        autoCapitalize="none" aria-label="New password"
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, minWidth: 240, color: colors.ink }} />
      <Button small title="Save password" disabled={value.length < 8} onPress={() => { onSave(value); setValue(''); setOpen(false); }} />
      <Button small variant="ghost" title="Cancel" onPress={() => { setValue(''); setOpen(false); }} />
    </View>
  );
}

function TagEditor({ tags, onSave, readOnly, label = 'TAGS' }: {
  tags: string[]; onSave: (tags: string[]) => void; readOnly?: boolean; label?: string;
}) {
  const [value, setValue] = useState('');
  const add = () => {
    const t = value.trim().replace(/^#+/, '').replace(/\s+/g, '-');
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onSave([...tags, t]);
    setValue('');
  };
  return (
    <View style={{ marginTop: space(3), gap: space(2) }}>
      <Text style={{ fontSize: 12, letterSpacing: 1, color: colors.ink3 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), alignItems: 'center' }}>
        {tags.map((t) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: 999, paddingLeft: 10, paddingRight: 4, paddingVertical: 2 }}>
            <Text style={{ color: colors.accentInk, fontWeight: '600', fontSize: 13 }}>#{t}</Text>
            {readOnly ? <View style={{ width: 6 }} /> : (
              <Pressable onPress={() => onSave(tags.filter((x) => x !== t))} accessibilityLabel={`Remove tag ${t}`} style={{ paddingHorizontal: 5 }}>
                <Text style={{ color: colors.accentInk, fontSize: 14 }}>×</Text>
              </Pressable>
            )}
          </View>
        ))}
        {readOnly ? (tags.length ? null : <Muted>None</Muted>) : <TextInput value={value} onChangeText={setValue} onSubmitEditing={add} placeholder="#tag + Enter" placeholderTextColor={colors.ink4}
          autoCapitalize="none" aria-label="Add tag"
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, fontSize: 13, minWidth: 150, color: colors.ink }} />}
      </View>
    </View>
  );
}
