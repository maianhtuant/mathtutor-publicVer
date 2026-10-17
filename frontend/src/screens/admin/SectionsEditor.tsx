import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '../../api';
import { Button, ErrorBox, Field, H2, Muted, Notice, Select } from '../../components/ui';
import { MathParagraphs } from '../../components/MathText';
import { VideoPlayer, embedUrlFor, parseVideoUrl } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import SectionPracticeEditor, { PracticeRow } from './SectionPracticeEditor';
import { colors, radius, space } from '../../theme';

interface Section {
  id: string; position: number; title: string; videoUrl: string | null; explanation: string; transcript: string | null;
  workedExample: string | null; practiceHint: string | null;
  practice: { mathTemplateId: string; label: string; subjectName: string | null; questionCount: number }[];
}

/**
 * Lesson sections, each shown on the student lesson page as: video, Explanation / Transcript / Worked example
 * tabs, and a collapsible "Practice this section" panel driven by the chosen math template.
 */
export default function SectionsEditor({ lessonId, sections, onChange, openAll, preview }: {
  lessonId: string; sections: Section[]; onChange: (course: any) => void;
  /** Show every section expanded (lesson editor page); otherwise one at a time. */
  openAll?: boolean;
  /** Show a live student preview beside each section form. */
  preview?: boolean;
}) {
  const { data: templates } = useApi<any[]>('/admin/math-templates');
  const [openId, setOpenId] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => (openAll ? !closed.has(id) : openId === id);
  const toggle = (id: string) => {
    if (!openAll) { setOpenId(openId === id ? null : id); return; }
    setClosed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const [newTitle, setNewTitle] = useState('');
  const action = useAction();

  const add = () => action.run(async () => {
    onChange(await api.post(`/admin/lessons/${lessonId}/sections`, { title: newTitle.trim(), explanation: '' }));
    setNewTitle('');
  }, 'Section added');

  return (
    <View style={{ marginTop: space(5), borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(4), gap: space(3) }}>
      <H2>Sections</H2>
      <Muted>Each section shows a video, Explanation / Transcript / Worked example tabs and optional inline practice.</Muted>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      {sections.map((s, i) => (
        <SectionRow key={s.id} section={s} first={i === 0} last={i === sections.length - 1} templates={templates ?? []}
          open={isOpen(s.id)} onToggle={() => toggle(s.id)} onChange={onChange} preview={preview} />
      ))}
      {sections.length === 0 ? <Muted>No sections yet — the lesson shows its content and video as a single block.</Muted> : null}
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="New section title" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Parentheses and exponents first"
          style={{ flexBasis: 320 }} onSubmitEditing={() => newTitle.trim() && add()} />
        <View style={{ marginBottom: space(4) }}><Button title="+ Add section" onPress={add} disabled={!newTitle.trim()} loading={action.busy} /></View>
      </View>
    </View>
  );
}

function SectionRow({ section: s, first, last, templates, open, onToggle, onChange, preview }: {
  section: Section; first: boolean; last: boolean; templates: any[]; open: boolean; onToggle: () => void; onChange: (c: any) => void;
  preview?: boolean;
}) {
  const [f, setF] = useState({
    title: s.title, videoUrl: s.videoUrl ?? '', explanation: s.explanation ?? '', transcript: s.transcript ?? '',
    workedExample: s.workedExample ?? '', practiceHint: s.practiceHint ?? '',
    practice: (s.practice ?? []).map((p): PracticeRow => ({ mathTemplateId: p.mathTemplateId, label: p.label, subjectName: p.subjectName, questionCount: String(p.questionCount) })),
  });
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(f);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const action = useAction();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const save = () => action.run(async () => {
    onChange(await api.patch(`/admin/sections/${s.id}`, {
      ...f,
      practice: f.practice.map((r) => ({ mathTemplateId: r.mathTemplateId, questionCount: Math.min(20, Math.max(1, Number(r.questionCount) || 1)) })),
    }));
    setSaved(f);
  }, 'Section saved');
  const move = (delta: number) => action.run(async () => onChange(await api.post(`/admin/sections/${s.id}/move?delta=${delta}`)));
  const remove = () => action.run(async () => onChange(await api.del(`/admin/sections/${s.id}`)));
  const parsed = parseVideoUrl(f.videoUrl);

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 10, color: colors.ink2 }}>{open ? '▼' : '▶'}</Text>
        <Text style={{ fontWeight: '600', color: colors.ink, flex: 1 }}>{s.position}. {s.title}</Text>
        {dirty ? <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600' }}>● unsaved</Text> : null}
        <Text style={{ fontSize: 12, color: colors.ink3 }}>
          {[s.videoUrl ? 'video' : null, (s.practice ?? []).length ? `practice: ${(s.practice ?? []).reduce((n, p) => n + p.questionCount, 0)} problems` : null].filter(Boolean).join(' · ') || 'text only'}
        </Text>
        <Button small variant="ghost" title="↑" disabled={first} onPress={() => move(-1)} />
        <Button small variant="ghost" title="↓" disabled={last} onPress={() => move(1)} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), flexDirection: 'row', flexWrap: 'wrap', gap: space(5) }}>
        <View style={{ flexGrow: 1, flexBasis: 420 }}>
          <ErrorBox message={action.error} />
          <Field label="Title" value={f.title} onChangeText={(title) => set({ title })} />
          <Field label="Video URL" value={f.videoUrl} onChangeText={(videoUrl) => set({ videoUrl })} autoCapitalize="none"
            placeholder="YouTube or Vimeo link (optional)"
            hint={f.videoUrl ? (embedUrlFor(f.videoUrl) ? `Detected ${parsed.provider} video` : 'Not a YouTube/Vimeo link — students will see a link instead of a player') : 'Leave empty to show the “Video not available yet” placeholder.'} />
          <Field label="Explanation" multiline numberOfLines={5} value={f.explanation} onChangeText={(explanation) => set({ explanation })}
            hint="Blank lines separate paragraphs; $…$ for LaTeX; **bold**." />
          <Field label="Transcript (optional tab)" multiline numberOfLines={3} value={f.transcript} onChangeText={(transcript) => set({ transcript })} />
          <Field label="Worked example (optional tab)" multiline numberOfLines={3} value={f.workedExample} onChangeText={(workedExample) => set({ workedExample })} />
        </View>
        {preview ? (
          <View style={{ flexGrow: 1, flexBasis: 340, gap: space(3) }}>
            <Text style={{ fontSize: 11.5, letterSpacing: 1.2, color: colors.ink3 }}>STUDENT PREVIEW</Text>
            <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space(4), gap: space(3), backgroundColor: '#fffdf9' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{s.position}. {f.title || 'Untitled section'}</Text>
              {embedUrlFor(f.videoUrl)
                ? <VideoPlayer embedUrl={embedUrlFor(f.videoUrl)} sourceUrl={f.videoUrl} title={f.title} />
                : <View style={{ aspectRatio: 16 / 7, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: 6, backgroundColor: '#ebe8e3', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.ink3, fontSize: 12.5 }}>Video not available yet</Text>
                  </View>}
              {f.explanation.trim() ? <MathParagraphs source={f.explanation} /> : <Muted>The explanation appears here as you type.</Muted>}
              {f.practice.length ? (
                <View style={{ backgroundColor: colors.lavSoft, borderLeftWidth: 3, borderLeftColor: colors.lavLine, borderRadius: 6, padding: space(3) }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>Practice this section</Text>
                  <Text style={{ color: colors.ink2, marginTop: 4 }}>
                    {f.practice.reduce((n, r) => n + (Number(r.questionCount) || 0), 0)} problems with hints and instant feedback:{' '}
                    {f.practice.map((r) => `${r.label} ×${r.questionCount || 0}`).join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={{ flexBasis: '100%', gap: space(3), borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(4) }}>
          <SectionPracticeEditor rows={f.practice} onChange={(practice) => set({ practice })} templates={templates} />
          {f.practice.length ? (
            <Field label="Hint" value={f.practiceHint} onChangeText={(practiceHint) => set({ practiceHint })}
              placeholder="Shown when the student taps “Show a hint”" />
          ) : null}
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', flexWrap: 'wrap' }}>
            <Button title="Save section" onPress={save} loading={action.busy} disabled={!f.title.trim()} />
            {confirm ? (
              <>
                <Text style={{ color: colors.dangerInk }}>Delete this section?</Text>
                <Button variant="danger" title="Yes, delete" onPress={remove} />
                <Button variant="secondary" title="Cancel" onPress={() => setConfirm(false)} />
              </>
            ) : <Button variant="danger" title="Delete" onPress={() => setConfirm(true)} />}
            {action.notice && !dirty ? <Text style={{ color: colors.success, fontSize: 13 }}>✓ Saved</Text> : null}
          </View>
        </View>
        </View>
      ) : null}
    </View>
  );
}
