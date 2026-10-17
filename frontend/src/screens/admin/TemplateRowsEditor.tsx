import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FolderRow, PlaceTreeRows } from '../../components/SubjectTree';
import { Card, H2, Muted } from '../../components/ui';
import { indexPlaces, type ContentTree, type Placed } from '../../places';
import { colors, space } from '../../theme';

/** id is set for rows already saved on the set (so student attempts that used them stay linked). */
export type AnswerMode = 'numeric' | 'multiple_choice';
export type RuleRow = { id?: string; answerMode?: AnswerMode | null; templateVersionId: string; questionCount: string; pointsPerQuestion: string; variableOverrides: string };

interface PublishedVersion extends Placed {
  versionId: string; versionNo: number; templateId: string; label: string; topicCode: string;
  subjectName: string | null; promptTemplate: string; answerMode: string;
}

/** The course's subject (or the course): only templates placed under it are offered unless "Show all" is picked. */
export type TemplateScope = { rootKey: string; label: string } | null;

const NONE = '__none__';

const MAX_RESULTS = 40;

/**
 * Practice-set template rows as a table (questions / points edited inline, totals at the bottom), plus a
 * searchable finder to add templates with a question count.
 */
export default function TemplateRowsEditor({ rules, onChange, versions, draft, missingLabels, scope = null, courseTitle, tree }: {
  rules: RuleRow[]; onChange: (rules: RuleRow[]) => void; versions: PublishedVersion[]; draft: boolean;
  scope?: TemplateScope; courseTitle?: string; tree?: ContentTree | null;
  /** Labels for rows whose version is no longer in the published list. */
  missingLabels: Record<string, string>;
}) {
  const [openRanges, setOpenRanges] = useState<number | null>(null);
  const byVersion = useMemo(() => new Map(versions.map((v) => [v.versionId, v])), [versions]);

  const update = (i: number, patch: Partial<RuleRow>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const next = [...rules];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r);
    onChange(next);
  };
  const totalQ = rules.reduce((s, r) => s + (Number(r.questionCount) || 0), 0);
  const totalP = rules.reduce((s, r) => s + (Number(r.questionCount) || 0) * (Number(r.pointsPerQuestion) || 0), 0);

  return (
    <Card style={{ gap: space(3) }}>
      <H2>Template rows</H2>
      <Muted>Each row generates distinct questions from one published template version, in this order. Add the same template twice to mix types, e.g. 5 fill in + 3 multiple choice; questions never repeat within an attempt.</Muted>

      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.thText, { width: 34 }]}>#</Text>
          <Text style={[styles.thText, { flex: 3 }]}>Template</Text>
          <Text style={[styles.thText, { flex: 1.6 }]}>Subject</Text>
          <Text style={[styles.thText, { width: 176 }]}>Type</Text>
          <Text style={[styles.thText, { width: 92 }]}>Questions</Text>
          <Text style={[styles.thText, { width: 92 }]}>Pts each</Text>
          <Text style={[styles.thText, { width: 64, textAlign: 'right' }]}>Points</Text>
          <Text style={[styles.thText, { width: draft ? 150 : 70 }]} />
        </View>
        {rules.length === 0 ? <Text style={{ padding: space(4), color: colors.ink3 }}>No template rows yet — find templates below and add them.</Text> : null}
        {rules.map((r, i) => {
          const v = byVersion.get(r.templateVersionId);
          const points = (Number(r.questionCount) || 0) * (Number(r.pointsPerQuestion) || 0);
          const hasRanges = r.variableOverrides.trim() !== '' && r.variableOverrides.trim() !== '{}';
          return (
            <View key={`${r.templateVersionId}-${i}`}>
              <View style={styles.tr}>
                <Text style={[styles.cell, { width: 34, color: colors.ink3 }]}>{i + 1}</Text>
                <View style={{ flex: 3, paddingRight: space(2) }}>
                  <Text style={[styles.cell, { fontWeight: '600' }]} numberOfLines={1}>
                    {v ? `${v.label}` : missingLabels[r.templateVersionId] ?? 'Unknown template'}
                  </Text>
                  <Text style={styles.sub}>{v ? `v${v.versionNo} · ${v.topicCode}` : 'not in the published list'}</Text>
                </View>
                <Text style={[styles.cell, { flex: 1.6, color: colors.ink2 }]} numberOfLines={2}>{v?.subjectName ?? '—'}</Text>
                <ModeToggle value={r.answerMode ?? (v?.answerMode === 'multiple_choice' ? 'multiple_choice' : 'numeric')} editable={draft}
                  onChange={(answerMode) => update(i, { answerMode })} />
                <NumberBox value={r.questionCount} editable={draft} onChange={(questionCount) => update(i, { questionCount })} label={`Questions for row ${i + 1}`} />
                <NumberBox value={r.pointsPerQuestion} editable={draft} onChange={(pointsPerQuestion) => update(i, { pointsPerQuestion })} label={`Points per question for row ${i + 1}`} />
                <Text style={[styles.cell, { width: 64, textAlign: 'right', fontWeight: '600' }]}>{points}</Text>
                <View style={{ width: draft ? 150 : 70, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 }}>
                  <IconButton label={hasRanges ? 'Ranges ●' : 'Ranges'} onPress={() => setOpenRanges(openRanges === i ? null : i)} />
                  {draft ? (
                    <>
                      <IconButton label="↑" disabled={i === 0} onPress={() => move(i, -1)} />
                      <IconButton label="↓" disabled={i === rules.length - 1} onPress={() => move(i, 1)} />
                      <IconButton label="✕" danger onPress={() => onChange(rules.filter((_, j) => j !== i))} />
                    </>
                  ) : null}
                </View>
              </View>
              {openRanges === i ? (
                <View style={[styles.tr, { backgroundColor: colors.paper2, flexDirection: 'column', alignItems: 'stretch', gap: 4 }]}>
                  <Text style={styles.sub}>Variable range overrides for this row (JSON, optional) — e.g. {'{"a": {"min": 2, "max": 12}}'}</Text>
                  <TextInput value={r.variableOverrides} editable={draft} onChangeText={(variableOverrides) => update(i, { variableOverrides })}
                    autoCapitalize="none" aria-label="Variable overrides" style={[styles.input, { fontFamily: 'ui-monospace, Menlo, monospace' }]} />
                </View>
              ) : null}
            </View>
          );
        })}
        {rules.length ? (
          <View style={[styles.tr, { backgroundColor: colors.paper2, borderBottomWidth: 0 }]}>
            <Text style={[styles.cell, { width: 34 }]} />
            <Text style={[styles.cell, { flex: 3, fontWeight: '700' }]}>Total</Text>
            <Text style={[styles.cell, { flex: 1.6 }]} />
            <Text style={[styles.cell, { width: 176, color: colors.ink3, fontSize: 12 }]}>{typeSummary(rules, byVersion)}</Text>
            <Text style={[styles.cell, { width: 92, fontWeight: '700', paddingLeft: 10 }]}>{totalQ}</Text>
            <Text style={[styles.cell, { width: 92 }]} />
            <Text style={[styles.cell, { width: 64, textAlign: 'right', fontWeight: '700' }]}>{totalP}</Text>
            <Text style={[styles.cell, { width: draft ? 150 : 70 }]} />
          </View>
        ) : null}
      </View>

      {draft ? <TemplateFinder versions={versions} rules={rules} scope={scope} courseTitle={courseTitle} tree={tree}
        onAdd={(row) => onChange([...rules, row])} /> : null}
    </Card>
  );
}

