import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '../../api';
import { MathParagraphs } from '../../components/MathText';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, H2, Loading, Notice, Screen, Select, statusTone } from '../../components/ui';
import SectionsEditor from './SectionsEditor';
import { useAction, useApi } from '../../hooks';
import { colors, space } from '../../theme';
import { navigate } from '../../router';
import { indexSubjects, subjectOptions } from '../../subjects';

type Status = 'draft' | 'published' | 'archived';
const statusOptions: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' },
];

export default function CourseEditorScreen({ id }: { id: string }) {
  const { data: course, setData, error } = useApi<any>(`/admin/courses/${id}`);
  const [chapterTitle, setChapterTitle] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const action = useAction();
  if (!course) return error ? <Screen title="Course"><ErrorBox message={error} /></Screen> : <Loading />;

  const lessonOf = (lessonId: string) => course.chapters.flatMap((c: any) => c.lessons).find((x: any) => x.id === lessonId);
  const update = (body: any, msg?: string) => action.run(async () => setData(await api.patch(`/admin/courses/${id}`, body)), msg);
  const addChapter = () => action.run(async () => { setData(await api.post(`/admin/courses/${id}/chapters`, { title: chapterTitle })); setChapterTitle(''); });
  const addLesson = (chapterId: string) => action.run(async () => setData(await api.post(`/admin/chapters/${chapterId}/lessons`, { title: 'New lesson', content: '' })));
  const saveLesson = () => action.run(async () => {
    setData(await api.patch(`/admin/lessons/${editing.id}`, {
      title: editing.title, content: editing.content, videoUrl: editing.videoUrl ?? '', status: editing.status,
      goal: editing.goal ?? '', freePreview: !!editing.freePreview,
    }));
    setEditing(null);
  }, 'Lesson saved');

  return (
    <Screen title={course.title} subtitle="Edit course details, chapters and lessons"
      actions={<><Badge tone={statusTone(course.status)} text={course.status} /><Button variant="secondary" title="← Content tree" onPress={() => navigate('/admin/tree')} /></>}>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      <Card>
        <H2>Course</H2>
        <CourseForm course={course} onSave={(b) => update(b, 'Course saved')} busy={action.busy} />
      </Card>

      {course.chapters.map((ch: any) => (
        <Card key={ch.id}>
          <H2>{ch.position}. {ch.title}</H2>
          {ch.lessons.map((l: any) => (
            <Pressable key={l.id} onPress={() => setEditing({ ...l })}
              style={({ hovered }: any) => [{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space(3), borderRadius: 8 }, hovered ? { backgroundColor: colors.bg } : null]}>
              <Text style={{ color: colors.text }}>{ch.position}.{l.position} {l.title}</Text>
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
                <Badge tone={statusTone(l.status)} text={l.status} />
                <Button small variant="ghost" title="Open editor ›" onPress={() => navigate(`/admin/lessons/${l.id}`)} />
              </View>
            </Pressable>
          ))}
          {editing && ch.lessons.some((l: any) => l.id === editing.id) ? (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space(4), marginTop: space(2) }}>
              <Field label="Lesson title" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} />
              <Field label="Goal" value={editing.goal ?? ''} onChangeText={(goal) => setEditing({ ...editing, goal })}
                placeholder="e.g. Evaluate expressions in the correct order." hint="Shown under the lesson title as “Goal: …”." />
              <Select label="Status" value={editing.status} options={statusOptions} onChange={(status) => setEditing({ ...editing, status })} />
              <Checkbox label="Free preview (students can open it before enrolling)" value={!!editing.freePreview}
                onChange={(freePreview) => setEditing({ ...editing, freePreview })} />
              {(lessonOf(editing.id)?.sections ?? []).length === 0 ? (
                <>
                  <Field label="Content (used while the lesson has no sections)" multiline numberOfLines={6} value={editing.content}
                    onChangeText={(content) => setEditing({ ...editing, content })}
                    hint="Blank lines separate paragraphs. Use $...$ for LaTeX and **bold** for emphasis." />
                  <Field label="Video URL (optional)" value={editing.videoUrl ?? ''} onChangeText={(videoUrl) => setEditing({ ...editing, videoUrl })} autoCapitalize="none" />
                  <Card style={{ backgroundColor: colors.paper2, marginBottom: space(3) }}><MathParagraphs source={editing.content || '(empty)'} /></Card>
                </>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <Button title="Save lesson" onPress={saveLesson} loading={action.busy} />
                <Button variant="secondary" title="Close" onPress={() => setEditing(null)} />
                {editing.status === 'published' ? <Button variant="ghost" title="View as student ↗" onPress={() => navigate(`/lessons/${editing.id}`)} /> : null}
              </View>
              <SectionsEditor lessonId={editing.id} sections={lessonOf(editing.id)?.sections ?? []} onChange={setData} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: space(2) }}><Button small variant="ghost" title="+ Add lesson" onPress={() => addLesson(ch.id)} /></View>
        </Card>
      ))}

      <Card>
        <H2>Add chapter</H2>
        <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Chapter title" value={chapterTitle} onChangeText={setChapterTitle} style={{ flexBasis: 300 }} />
          <View style={{ marginBottom: space(3) }}><Button title="Add chapter" onPress={addChapter} disabled={!chapterTitle.trim()} /></View>
        </View>
      </Card>
    </Screen>
  );
}

function CourseForm({ course, onSave, busy }: { course: any; onSave: (b: any) => void; busy: boolean }) {
  const { data: subjects } = useApi<any[]>('/admin/subjects');
  const [subjectId, setSubjectId] = useState<string>(course.subjectId ?? '');
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? '');
  const [status, setStatus] = useState<Status>(course.status);
  const [readiness, setReadiness] = useState(course.readiness ?? '');
  return (
    <View>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Readiness" value={readiness} onChangeText={setReadiness} placeholder="e.g. Foundational arithmetic"
        hint="Shown on the course page as an advisory prerequisite." />
      <Select label="Status" value={status} options={statusOptions} onChange={setStatus} />
      <Select label="Subject (content tree)" value={subjectId} onChange={setSubjectId}
        options={[{ value: '', label: 'Unassigned' }, ...subjectOptions(indexSubjects(subjects))]} />
      <View style={{ flexDirection: 'row' }}>
        <Button title="Save course" onPress={() => onSave({ title, description, status, readiness, subjectId: subjectId || null, clearSubject: !subjectId })} loading={busy} />
      </View>
    </View>
  );
}
