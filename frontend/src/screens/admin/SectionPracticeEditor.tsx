import { createElement, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, space } from '../../theme';

export interface PracticeRow { mathTemplateId: string; label: string; subjectName: string | null; questionCount: string }

interface TemplateSummary { id: string; label: string; topicCode: string; subject: string | null; active: boolean; publishedVersion: number | null }

const MAX_RESULTS = 30;

/**
 * "Practice this section" rows as a table (like practice-set template rows) plus a template finder.
 * Problems are asked in row order, e.g. 2 x LCM then 1 x GCF.
 */
export default function SectionPracticeEditor({ rows, onChange, templates }: {
  rows: PracticeRow[]; onChange: (rows: PracticeRow[]) => void; templates: TemplateSummary[];
}) {
  const update = (i: number, patch: Partial<PracticeRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r);
    onChange(next);
  };
  const total = rows.reduce((s, r) => s + (Number(r.questionCount) || 0), 0);

  return (
    <View style={{ gap: space(2) }}>
      <Text style={styles.title}>Practice this section</Text>
      <Text style={styles.sub}>Students get these problems in order, with instant feedback. Leave empty for no practice.</Text>
      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.thText, { width: 30 }]}>#</Text>
          <Text style={[styles.thText, { flex: 3 }]}>Math template</Text>
          <Text style={[styles.thText, { flex: 2 }]}>Subject</Text>
          <Text style={[styles.thText, { width: 90 }]}>Problems</Text>
          <Text style={[styles.thText, { width: 96 }]} />
        </View>
        {rows.length === 0 ? <Text style={{ padding: space(3), color: colors.ink3 }}>No practice yet — add templates below.</Text> : null}
        {rows.map((r, i) => (
          <View key={`${r.mathTemplateId}-${i}`} style={styles.tr}>
            <Text style={[styles.cell, { width: 30, color: colors.ink3 }]}>{i + 1}</Text>
            <Text style={[styles.cell, { flex: 3, fontWeight: '600' }]} numberOfLines={1}>{r.label}</Text>
            <Text style={[styles.cell, { flex: 2, color: colors.ink2 }]} numberOfLines={1}>{r.subjectName ?? '—'}</Text>
            <NumberBox value={r.questionCount} onChange={(questionCount) => update(i, { questionCount })} label={`Problems from ${r.label}`} />
            <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 }}>
              <IconButton label="↑" disabled={i === 0} onPress={() => move(i, -1)} />
              <IconButton label="↓" disabled={i === rows.length - 1} onPress={() => move(i, 1)} />
              <IconButton label="✕" danger onPress={() => onChange(rows.filter((_, j) => j !== i))} />
            </View>
          </View>
        ))}
        {rows.length ? (
          <View style={[styles.tr, { backgroundColor: colors.paper2, borderBottomWidth: 0 }]}>
            <Text style={[styles.cell, { width: 30 }]} />
            <Text style={[styles.cell, { flex: 5, fontWeight: '700' }]}>Total problems</Text>
            <Text style={[styles.cell, { width: 90, fontWeight: '700', textAlign: 'center' }]}>{total}</Text>
            <Text style={{ width: 96 }} />
          </View>
        ) : null}
      </View>
      {total > 20 ? <Text style={{ color: colors.warning, fontSize: 13 }}>That's {total} problems — consider 20 or fewer per section.</Text> : null}
      <Finder templates={templates} rows={rows} onAdd={(row) => onChange([...rows, row])} />
    </View>
  );
}

function Finder({ templates, rows, onAdd }: { templates: TemplateSummary[]; rows: PracticeRow[]; onAdd: (r: PracticeRow) => void }) {
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  // Only templates that can generate questions: active with a published version.
  const usable = useMemo(() => templates.filter((t) => t.active && t.publishedVersion)
    .sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? '') || a.label.localeCompare(b.label)), [templates]);
  const subjects = useMemo(() => [...new Set(usable.map((t) => t.subject ?? 'No subject'))].sort(), [usable]);
  const term = q.trim().toLowerCase();
  const matches = usable.filter((t) => (!subject || (t.subject ?? 'No subject') === subject)
    && (!term || t.label.toLowerCase().includes(term) || t.topicCode.includes(term) || (t.subject ?? '').toLowerCase().includes(term)));
  const inRows = (id: string) => rows.filter((r) => r.mathTemplateId === id).reduce((s, r) => s + (Number(r.questionCount) || 0), 0);

  return (
    <View style={{ gap: space(2), marginTop: space(1) }}>
      <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap', alignItems: 'center' }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Find a math template by name, topic or subject…" placeholderTextColor={colors.ink4}
          aria-label="Find a math template" autoCapitalize="none" style={[styles.input, { flex: 1, minWidth: 220 }]} />
        {createElement('select', {
          value: subject, 'aria-label': 'Filter templates by subject', onChange: (e: any) => setSubject(e.target.value),
          style: { padding: '7px 10px', borderRadius: 6, border: `1px solid ${colors.line}`, background: colors.paper, color: colors.ink, fontSize: 14, maxWidth: 300 },
        }, [createElement('option', { key: '', value: '' }, `All subjects (${usable.length})`),
          ...subjects.map((s) => createElement('option', { key: s, value: s }, s))])}
      </View>
      {term || subject ? (
        <View style={styles.table}>
          {matches.slice(0, MAX_RESULTS).map((t) => {
            const n = counts[t.id] ?? '2';
            const used = inRows(t.id);
            return (
              <View key={t.id} style={styles.tr}>
                <View style={{ flex: 3, paddingRight: space(2) }}>
                  <Text style={[styles.cell, { fontWeight: '600' }]} numberOfLines={1}>{t.label}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{t.topicCode}</Text>
                </View>
                <Text style={[styles.cell, { flex: 2, color: colors.ink2 }]} numberOfLines={1}>{t.subject ?? '—'}</Text>
                <NumberBox value={n} onChange={(v) => setCounts({ ...counts, [t.id]: v })} label={`Problems from ${t.label}`} />
                <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space(1) }}>
                  {used ? <Text style={{ fontSize: 11.5, color: colors.success }}>×{used}</Text> : null}
                  <Pressable accessibilityRole="button" disabled={!(Number(n) >= 1)}
                    onPress={() => onAdd({ mathTemplateId: t.id, label: t.label, subjectName: t.subject, questionCount: String(Math.min(20, Math.max(1, Number(n) || 1))) })}
                    style={({ hovered }: any) => [styles.addBtn, hovered && { opacity: 0.85 }]}>
                    <Text style={{ color: colors.paper, fontWeight: '600', fontSize: 12.5 }}>+ Add</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {matches.length === 0 ? <Text style={{ padding: space(3), color: colors.ink3 }}>No published templates match.</Text> : null}
          {matches.length > MAX_RESULTS ? (
            <Text style={{ padding: space(3), color: colors.ink3, fontSize: 13 }}>Showing {MAX_RESULTS} of {matches.length} — keep typing to narrow it down.</Text>
          ) : null}
        </View>
      ) : <Text style={styles.sub}>Type a name (e.g. “fraction”) or choose a subject to see templates.</Text>}
    </View>
  );
}

function NumberBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <View style={{ width: 90, paddingRight: space(2) }}>
      <TextInput value={value} onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label={label}
        style={[styles.input, { textAlign: 'center', paddingVertical: 5 }]} />
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
  title: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.ink3 },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.paper },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { backgroundColor: colors.paper2 },
  thText: { fontSize: 11.5, fontWeight: '600', color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  cell: { fontSize: 13.5, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 14, color: colors.ink, backgroundColor: colors.paper },
  iconBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  addBtn: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
