import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { api } from '../../api';
import { MathInline, MathText } from '../../components/MathText';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, H2, Loading, Muted, Notice, Screen, Select, statusTone } from '../../components/ui';
import { PlacePicker } from '../../components/SubjectTree';
import { Figure } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import { indexPlaces, keyOf, splitKey, type ContentTree } from '../../places';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import type { GeneratedItem, MathTemplate, TemplateVersion, VersionContent } from '../../types';
import { useAuth } from '../../auth';
import { canEdit, editsAll } from '../../types';

type Form = {
  label: string; topicCode: string; place: string; active: boolean;
  promptTemplate: string; answerFormula: string; answerMode: VersionContent['answerMode'];
  defaultMin: string; defaultMax: string; variables: string; constraints: string;
  relativeTolerancePercent: string; absoluteTolerance: string; decimalPlaces: string; acceptRoundedDecimal: boolean;
  wrongAnswers: string[];
  figure: string;
};

const EMPTY: Form = {
  label: '', topicCode: '', place: '', active: true,
  promptTemplate: 'Find the least common multiple of {a:2–20} and {b:2–20}.', answerFormula: 'lcm(a, b)', answerMode: 'numeric',
  defaultMin: '1', defaultMax: '10', variables: '{}', constraints: 'a != b',
  relativeTolerancePercent: '0', absoluteTolerance: '0', decimalPlaces: '2', acceptRoundedDecimal: false, wrongAnswers: ['', '', ''],
  figure: '',
};

function fromVersion(t: MathTemplate, v: TemplateVersion): Form {
  return {
    label: t.label, topicCode: t.topicCode, place: keyOf(t), active: t.active,
    promptTemplate: v.promptTemplate, answerFormula: v.answerFormula ?? '', answerMode: v.answerMode,
    defaultMin: String(v.defaultMin), defaultMax: String(v.defaultMax),
    variables: JSON.stringify(v.variables ?? {}, null, 2), constraints: (v.constraints ?? []).join('\n'),
    relativeTolerancePercent: String(v.relativeTolerancePercent), absoluteTolerance: String(v.absoluteTolerance),
    decimalPlaces: String(v.decimalPlaces), acceptRoundedDecimal: v.acceptRoundedDecimal,
    wrongAnswers: padWrong(v.wrongAnswerFormulas ?? []),
    figure: v.figure ? JSON.stringify(v.figure, null, 2) : '',
  };
}

/** API fields for a place key ("" = nowhere). */
function placeBody(key: string) {
  const p = splitKey(key);
  return { placeType: p ? p.type : 'none', placeId: p ? p.id : null };
}

function toContent(f: Form): VersionContent {
  let variables: Record<string, unknown>;
  try {
    variables = f.variables.trim() ? JSON.parse(f.variables) : {};
  } catch {
    throw new Error('Variables must be valid JSON, e.g. {"a": {"type": "decimal", "min": 1.1, "max": 9.9, "scale": 1}}');
  }
  let figure: Record<string, unknown> | null;
  try {
    figure = f.figure.trim() ? JSON.parse(f.figure) : null;
  } catch {
    throw new Error('Figure must be valid JSON, e.g. {"shape": "rectangle", "labels": {"width": "{l} cm", "height": "{w} cm"}}');
  }
  return {
    promptTemplate: f.promptTemplate,
    answerFormula: f.answerMode === 'display_only' ? null : f.answerFormula,
    answerMode: f.answerMode,
    defaultMin: Number(f.defaultMin), defaultMax: Number(f.defaultMax),
    variables,
    constraints: f.constraints.split(/\n|,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean),
    relativeTolerancePercent: Number(f.relativeTolerancePercent), absoluteTolerance: Number(f.absoluteTolerance),
    decimalPlaces: Number(f.decimalPlaces), acceptRoundedDecimal: f.acceptRoundedDecimal,
    wrongAnswerFormulas: f.answerMode !== 'display_only' ? f.wrongAnswers.map((w) => w.trim()).filter(Boolean) : [],
    figure,
  };
}

