import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, errorMessage } from '../api';
import { colors, fonts, radius, space } from '../theme';
import { MathInline, MathText } from './MathText';
import { Button, ErrorBox } from './ui';
import { Figure } from './web';

type Question = { token: string; label: string; promptLatex: string; figureSvg?: string | null; answerMode: string; options: string[] };
type Result = { correct: boolean; correctAnswer: string; correctOptionIndex: number };

/**
 * "Practice this section" shown inline on the lesson page (no navigation away), collapsible.
 * Runs `count` fresh problems from the section's math template with a hint and instant feedback.
 * Ungraded: nothing is recorded as an assessment attempt.
 */
export default function SectionPractice({ sectionId, count, hint, label }: {
  sectionId: string; count: number; hint?: string | null; label?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [started, setStarted] = useState(false);
  const [q, setQ] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const number = Math.min(results.length + (result ? 0 : 1), count);

  // index = problem number, so mixed practice follows the admin's row order (e.g. 2 x LCM then 1 x GCF).
  const load = async (index: number) => {
    setBusy(true); setError(null); setResult(null); setAnswer(''); setPicked(null); setShowHint(false);
    try { setQ(await api.post<Question>(`/sections/${sectionId}/practice?index=${index}`)); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const start = () => { setStarted(true); setFinished(false); setResults([]); load(0); };

  const check = async () => {
    if (!q) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<Result>(`/sections/${sectionId}/practice/check`,
        q.options.length ? { token: q.token, optionIndex: picked } : { token: q.token, answer });
      setResult(r);
      setResults((x) => [...x, r.correct]);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const canCheck = !!q && !result && (q.options.length ? picked != null : answer.trim() !== '');
  const correct = results.filter(Boolean).length;

  return (
    <View style={styles.box}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" aria-expanded={open} style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Practice this section</Text>
          <Text style={styles.sub}>
            {started
              ? finished ? `Done — ${correct} of ${count} correct.` : `Problem ${number} of ${count}${(q?.label ?? label) ? ` · ${q?.label ?? label}` : ''}`
              : `${count} problem${count === 1 ? '' : 's'} with hints and instant feedback.`}
          </Text>
        </View>
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>{open ? 'Hide ▲' : 'Show ▼'}</Text>
        </View>
      </Pressable>

      {open ? (
        <View style={{ gap: space(3), marginTop: space(3) }}>
          {!started ? (
            <View style={{ flexDirection: 'row' }}><Button title="Start practice →" onPress={start} /></View>
          ) : finished ? (
            <View style={{ gap: space(3) }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {results.map((ok, i) => <View key={i} style={[styles.pip, { backgroundColor: ok ? colors.success : colors.danger }]} />)}
              </View>
              <Text style={{ color: colors.ink2 }}>
                {correct === count ? 'Great work — every answer was right.' : 'Review the explanation above, then try a fresh set.'}
              </Text>
              <View style={{ flexDirection: 'row' }}><Button variant="secondary" title="Practice again" onPress={start} /></View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {Array.from({ length: count }).map((_, i) => (
                  <View key={i} style={[styles.pip, i < results.length && { backgroundColor: results[i] ? colors.success : colors.danger },
                    i === results.length && !result && { backgroundColor: colors.ink }]} />
                ))}
              </View>
              <View style={{ minHeight: 40 }}>
                {q ? <><MathText source={q.promptLatex} size={18} /><Figure svg={q.figureSvg} /></> : busy ? <Text style={{ color: colors.ink3 }}>Loading problem…</Text> : null}
              </View>

              {q && q.options.length ? (
                <View style={{ gap: 8 }}>
                  {q.options.map((o, i) => {
                    const state = result ? (i === result.correctOptionIndex ? 'correct' : i === picked ? 'wrong' : '') : i === picked ? 'picked' : '';
                    return (
                      <Pressable key={i} disabled={!!result} onPress={() => setPicked(i)} accessibilityRole="radio" aria-checked={i === picked}
                        style={({ hovered }: any) => [styles.choice, hovered && !result && { borderColor: colors.ink3 },
                          state === 'picked' && { borderColor: colors.ink, backgroundColor: colors.paper2 },
                          state === 'correct' && { borderColor: colors.success, backgroundColor: colors.successSoft },
                          state === 'wrong' && { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
                        <Text style={styles.choiceKey}>{String.fromCharCode(97 + i)}</Text>
                        <MathInline tex={o} size={15} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : q ? (
                <TextInput value={answer} onChangeText={setAnswer} editable={!result} placeholder="Your answer (e.g. 36, 3.6 or 18/5)"
                  placeholderTextColor={colors.ink4} inputMode="decimal" aria-label="Your answer"
                  onSubmitEditing={() => canCheck && check()} style={styles.input} />
              ) : null}

              {hint && q && !result ? (
                showHint
                  ? <Text style={styles.hint}>Hint: {hint}</Text>
                  : <Pressable onPress={() => setShowHint(true)}><Text style={styles.hintLink}>Show a hint</Text></Pressable>
              ) : null}

              <ErrorBox message={error} />
              {result ? (
                <View style={[styles.feedback, { backgroundColor: result.correct ? colors.successSoft : colors.dangerSoft }]}>
                  <Text style={{ color: result.correct ? colors.successInk : colors.dangerInk }}>
                    {result.correct ? '✓ Correct!' : `Not quite — the answer is ${result.correctAnswer}.`}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: space(2) }}>
                {result
                  ? <Button title={results.length >= count ? 'See results' : 'Next problem →'} onPress={() => (results.length >= count ? setFinished(true) : load(results.length))} loading={busy} />
                  : <Button title="Check answer" onPress={check} disabled={!canCheck} loading={busy} />}
                {!q && !busy && !result ? <Button variant="secondary" title="Try again" onPress={() => load(results.length)} /> : null}
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.lavSoft, borderLeftWidth: 3, borderLeftColor: colors.lavLine, borderRadius: radius.sm, padding: space(5), marginTop: space(4) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 15, color: colors.ink2, marginTop: space(2) },
  toggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.lavLine },
  toggleText: { fontSize: 12.5, color: colors.link, fontWeight: '600' },
  pip: { width: 22, height: 5, borderRadius: 99, backgroundColor: colors.paper3 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper },
  choiceKey: { fontFamily: fonts.mono, color: colors.ink4, width: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: fonts.mono, color: colors.ink, backgroundColor: colors.paper, maxWidth: 360 },
  hint: { color: colors.ink2, fontStyle: 'italic', backgroundColor: colors.paper, borderRadius: 6, padding: space(2.5), borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  hintLink: { color: colors.link, textDecorationLine: 'underline', fontSize: 13.5 },
  feedback: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md },
});
