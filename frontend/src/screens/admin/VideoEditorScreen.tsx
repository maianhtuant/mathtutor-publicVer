import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '../../api';
import { MathParagraphs } from '../../components/MathText';
import { SubjectPicker, TemplatePicker } from '../../components/SubjectTree';
import { Button, Card, ErrorBox, Field, H2, Loading, Muted, Notice, Screen, Select } from '../../components/ui';
import { VideoPlayer, embedUrlFor, parseVideoUrl } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import { indexSubjects } from '../../subjects';
import type { Video } from '../videos/VideosScreen';
import { visibilityOptions } from './AdminVideosScreen';

type Form = { title: string; videoUrl: string; subjectId: string; category: string; visibility: Video['visibility']; mathTemplateId: string; description: string };
const EMPTY: Form = { title: '', videoUrl: '', subjectId: '', category: '', visibility: 'PRIVATE', mathTemplateId: '', description: '' };

export default function VideoEditorScreen({ id }: { id: string }) {
  const isNew = id === 'new';
  const { data: subjects } = useApi<any[]>('/admin/subjects');
  const { data: templates } = useApi<any[]>('/admin/math-templates');
  const idx = useMemo(() => indexSubjects(subjects), [subjects]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(isNew);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const action = useAction();

  useEffect(() => {
    if (isNew) return;
    action.run(async () => {
      const v = await api.get<Video>(`/videos/${id}`);
      setForm({ title: v.title, videoUrl: v.videoUrl, subjectId: v.subjectId, category: v.category ?? '', visibility: v.visibility,
        mathTemplateId: v.mathTemplateId ?? '', description: v.description ?? '' });
      setLoaded(true);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return action.error ? <Screen title="Video"><ErrorBox message={action.error} /></Screen> : <Loading />;

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const parsed = parseVideoUrl(form.videoUrl);
  // Archived templates can't give practice questions; keep one only if this video already uses it.
  const practiceTemplates = (templates ?? []).filter((t) => t.active || t.id === form.mathTemplateId);
  const practiceLabel = practiceTemplates.find((t) => t.id === form.mathTemplateId)?.label;

  const save = () => action.run(async () => {
    const body = { ...form, mathTemplateId: form.mathTemplateId || null, clearMathTemplate: !form.mathTemplateId };
    const v = isNew ? await api.post<Video>('/admin/videos', body) : await api.patch<Video>(`/admin/videos/${id}`, body);
    if (isNew) navigate(`/admin/videos/${v.id}`);
  }, 'Saved');

  const remove = () => action.run(async () => {
    await api.del(`/admin/videos/${id}`);
    navigate('/admin/videos');
  });

  return (
    <Screen kicker="Admin · Videos" title={isNew ? 'New video' : form.title || 'Video'}
      actions={<>
        <Button variant="secondary" title="← All videos" onPress={() => navigate('/admin/videos')} />
        {!isNew ? <Button variant="secondary" title="View lesson" onPress={() => navigate(`/videos/${id}`)} /> : null}
      </>}>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(5), alignItems: 'flex-start' }}>
        <Card style={{ flexGrow: 1, flexBasis: 460 }}>
          <Field label="Title *" value={form.title} onChangeText={(title) => set({ title })} />
          <Field label="Video URL *" value={form.videoUrl} onChangeText={(videoUrl) => set({ videoUrl })} autoCapitalize="none"
            placeholder="https://www.youtube.com/watch?v=…"
            hint={form.videoUrl ? (parsed.provider === 'unknown' ? 'Not a recognised YouTube or Vimeo link — students will get a link instead of a player.' : `Detected ${parsed.provider} video ${parsed.embedId}`) : 'YouTube (watch, youtu.be, embed, shorts) or Vimeo links'} />
          <Field label="Category" value={form.category} onChangeText={(category) => set({ category })} placeholder="e.g. Decimals" hint="Lessons are grouped by category inside a subject." />
          <Select label="Visibility" value={form.visibility} options={visibilityOptions} onChange={(visibility) => set({ visibility })} />
          <Field label="Notes" multiline numberOfLines={6} value={form.description} onChangeText={(description) => set({ description })}
            hint="Shown under the player. Blank lines separate paragraphs; use $...$ for LaTeX." />
          <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap', alignItems: 'center' }}>
            <Button title={isNew ? 'Create video' : 'Save changes'} onPress={save} loading={action.busy}
              disabled={!form.title.trim() || !form.videoUrl.trim() || !form.subjectId} />
            {!isNew && !confirmDelete ? <Button variant="danger" title="Delete" onPress={() => setConfirmDelete(true)} /> : null}
            {confirmDelete ? (
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
                <Text style={{ color: colors.dangerInk }}>Delete this lesson permanently?</Text>
                <Button variant="danger" title="Yes, delete" onPress={remove} />
                <Button variant="secondary" title="Cancel" onPress={() => setConfirmDelete(false)} />
              </View>
            ) : null}
          </View>
        </Card>
        <View style={{ flexGrow: 1, flexBasis: 380, gap: space(4) }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H2>Subject *</H2>
              <Pressable onPress={() => navigate('/admin/subjects')} accessibilityRole="link">
                {({ hovered }: any) => (
                  <Text style={{ fontSize: 12.5, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Manage subjects ›</Text>
                )}
              </Pressable>
            </View>
            <SubjectPicker subjects={subjects} value={form.subjectId} onChange={(subjectId) => set({ subjectId })} maxHeight={260} />
            <Muted style={{ marginTop: space(2), fontSize: 12.5, color: form.subjectId ? colors.ink3 : colors.warning }}>
              {form.subjectId ? idx.label(form.subjectId) : 'Pick a subject to save this video.'}
            </Muted>
          </Card>
          <Card>
            <H2>Practice template</H2>
            <Muted style={{ marginBottom: space(2), fontSize: 12.5 }}>Questions shown beside the video.</Muted>
            <TemplatePicker subjects={subjects} templates={practiceTemplates} value={form.mathTemplateId}
              onChange={(mathTemplateId) => set({ mathTemplateId })} maxHeight={300} />
            <Muted style={{ marginTop: space(2), fontSize: 12.5 }}>{practiceLabel ?? 'No practice questions'}</Muted>
          </Card>
          <H2>Preview</H2>
          <VideoPlayer embedUrl={embedUrlFor(form.videoUrl)} sourceUrl={form.videoUrl} title={form.title || 'Preview'} />
          {form.description ? <Card><MathParagraphs source={form.description} /></Card> : <Muted>Notes preview appears here.</Muted>}
        </View>
      </View>
    </Screen>
  );
}