const MAX_WRONG = 6;

/** Always show at least three wrong-answer boxes. */
function padWrong(list: string[]): string[] {
  return [...list, '', '', ''].slice(0, Math.max(3, list.length));
}

interface Preview {
  items: GeneratedItem[]; warnings: string[]; answerFormulaLatex: string | null;
  errors?: { code: string; message: string }[]; interchangeableGroups?: string[][];
}

export default function TemplateEditorScreen({ id }: { id: string }) {
  const { user: me } = useAuth();
  const { data: tree } = useApi<ContentTree>('/admin/content-tree');
  const places = useMemo(() => indexPlaces(tree), [tree]);
  const isNew = id === 'new';
  const [template, setTemplate] = useState<MathTemplate | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const action = useAction();
  const previewAction = useAction();

  const load = async (selectVersion?: string) => {
    const t = await api.get<MathTemplate>(`/admin/math-templates/${id}`);
    setTemplate(t);
    const v = t.versions.find((x) => x.id === selectVersion) ?? t.versions[0];
    setVersionId(v.id);
    setForm(fromVersion(t, v));
    setPreview(null);
  };

  useEffect(() => {
    if (!isNew) action.run(() => load());
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isNew && !template) return action.error ? <Screen title="Template"><ErrorBox message={action.error} /></Screen> : <Loading />;

  const version = template?.versions.find((v) => v.id === versionId) ?? null;
  // Teachers change only templates they created; supervisors change nothing.
  const mine = isNew || (canEdit(me?.role) && (editsAll(me?.role) || template!.createdBy === me?.id));
  const editable = mine && (isNew || version?.status === 'draft');
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const runPreview = () => previewAction.run(async () => {
    // Validates the unsaved form through the backend -> math-service (SymPy).
    const r = await api.post<any>('/admin/math-templates/validate', toContent(form));
    setPreview({ items: r.samples, warnings: r.warnings, answerFormulaLatex: r.answerFormulaLatex, errors: r.errors });
  });

  const save = () => action.run(async () => {
    const content = toContent(form);
    if (isNew) {
      const t = await api.post<MathTemplate>('/admin/math-templates', {
        label: form.label, topicCode: form.topicCode, ...placeBody(form.place), active: form.active, version: content,
      });
      navigate(`/admin/templates/${t.id}`);
      return;
    }
    await api.patch(`/admin/math-templates/${id}`, {
      label: form.label, topicCode: form.topicCode, active: form.active, ...placeBody(form.place),
    });
    if (editable) await api.patch(`/admin/template-versions/${versionId}`, content);
    await load(versionId!);
  }, 'Saved');

  const publish = () => action.run(async () => {
    await api.patch(`/admin/template-versions/${versionId}`, toContent(form));
    await api.post(`/admin/template-versions/${versionId}/publish`);
    await load(versionId!);
  }, 'Version published. It is now immutable; edit by creating a new version.');

  const newVersion = () => action.run(async () => {
    const v = await api.post<TemplateVersion>(`/admin/math-templates/${id}/versions`);
    await load(v.id);
  }, 'New draft version created from the selected version');

  // Archived = inactive: listed only under Archive on the Math templates page.
  const toggleArchived = () => action.run(async () => {
    await api.post('/admin/math-templates/archive', { ids: [id], archived: template!.active });
    await load(versionId!);
  }, template!.active ? 'Archived. It now appears only under Archive.' : 'Restored');

  // Delete asks first; a template still used somewhere is kept and the reason is shown.
  const deleteTemplate = () => action.run(async () => {
    const r = await api.post<{ deleted: number; kept: { reason: string }[] }>('/admin/math-templates/delete', { ids: [id] });
    setConfirmDelete(false);
    if (r.kept.length) throw new Error(`Not deleted — ${r.kept[0].reason}. Remove it from there first, or archive it instead.`);
    navigate('/admin/templates');
  });

  return (
    <Screen title={isNew ? 'New math template' : template!.label}
      subtitle={isNew ? 'Create draft → preview → validate → publish'
        : `${template!.topicCode}${keyOf(template!) ? ` · ${places.label(keyOf(template!)) || template!.subject}` : ''}`}
      actions={!isNew && mine ? <>
        {template!.active ? null : <Badge tone="warning" text="Archived" />}
        <Button variant="secondary" small title={template!.active ? 'Archive' : 'Restore'} onPress={toggleArchived} />
        {confirmDelete ? <>
          <Text style={{ color: colors.dangerInk, fontSize: 13 }}>Delete this template and all its versions? This cannot be undone.</Text>
          <Button variant="danger" small title="Delete" loading={action.busy} onPress={deleteTemplate} />
          <Button variant="ghost" small title="Cancel" onPress={() => setConfirmDelete(false)} />
        </> : <Button variant="danger" small title="Delete…" onPress={() => setConfirmDelete(true)} />}
      </> : undefined}>
      <ErrorBox message={action.error} />
      <Notice message={action.notice} />
      {!mine ? (
        <Muted>Created by {template!.createdByName ?? 'another user'}. You can view, preview and use it in practice sets; only its creator or an administrator can change it.</Muted>
      ) : null}
      {template?.notes ? (
        <Card style={{ backgroundColor: colors.paper2, gap: space(1) }}>
          {template.notes.split('\n').map((line, i) => <Text key={i} style={{ color: colors.ink2, fontSize: 13.5 }}>{line}</Text>)}
        </Card>
      ) : null}

      {!isNew ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' }}>
          {template!.versions.map((v) => (
            <Pressable key={v.id} onPress={() => { setVersionId(v.id); setForm(fromVersion(template!, v)); setPreview(null); }}
              style={{ paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: 8, borderWidth: 1, borderColor: v.id === versionId ? colors.primary : colors.border, backgroundColor: v.id === versionId ? colors.primarySoft : '#fff', flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>v{v.versionNo}</Text>
              <Badge tone={statusTone(v.status)} text={v.status} />
            </Pressable>
          ))}
          {mine ? <Button small variant="ghost" title="+ New version" onPress={newVersion} /> : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4), alignItems: 'flex-start' }}>
        <Card style={{ flexGrow: 1, flexBasis: 480 }}>
          <H2>Template</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
            <Field label="Label" value={form.label} onChangeText={(label) => set({ label })} style={{ flexBasis: 220 }} />
            <Field label="Topic (skill code)" value={form.topicCode} onChangeText={(topicCode) => set({ topicCode })} autoCapitalize="none" placeholder="lcm" style={{ flexBasis: 160 }} />
          </View>
          {!editable ? <Muted style={{ marginBottom: space(3) }}>This version is {version?.status}; its content is read-only. Create a new version to change it.</Muted> : null}
          <Field label="Question template (LaTeX)" multiline value={form.promptTemplate} editable={editable} onChangeText={(promptTemplate) => set({ promptTemplate })}
            hint="{a} inserts a value · {a:2–20} declares an integer range · {{a}} keeps LaTeX braces, e.g. \frac{{a}}{{b}} · {+-} gives + or − (s = ±1)" />
          <Select label="Answer mode" value={form.answerMode} onChange={(answerMode) => editable && set({ answerMode })}
            options={[{ value: 'numeric', label: 'Numeric' }, { value: 'multiple_choice', label: 'Multiple choice' }, { value: 'display_only', label: 'Display only' }]} />
          {form.answerMode !== 'display_only' ? (
            <Field label="Answer formula" value={form.answerFormula} editable={editable} onChangeText={(answerFormula) => set({ answerFormula })}
              autoCapitalize="none" hint="Uses variable names, not LaTeX: + − * / ^ ( ), gcd, lcm, abs, min, max, round, floor, ceil, sqrt, pow, mean, median, nCr, nPr" />
          ) : <Muted style={{ marginBottom: space(3) }}>Display-only templates are for lesson examples and cannot be used in graded sets.</Muted>}
          {form.answerMode !== 'display_only' ? (
            <View style={{ marginBottom: space(3), padding: space(3), borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper2 }}>
              <Text style={{ fontWeight: '600', color: colors.ink, marginBottom: 2 }}>Wrong answers (optional)</Text>
              <Muted style={{ marginBottom: space(2) }}>
                Used whenever this template is asked as multiple choice (its own mode, or a practice-set row set to Multiple choice). Students see the correct answer plus 3 wrong ones. Write each wrong answer as a formula of the variables (e.g. a + b, gcd(a, b), max(a, b)) or a plain number (e.g. 13). Empty boxes, or answers equal to the correct one, are filled automatically. With more than 3, each question picks 3 at random.
              </Muted>
              {form.wrongAnswers.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(1.5) }}>
                  <Text style={{ width: 22, color: colors.danger, fontWeight: '700' }}>✗</Text>
                  <TextInput value={w} editable={editable} autoCapitalize="none" aria-label={`Wrong answer ${i + 1}`}
                    placeholder={['e.g. a + b', 'e.g. gcd(a, b)', 'e.g. max(a, b)'][i] ?? 'another wrong answer'} placeholderTextColor={colors.ink4}
                    onChangeText={(t) => set({ wrongAnswers: form.wrongAnswers.map((x, j) => (j === i ? t : x)) })}
                    style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 14, color: colors.ink, backgroundColor: colors.paper, fontFamily: 'JetBrains Mono, monospace' }} />
                  {editable && form.wrongAnswers.length > 3 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove wrong answer ${i + 1}`} onPress={() => set({ wrongAnswers: form.wrongAnswers.filter((_, j) => j !== i) })}>
                      <Text style={{ color: colors.danger, fontWeight: '600', paddingHorizontal: 6 }}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {editable && form.wrongAnswers.length < MAX_WRONG ? (
                <Pressable accessibilityRole="button" onPress={() => set({ wrongAnswers: [...form.wrongAnswers, ''] })}>
                  <Text style={{ color: colors.link, fontSize: 13, fontWeight: '600', marginTop: space(1) }}>+ Add another wrong answer</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
            <Field label="Default min" value={form.defaultMin} editable={editable} onChangeText={(defaultMin) => set({ defaultMin })} style={{ flexBasis: 100 }} />
            <Field label="Default max" value={form.defaultMax} editable={editable} onChangeText={(defaultMax) => set({ defaultMax })} style={{ flexBasis: 100 }} />
          </View>
          <Field label="Variables (JSON)" multiline value={form.variables} editable={editable} onChangeText={(variables) => set({ variables })}
            hint='Optional ranges, e.g. {"a": {"type": "decimal", "min": 1.1, "max": 9.9, "scale": 1}}. Derived: {"b": {"type": "derived", "formula": "a+k"}}' />
          <Field label="Constraints (one per line)" multiline value={form.constraints} editable={editable} onChangeText={(constraints) => set({ constraints })}
            hint="e.g. a != b, b != 0" />
          <Field label="Figure (JSON, optional)" multiline value={form.figure} editable={editable} onChangeText={(figure) => set({ figure })}
            placeholder='{"shape": "rectangle", "labels": {"width": "{l} cm", "height": "{w} cm"}, "size": {"width": "l", "height": "w"}}'
            hint={'A labelled shape drawn with each question\'s values. Shapes and label names: rectangle (width, height, top, left), '
              + 'square (side), triangle (base, left, right, height), right_triangle (base, height, hypotenuse), '
              + 'circle (radius or diameter), trapezoid (top, bottom, left, right, height), ellipse (a, b: semi-axes); '
              + 'every shape also takes "inside". '
              + 'Optional "size" sets the drawn proportions from formulas, e.g. {"width": "l", "height": "w"}.'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
            <Field label="Grading tolerance (%)" value={form.relativeTolerancePercent} editable={editable} onChangeText={(relativeTolerancePercent) => set({ relativeTolerancePercent })} style={{ flexBasis: 140 }} />
            <Field label="Absolute tolerance" value={form.absoluteTolerance} editable={editable} onChangeText={(absoluteTolerance) => set({ absoluteTolerance })} style={{ flexBasis: 140 }} />
            <Field label="Decimal places" value={form.decimalPlaces} editable={editable} onChangeText={(decimalPlaces) => set({ decimalPlaces })} style={{ flexBasis: 120 }} />
          </View>
          <Checkbox label="Accept rounded decimal" value={form.acceptRoundedDecimal} onChange={(acceptRoundedDecimal) => editable && set({ acceptRoundedDecimal })} />
          {isNew ? <Checkbox label="Active (can be used for new attempts)" value={form.active} onChange={(active) => set({ active })} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            <Button title="Preview" variant="secondary" onPress={runPreview} loading={previewAction.busy} />
            {mine ? <Button title={isNew ? 'Create draft' : 'Save'} onPress={save} loading={action.busy} disabled={!form.label || !form.topicCode} /> : null}
            {!isNew && editable ? <Button title="Validate & publish" variant="secondary" onPress={publish} loading={action.busy} /> : null}
          </View>
        </Card>

        <View style={{ flexGrow: 1, flexBasis: 380, gap: space(4) }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H2>Place</H2>
            <Pressable onPress={() => navigate('/admin/tree')} accessibilityRole="link">
              {({ hovered }: any) => (
                <Text style={{ fontSize: 12.5, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>Content tree ›</Text>
              )}
            </Pressable>
          </View>
          <Muted style={{ marginBottom: space(2), fontSize: 12.5 }}>A subject, course, chapter or lesson.</Muted>
          {mine ? <PlacePicker tree={tree} value={form.place} onChange={(place) => set({ place })} noneLabel="Nowhere yet" maxHeight={300} /> : null}
          <Muted style={{ marginTop: space(2), fontSize: 12.5 }}>
            {form.place ? places.label(form.place) : 'Nowhere yet'}{mine ? ` · ${isNew ? 'saved when you create the draft' : 'press Save to apply'}` : ''}
          </Muted>
        </Card>

        <Card>
          <H2>Preview</H2>
          <ErrorBox message={previewAction.error} />
          {!preview ? <Muted>Press Preview to generate sample questions and exact answers with the math engine.</Muted> : (
            <View style={{ gap: space(3) }}>
              {preview.errors?.length ? <ErrorBox message={preview.errors.map((e) => e.message).join('\n')} /> : null}
              {preview.warnings.map((w, i) => (
                <View key={i} style={{ backgroundColor: colors.warningSoft, borderRadius: 8, padding: space(3) }}>
                  <Text style={{ color: colors.warning }}>{w}</Text>
                </View>
              ))}
              {preview.answerFormulaLatex ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <Muted>Answer =</Muted><MathInline tex={preview.answerFormulaLatex} />
                </View>
              ) : null}
              {preview.items.map((it, i) => (
                <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: space(3), gap: space(1.5) }}>
                  <MathText source={it.promptLatex} size={16} />
                  <Figure svg={it.figureSvg} maxWidth={360} />
                  <Muted style={{ fontSize: 12 }}>{Object.entries(it.variables).map(([k, v]) => `${k} = ${v}`).join(', ')}</Muted>
                  {it.answerDisplay != null ? (
                    <Text style={{ color: colors.success, fontWeight: '600' }}>Answer: {it.answerDisplay}{it.roundedAnswer && it.roundedAnswer !== it.answerDisplay ? `  (rounded ${it.roundedAnswer})` : ''}</Text>
                  ) : null}
                  {it.options.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                      {it.options.map((o, j) => (
                        <View key={j} style={{ paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: 6, backgroundColor: o.isCorrect ? colors.successSoft : colors.bg }}>
                          <MathInline tex={o.latex} size={14} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>
        </View>
      </View>
    </Screen>
  );
}