/**
 * Search published templates by name, topic or subject and add them with a question count; the subject folder tree
 * beside the list narrows it to one folder. With a scope (the course's subject), only templates in that subject
 * folder are listed until "Show all templates" is picked.
 */
function TemplateFinder({ versions, rules, onAdd, scope, courseTitle, tree }: {
  versions: PublishedVersion[]; rules: RuleRow[]; onAdd: (r: RuleRow) => void; scope: TemplateScope; courseTitle?: string;
  tree?: ContentTree | null;
}) {
  const places = useMemo(() => indexPlaces(tree), [tree]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const scoped = !!scope && !showAll;

  // Latest published version of each template (in the course's subject unless showing all).
  const latest = useMemo(() => {
    const m = new Map<string, PublishedVersion>();
    versions.forEach((v) => { const cur = m.get(v.templateId); if (!cur || v.versionNo > cur.versionNo) m.set(v.templateId, v); });
    return [...m.values()]
      .filter((v) => !scoped || places.contains(scope!.rootKey, v))
      .sort((a, b) => (a.subjectName ?? '').localeCompare(b.subjectName ?? '') || a.label.localeCompare(b.label));
  }, [versions, scoped, scope, places]);
  useEffect(() => setSubject(''), [scoped]);
  // Tree: subjects › courses › chapters › lessons, starting at the scope when scoped; only nodes holding templates.
  const placed = (v: PublishedVersion) => !!v.placeType;
  const countFor = (key: string) => latest.filter((v) => places.contains(key, v)).length;
  const unassigned = latest.filter((v) => !placed(v)).length;
  const choose = (key: string) => {
    setSubject(key);
    if (key && key !== NONE) setOpen((o) => new Set([...o, ...places.path(key).map((n) => n.key)]));
  };
  const toggle = (key: string) => setOpen((o) => { const n = new Set(o); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const inSet = (versionId: string) => rules.filter((r) => r.templateVersionId === versionId).reduce((s, r) => s + (Number(r.questionCount) || 0), 0);

  const term = q.trim().toLowerCase();
  const inFolder = (v: PublishedVersion) => !subject || (subject === NONE ? !placed(v) : places.contains(subject, v));
  const matches = latest.filter((v) => inFolder(v)
    && (!term || v.label.toLowerCase().includes(term) || v.topicCode.includes(term) || (v.subjectName ?? '').toLowerCase().includes(term)));

  return (
    <View style={{ gap: space(2), marginTop: space(2) }}>
      <Text style={styles.finderTitle}>Add templates</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: colors.ink2 }}>
          {scope
            ? (scoped ? `Showing templates in ${scope.label}, for ${courseTitle ?? 'this course'}.` : 'Showing all templates.')
            : 'Showing all templates.'}
        </Text>
        {scope ? (
          <Pressable onPress={() => setShowAll(!showAll)} accessibilityRole="button">
            {({ hovered }: any) => (
              <Text style={{ fontSize: 13, color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>
                {scoped ? 'Show all templates' : `Only ${scope.label}`}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="Search templates by name, topic or subject…" placeholderTextColor={colors.ink4}
        aria-label="Search templates" autoCapitalize="none" style={styles.input} />
      <View style={styles.finderLayout}>
      <View style={[styles.table, { flex: 1, minWidth: 0, flexBasis: 520 }]}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.thText, { flex: 3 }]}>Template</Text>
          <Text style={[styles.thText, { flex: 2.2 }]}>Subject</Text>
          <Text style={[styles.thText, { width: 92 }]}>Questions</Text>
          <Text style={[styles.thText, { width: 140 }]} />
        </View>
        {matches.slice(0, MAX_RESULTS).map((v) => {
          const n = counts[v.versionId] ?? '5';
          const already = inSet(v.versionId);
          return (
            <View key={v.versionId} style={styles.tr}>
              <View style={{ flex: 3, paddingRight: space(2) }}>
                <Text style={[styles.cell, { fontWeight: '600' }]} numberOfLines={1}>{v.label}</Text>
                <Text style={styles.sub} numberOfLines={1}>{v.topicCode} · v{v.versionNo}</Text>
              </View>
              <Text style={[styles.cell, { flex: 2.2, color: colors.ink2 }]} numberOfLines={2}>{v.subjectName ?? '—'}</Text>
              <NumberBox value={n} editable onChange={(val) => setCounts({ ...counts, [v.versionId]: val })} label={`Questions of ${v.label}`} />
              <View style={{ width: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space(2) }}>
                {already ? <Text style={{ fontSize: 12, color: colors.success }}>in set: {already}</Text> : null}
                <Pressable disabled={!(Number(n) >= 1)} accessibilityRole="button"
                  onPress={() => onAdd({ templateVersionId: v.versionId, questionCount: String(Math.min(100, Math.max(1, Number(n) || 1))), pointsPerQuestion: '1', variableOverrides: '{}' })}
                  style={({ hovered }: any) => [styles.addBtn, hovered && { opacity: 0.85 }, !(Number(n) >= 1) && { opacity: 0.4 }]}>
                  <Text style={{ color: colors.paper, fontWeight: '600', fontSize: 13 }}>+ Add</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {matches.length === 0 ? (
          <Text style={{ padding: space(4), color: colors.ink3 }}>
            {scoped && !latest.length ? `No published templates in ${scope!.label} yet. Use “Show all templates”, or move templates there.`
              : 'No published templates match.'}
          </Text>
        ) : null}
        {matches.length > MAX_RESULTS ? (
          <Text style={{ padding: space(3), color: colors.ink3, fontSize: 13 }}>
            Showing {MAX_RESULTS} of {matches.length} — type more of the name or pick a folder to narrow the list.
          </Text>
        ) : null}
      </View>
      <View style={styles.treePanel} accessibilityRole="tree" aria-label="Filter templates by place">
        <Text style={styles.treeTitle}>Subjects &amp; courses</Text>
        <FolderRow depth={0} label={scoped ? `All in ${scope!.label}` : 'All templates'} count={latest.length} selected={!subject} onPress={() => choose('')} />
        <PlaceTreeRows places={places} rootKeys={scoped ? [scope!.rootKey] : undefined} selected={subject} onSelect={choose}
          open={open} onToggle={toggle} count={countFor} />
        {unassigned ? <FolderRow depth={0} label="No place" count={unassigned} selected={subject === NONE} onPress={() => choose(NONE)} /> : null}
      </View>
      </View>
    </View>
  );
}

const MODES: { value: AnswerMode; label: string }[] = [{ value: 'numeric', label: 'Fill in' }, { value: 'multiple_choice', label: 'Multiple choice' }];

/** Fill in the blank vs multiple choice for one row. */
function ModeToggle({ value, onChange, editable }: { value: AnswerMode; onChange: (m: AnswerMode) => void; editable: boolean }) {
  return (
    <View style={{ width: 176, paddingRight: space(2) }}>
      <View style={styles.toggle} accessibilityRole="radiogroup">
        {MODES.map((m) => {
          const on = m.value === value;
          return (
            <Pressable key={m.value} accessibilityRole="radio" aria-checked={on} disabled={!editable}
              onPress={() => onChange(m.value)} style={[styles.toggleBtn, on && styles.toggleOn]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? colors.paper : colors.ink2 }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function typeSummary(rules: RuleRow[], byVersion: Map<string, PublishedVersion>): string {
  let fill = 0;
  let choice = 0;
  for (const r of rules) {
    const n = Number(r.questionCount) || 0;
    const mode = r.answerMode ?? (byVersion.get(r.templateVersionId)?.answerMode === 'multiple_choice' ? 'multiple_choice' : 'numeric');
    if (mode === 'multiple_choice') choice += n; else fill += n;
  }
  return [fill ? `${fill} fill in` : '', choice ? `${choice} choice` : ''].filter(Boolean).join(' · ');
}

function NumberBox({ value, onChange, editable, label }: { value: string; onChange: (v: string) => void; editable: boolean; label: string }) {
  return (
    <View style={{ width: 92, paddingRight: space(2) }}>
      <TextInput value={value} editable={editable} onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))} inputMode="decimal"
        aria-label={label} style={[styles.input, { textAlign: 'center' }, !editable && { backgroundColor: colors.paper2, borderColor: 'transparent' }]} />
    </View>
  );
}

function IconButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ hovered }: any) => [styles.iconBtn, hovered && !disabled && { backgroundColor: danger ? colors.dangerSoft : colors.paper3 }, disabled && { opacity: 0.3 }]}>
      <Text style={{ fontSize: 12.5, color: danger ? colors.danger : colors.ink2, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 999, padding: 2, backgroundColor: colors.paper, alignSelf: 'flex-start' },
  toggleBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  toggleOn: { backgroundColor: colors.ink },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { backgroundColor: colors.paper2 },
  thText: { fontSize: 12, fontWeight: '600', color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  cell: { fontSize: 14, color: colors.ink },
  sub: { fontSize: 12, color: colors.ink3 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: colors.ink, backgroundColor: colors.paper },
  iconBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  addBtn: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  finderTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  // wrap-reverse puts the tree above the list on narrow screens; flex-end then aligns both to the top.
  finderLayout: { flexDirection: 'row', flexWrap: 'wrap-reverse', gap: space(3), alignItems: 'flex-end' },
  treePanel: { width: 250, flexGrow: 1, maxWidth: 300, gap: 2, padding: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    backgroundColor: colors.paper },
  treeTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.ink3, marginBottom: space(1) },
});
