import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '../../api';
import { MathInline, MathText } from '../../components/MathText';
import { Badge, Button, Card, ErrorBox, Field, H2, Loading, Muted, Notice, Screen, Select, Table, statusTone } from '../../components/ui';
import { Figure } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import { indexPlaces, placeKey, type ContentTree } from '../../places';
import { colors, space } from '../../theme';
import TemplateRowsEditor, { RuleRow } from './TemplateRowsEditor';
import { useAuth } from '../../auth';
import { canEdit, editsAll } from '../../types';

type FixedRow = { questionId: string; points: string };

export default function PracticeSetEditorScreen({ id }: { id: string }) {
  const { user: me } = useAuth();
  const { data: set, setData, error } = useApi<any>(`/admin/practice-sets/${id}`);
  const { data: versions } = useApi<any[]>('/admin/template-versions/published');
  const { data: bank } = useApi<any[]>('/admin/questions');
  const { data: tree } = useApi<ContentTree>('/admin/content-tree');
  // "Add templates" lists the templates in the course's subject (with its courses, chapters and lessons), or in the
  // course itself when it has no subject, unless "Show all" is picked.
  const scope = useMemo(() => {
    if (!set || !tree) return null;
    const places = indexPlaces(tree);
    const subjectKey = placeKey('subject', set.courseSubjectId);
    const rootKey = places.byKey.has(subjectKey) ? subjectKey : placeKey('course', set.courseId);
    return places.byKey.has(rootKey) ? { rootKey, label: places.label(rootKey) } : null;
  }, [set, tree]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [fixed, setFixed] = useState<FixedRow[]>([]);
  const [header, setHeader] = useState({ title: '', passPercent: '', timeLimitMinutes: '', maxAttempts: '' });
  const [preview, setPreview] = useState<any>(null);
  const action = useAction();
  const previewAction = useAction();

  useEffect(() => {
    if (!set) return;
    setRules(set.rules.map((r: any) => ({
      id: r.id, answerMode: r.answerMode ?? null, templateVersionId: r.templateVersionId, questionCount: String(r.questionCount),
      pointsPerQuestion: String(Number(r.pointsPerQuestion)), variableOverrides: JSON.stringify(r.variableOverrides ?? {}),
    })));
    setFixed(set.questions.map((q: any) => ({ questionId: q.questionId, points: String(Number(q.points)) })));
    setHeader({
      title: set.title, passPercent: String(Number(set.passPercent)),
      timeLimitMinutes: set.timeLimitSeconds ? String(set.timeLimitSeconds / 60) : '', maxAttempts: set.maxAttempts ? String(set.maxAttempts) : '',
    });
  }, [set]);

  if (!set) return error ? <Screen title="Practice set"><ErrorBox message={error} /></Screen> : <Loading />;
  const draft = set.status === 'draft';
  // Published sets stay editable; only archived sets are frozen.
  // Teachers change only practice sets they created; supervisors change nothing.
  const mine = canEdit(me?.role) && (editsAll(me?.role) || set.createdBy === me?.id);
  const editable = mine && set.status !== 'archived';


  const totalQuestions = rules.reduce((s, r) => s + (Number(r.questionCount) || 0), 0) + fixed.length;
  const totalPoints = rules.reduce((s, r) => s + (Number(r.questionCount) || 0) * (Number(r.pointsPerQuestion) || 0), 0)
    + fixed.reduce((s, q) => s + (Number(q.points) || 0), 0);

  const saveAll = async () => {
    const parsed = rules.map((r, i) => {
      let overrides = {};
      try { overrides = r.variableOverrides.trim() ? JSON.parse(r.variableOverrides) : {}; }
      catch { throw new Error(`Row ${i + 1}: variable overrides must be valid JSON`); }
      return { id: r.id, answerMode: r.answerMode ?? null, templateVersionId: r.templateVersionId, questionCount: Number(r.questionCount), pointsPerQuestion: Number(r.pointsPerQuestion), variableOverrides: overrides };
    });
    await api.patch(`/admin/practice-sets/${id}`, {
      title: header.title, passPercent: Number(header.passPercent),
      timeLimitSeconds: header.timeLimitMinutes ? Math.round(Number(header.timeLimitMinutes) * 60) : null, clearTimeLimit: !header.timeLimitMinutes,
      maxAttempts: header.maxAttempts ? Number(header.maxAttempts) : null, clearMaxAttempts: !header.maxAttempts,
    });
    await api.put(`/admin/practice-sets/${id}/rules`, { rules: parsed });
    return api.put<any>(`/admin/practice-sets/${id}/questions`, { questions: fixed.map((q) => ({ questionId: q.questionId, points: Number(q.points) })) });
  };

  const save = () => action.run(async () => setData(await saveAll()),
    draft ? 'Draft saved' : 'Changes saved. New attempts use them; earlier attempts keep their questions.');
  const runPreview = () => previewAction.run(async () => {
    if (editable) setData(await saveAll());
    setPreview(await api.post(`/admin/practice-sets/${id}/preview`));
  });
  const publish = () => action.run(async () => {
    await saveAll();
    setData(await api.post(`/admin/practice-sets/${id}/publish`));
  }, 'Published. Students with an assignment can now start it.');
  const archive = () => action.run(async () => setData(await api.post(`/admin/practice-sets/${id}/archive`)), 'Archived: no new attempts can start.');


  return (
    <Screen title={set.title} subtitle={`${set.courseTitle} · ${totalQuestions} questions · ${totalPoints} points`}
      actions={<>
        <Badge tone={statusTone(set.status)} text={set.status} />
        {mine && set.status === 'published' ? <Button variant="danger" small title="Archive" onPress={archive} /> : null}
      </>}>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      {set.status === 'published' ? (
        <Notice message="This set is published. You can still change rows, questions and settings: students get the changes on their next attempt, and earlier attempts keep the questions they had." />
      ) : null}
      {set.status === 'archived' ? <Muted>Archived sets are frozen.</Muted> : null}
      {!mine ? <Muted>Created by {set.createdByName ?? 'another user'}. You can view and preview it and assign it to students; only its creator or an administrator can change it.</Muted> : null}

      <Card>
        <H2>Settings</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          <Field label="Title" value={header.title} editable={editable} onChangeText={(title) => setHeader({ ...header, title })} style={{ flexBasis: 280 }} />
          <Field label="Pass threshold (%)" value={header.passPercent} editable={editable} onChangeText={(passPercent) => setHeader({ ...header, passPercent })} style={{ flexBasis: 120 }} />
          <Field label="Time limit (minutes)" value={header.timeLimitMinutes} editable={editable} placeholder="none" onChangeText={(timeLimitMinutes) => setHeader({ ...header, timeLimitMinutes })} style={{ flexBasis: 140 }} />
          <Field label="Max attempts" value={header.maxAttempts} editable={editable} placeholder="unlimited" onChangeText={(maxAttempts) => setHeader({ ...header, maxAttempts })} style={{ flexBasis: 120 }} />
        </View>
      </Card>

      <TemplateRowsEditor rules={rules} onChange={setRules} versions={versions ?? []} draft={editable} scope={scope} tree={tree}
        courseTitle={set.courseTitle}
        missingLabels={Object.fromEntries(set.rules.map((r: any) => [r.templateVersionId, `${r.label} v${r.versionNo} (${r.versionStatus})`]))} />
      {!(versions ?? []).length ? <Muted>Publish a math template first.</Muted> : null}

      <Card>
        <H2>Fixed questions (optional)</H2>
        <Muted style={{ marginBottom: space(3) }}>Multiple-choice questions from the question bank, placed after the template groups.</Muted>
        {fixed.map((q, i) => {
          const bq = bank?.find((b) => b.id === q.questionId);
          return (
            <View key={q.questionId} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(2), flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 240 }}><MathText source={bq?.prompt ?? q.questionId} size={14} /></View>
              <Field label="Points" value={q.points} editable={editable} onChangeText={(points) => setFixed(fixed.map((x, j) => (j === i ? { ...x, points } : x)))} style={{ flexBasis: 90, flexGrow: 0 }} />
              {editable ? <Button small variant="danger" title="Remove" onPress={() => setFixed(fixed.filter((_, j) => j !== i))} /> : null}
            </View>
          );
        })}
        {editable && bank && bank.filter((b) => !fixed.some((f) => f.questionId === b.id)).length ? (
          <Select label="Add from bank" value={'' as string} onChange={(questionId) => setFixed([...fixed, { questionId, points: '1' }])}
            options={bank.filter((b) => !fixed.some((f) => f.questionId === b.id)).map((b) => ({ value: b.id, label: b.prompt.slice(0, 50) }))} />
        ) : null}
      </Card>

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' }}>
        <Text style={{ fontWeight: '600', color: colors.text, marginRight: space(2) }}>Total: {totalQuestions} questions · {totalPoints} points</Text>
        {editable ? <Button title={draft ? 'Save draft' : 'Save changes'} onPress={save} loading={action.busy} /> : null}
        <Button variant="secondary" title="Preview questions" onPress={runPreview} loading={previewAction.busy} />
        {mine && draft ? <Button variant="secondary" title="Publish" onPress={publish} loading={action.busy} /> : null}
      </Card>

      <ErrorBox message={previewAction.error} />
      {preview ? (
        <Card>
          <H2>Preview · {preview.totalQuestions} questions · {Number(preview.maxScore)} points</H2>
          <Muted style={{ marginBottom: space(3) }}>Preview is not an attempt and does not affect anyone's progress. Each student attempt gets its own questions.</Muted>
          {preview.sections.map((s: any, si: number) => (
            <View key={si} style={{ marginBottom: space(4) }}>
              <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space(2) }}>{s.label} v{s.versionNo} · {s.answerMode === 'multiple_choice' ? 'multiple choice' : 'fill in'} · {Number(s.pointsPerQuestion)} pt each</Text>
              <Table columns={[
                { key: 'position', title: '#', flex: 0.4 },
                { key: 'promptLatex', title: 'Question', flex: 3, render: (r) => <View><MathText source={r.promptLatex} size={15} /><Figure svg={r.figureSvg} maxWidth={260} /></View> },
                { key: 'answerDisplay', title: 'Answer', render: (r) => <Text style={{ color: colors.success, fontWeight: '600' }}>{r.answerDisplay}</Text> },
                { key: 'options', title: 'Options', flex: 2, render: (r) => r.options.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
                    {r.options.map((o: any, j: number) => <View key={j} style={{ paddingHorizontal: 6, borderRadius: 4, backgroundColor: o.isCorrect ? colors.successSoft : colors.bg }}><MathInline tex={o.latex} size={13} /></View>)}
                  </View>) : <Text>—</Text> },
              ]} rows={s.items} />
            </View>
          ))}
          {preview.fixedQuestions.length ? <Muted>+ {preview.fixedQuestions.length} fixed question(s)</Muted> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
