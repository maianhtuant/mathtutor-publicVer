import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../../api';
import { MathParagraphs } from '../../components/MathText';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, H2, Loading, Muted, Notice, Screen, Select, statusTone } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, space } from '../../theme';
import SectionsEditor from './SectionsEditor';

type Status = 'draft' | 'published' | 'archived';

interface AdminLesson {
  id: string; title: string; goal: string | null; content: string; videoUrl: string | null; position: number;
  status: Status; freePreview: boolean; courseId: string; courseTitle: string; courseStatus: string;
  chapterId: string; chapterTitle: string; chapterPosition: number; sections: any[];
  previousLessonId: string | null; nextLessonId: string | null;
}

/** Dedicated page for writing one lesson: details, then sections with a live student preview. */
export default function LessonEditorScreen({ id }: { id: string }) {
  const { data: l, setData, error, reload } = useApi<AdminLesson>(`/admin/lessons/${id}`);
  const [form, setForm] = useState({ title: '', goal: '', status: 'draft' as Status, freePreview: false, content: '', videoUrl: '' });
  const action = useAction();

  useEffect(() => {
    if (l) setForm({ title: l.title, goal: l.goal ?? '', status: l.status, freePreview: l.freePreview, content: l.content ?? '', videoUrl: l.videoUrl ?? '' });
  }, [l?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!l) return error ? <Screen title="Lesson"><ErrorBox message={error} /></Screen> : <Loading />;

  const number = `${l.chapterPosition}.${l.position}`;
  const dirty = form.title !== l.title || form.goal !== (l.goal ?? '') || form.status !== l.status || form.freePreview !== l.freePreview
    || form.content !== (l.content ?? '') || form.videoUrl !== (l.videoUrl ?? '');

  const publishCourse = () => action.run(async () => {
    await api.patch(`/admin/courses/${l.courseId}`, { status: 'published' });
    setData(await api.get<AdminLesson>(`/admin/lessons/${id}`));
  }, `Course “${l.courseTitle}” published — students can now find it under Courses and enroll`);

  const save = (patch: Partial<typeof form> = {}) => action.run(async () => {
    const body = { ...form, ...patch };
    await api.patch(`/admin/lessons/${id}`, body);
    setForm(body);
    setData(await api.get<AdminLesson>(`/admin/lessons/${id}`));
  }, patch.status === 'published' ? 'Lesson published — students can open it now' : 'Lesson saved');

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Crumb label="CONTENT TREE" onPress={() => navigate('/admin/tree')} />
        <Text style={styles.crumb}>/</Text>
        <Crumb label={l.courseTitle.toUpperCase()} onPress={() => navigate(`/admin/content/${l.courseId}`)} />
        <Text style={styles.crumb}>/ {l.chapterPosition}. {l.chapterTitle.toUpperCase()} / LESSON {number}</Text>
      </View>

      <View style={styles.header}>
        <View style={{ flexShrink: 1, gap: space(2) }}>
          <Text style={styles.h1} role="heading" aria-level={1}>{number} {form.title || 'Untitled lesson'}</Text>
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={statusTone(l.status)} text={l.status} />
            {l.freePreview ? <Badge tone="primary" text="Free preview" /> : null}
            {l.courseStatus !== 'published' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap', backgroundColor: colors.warningSoft, borderRadius: 8, paddingHorizontal: space(3), paddingVertical: space(2) }}>
                <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '600' }}>
                  Course “{l.courseTitle}” is {l.courseStatus} — students cannot see or enroll in it yet.
                </Text>
                <Button small title="Publish course" onPress={publishCourse} loading={action.busy} />
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
          {l.status !== 'published' ? <Button title="Publish lesson" onPress={() => save({ status: 'published' })} loading={action.busy} /> : null}
          {l.status === 'published' && l.courseStatus === 'published'
            ? <Button variant="secondary" title="View as student ↗" onPress={() => navigate(`/lessons/${id}`)} /> : null}
        </View>
      </View>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />

      <Card>
        <H2>Lesson details</H2>
        <Field label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
        <Field label="Goal" value={form.goal} onChangeText={(goal) => setForm({ ...form, goal })}
          placeholder="e.g. Evaluate expressions in the correct order." hint="Shown under the title as “Goal: …”." />
        <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })}
          options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
        <Checkbox label="Free preview (students can open it before enrolling)" value={form.freePreview}
          onChange={(freePreview) => setForm({ ...form, freePreview })} />
        {l.sections.length === 0 ? (
          <View style={{ gap: space(2) }}>
            <Muted>
              This lesson has no sections yet, so students see the content and video below as one block.
              Adding sections (below) is the easier way to build a lesson.
            </Muted>
            <Field label="Content" multiline numberOfLines={5} value={form.content} onChangeText={(content) => setForm({ ...form, content })}
              hint="Blank lines separate paragraphs; $…$ for LaTeX; **bold**." />
            <Field label="Video URL" value={form.videoUrl} onChangeText={(videoUrl) => setForm({ ...form, videoUrl })} autoCapitalize="none" />
            {form.content.trim() ? <Card style={{ backgroundColor: colors.paper2 }}><MathParagraphs source={form.content} /></Card> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
          <Button title="Save details" onPress={() => save()} loading={action.busy} disabled={!form.title.trim() || !dirty} />
          {dirty ? <Text style={{ color: colors.warning, fontWeight: '600', fontSize: 13 }}>● unsaved changes</Text> : null}
        </View>
      </Card>

      <Card>
        <SectionsEditor lessonId={id} sections={l.sections} onChange={() => reload()} openAll preview />
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space(2) }}>
        {l.previousLessonId ? <Button variant="secondary" title="← Previous lesson" onPress={() => navigate(`/admin/lessons/${l.previousLessonId}`)} /> : <View />}
        {l.nextLessonId ? <Button variant="secondary" title="Next lesson →" onPress={() => navigate(`/admin/lessons/${l.nextLessonId}`)} /> : null}
      </View>
    </Screen>
  );
}

function Crumb({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      <Text style={[styles.crumb, { color: colors.link, textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crumb: { fontSize: 12, letterSpacing: 1.1, color: colors.ink3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: space(3) },
  h1: { fontFamily: fonts.sans, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8, color: colors.ink },
});
