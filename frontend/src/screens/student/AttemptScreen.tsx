import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { api, errorMessage } from '../../api';
import AttemptReview from '../../components/AttemptReview';
import { MathInline, MathText } from '../../components/MathText';
import { Badge, Button, Card, ErrorBox, Loading, Muted, Screen } from '../../components/ui';
import { Figure } from '../../components/web';
import { useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import type { Attempt, AttemptItem } from '../../types';
import { topicLabel } from './DashboardScreen';

type SaveState = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

export default function AttemptScreen({ id }: { id: string }) {
  const { data: attempt, setData, error, loading, reload } = useApi<Attempt>(`/attempts/${id}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastSaved = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!attempt) return;
    const init: Record<string, string> = {};
    attempt.items.forEach((i) => { init[i.id] = i.rawAnswer ?? ''; });
    lastSaved.current = { ...init };
    setAnswers(init);
  }, [attempt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = useCountdown(attempt);
  useEffect(() => {
    if (remaining === 0 && attempt?.status === 'in_progress') reload();
  }, [remaining, attempt?.status, reload]);

  if (loading && !attempt) return <Loading />;
  if (!attempt) return <Screen title="Practice"><ErrorBox message={error} /></Screen>;

  if (attempt.status !== 'in_progress') {
    return (
      <Screen title={attempt.setTitle} subtitle={`Attempt ${attempt.attemptNo} · ${attempt.status === 'expired' ? 'time expired' : 'submitted'}`}
        actions={<><Button variant="secondary" title="History" onPress={() => navigate('/history')} /><Button title="Practice sets" onPress={() => navigate('/practice')} /></>}>
        <AttemptReview attempt={attempt} />
      </Screen>
    );
  }

  const setSave = (itemId: string, s: SaveState) => setSaves((p) => ({ ...p, [itemId]: s }));

  const save = async (item: AttemptItem, body: { rawAnswer?: string; selectedOptionId?: string }) => {
    setSave(item.id, { state: 'saving' });
    try {
      await api.put(`/attempts/${attempt.id}/answers/${item.id}`, body);
      setSave(item.id, { state: 'saved' });
      return true;
    } catch (e: any) {
      setSave(item.id, { state: 'error', message: errorMessage(e) });
      if (e?.code === 'attempt_expired' || e?.code === 'attempt_finished') reload();
      return false;
    }
  };

  const saveNumeric = async (item: AttemptItem) => {
    const value = (answers[item.id] ?? '').trim();
    if (value === lastSaved.current[item.id]) return;
    if (await save(item, { rawAnswer: value })) lastSaved.current[item.id] = value;
  };

  const choose = async (item: AttemptItem, optionId: string) => {
    setData({ ...attempt, items: attempt.items.map((i) => (i.id === item.id ? { ...i, selectedOptionId: optionId } : i)) });
    await save(item, { selectedOptionId: optionId });
  };

  const answeredCount = attempt.items.filter((i) =>
    i.answerMode === 'numeric' ? (answers[i.id] ?? '').trim() !== '' : !!i.selectedOptionId).length;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // flush any numeric answers that were typed but not yet saved
      for (const it of attempt.items) if (it.answerMode === 'numeric') await saveNumeric(it);
      setData(await api.post<Attempt>(`/attempts/${attempt.id}/submit`));
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <Screen title={attempt.setTitle} subtitle={`Attempt ${attempt.attemptNo} · ${attempt.items.length} questions · ${Number(attempt.maxScore)} points`}
      actions={remaining != null ? <TimerBadge seconds={remaining} /> : undefined}>
      <Muted>Answers save automatically. Enter integers, decimals (3.6 or 3,6) or fractions (18/5).</Muted>
      {attempt.items.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(2), gap: space(2) }}>
            <Muted>Question {item.position} · {topicLabel(item.topicCode)} · {Number(item.points)} pt</Muted>
            <SaveIndicator s={saves[item.id]} />
          </View>
          <MathText source={item.promptLatex} size={19} />
          <Figure svg={item.figureSvg} />
          <View style={{ marginTop: space(4) }}>
            {item.answerMode === 'numeric' ? (
              <TextInput
                value={answers[item.id] ?? ''}
                onChangeText={(t) => setAnswers((p) => ({ ...p, [item.id]: t }))}
                onBlur={() => saveNumeric(item)}
                onSubmitEditing={() => saveNumeric(item)}
                placeholder="Your answer"
                aria-label={`Answer to question ${item.position}`}
                inputMode="decimal"
                style={{ borderWidth: 1, borderColor: saves[item.id]?.state === 'error' ? colors.danger : colors.border, borderRadius: 8, padding: space(3), fontSize: 18, maxWidth: 260, backgroundColor: '#fff', color: colors.text }}
              />
            ) : (
              <View style={{ gap: space(2) }} role="radiogroup">
                {item.options.map((o, idx) => {
                  const on = item.selectedOptionId === o.id;
                  return (
                    <Pressable key={o.id} role="radio" aria-checked={on} onPress={() => choose(item, o.id)}
                      style={({ hovered }: any) => [{ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: 8, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : hovered ? colors.bg : '#fff' }]}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.bg }}>
                        <Text style={{ color: on ? '#fff' : colors.muted, fontWeight: '700' }}>{String.fromCharCode(65 + idx)}</Text>
                      </View>
                      <MathInline tex={o.latex} size={17} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          {saves[item.id]?.state === 'error' ? <Text style={{ color: colors.danger, marginTop: space(2), fontSize: 13 }}>{saves[item.id].message}</Text> : null}
        </Card>
      ))}

      <Card style={{ gap: space(3) }}>
        <Text style={{ color: colors.text }}>{answeredCount} of {attempt.items.length} questions answered.</Text>
        <ErrorBox message={submitError} />
        {confirming ? (
          <View style={{ gap: space(3) }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              Submit now? {answeredCount < attempt.items.length ? `${attempt.items.length - answeredCount} unanswered question(s) will score zero. ` : ''}You cannot change answers afterwards.
            </Text>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <Button title="Yes, submit" onPress={submit} loading={submitting} />
              <Button variant="secondary" title="Keep working" onPress={() => setConfirming(false)} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}><Button title="Submit attempt" onPress={() => setConfirming(true)} /></View>
        )}
      </Card>
    </Screen>
  );
}

function useCountdown(attempt: Attempt | null): number | null {
  const offset = useMemo(() => (attempt ? new Date(attempt.serverTime).getTime() - Date.now() : 0), [attempt?.serverTime]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!attempt?.expiresAt || attempt.status !== 'in_progress') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt?.expiresAt, attempt?.status]);
  if (!attempt?.expiresAt) return null;
  return Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - (now + offset)) / 1000));
}

function TimerBadge({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return <Badge tone={seconds < 60 ? 'danger' : 'primary'} text={`⏱ ${m}:${s} left`} />;
}

function SaveIndicator({ s }: { s?: SaveState }) {
  if (!s || s.state === 'idle') return null;
  if (s.state === 'saving') return <Muted style={{ fontSize: 12 }}>Saving…</Muted>;
  if (s.state === 'saved') return <Text style={{ fontSize: 12, color: colors.success }}>✓ Saved</Text>;
  return <Text style={{ fontSize: 12, color: colors.danger }}>Not saved</Text>;
}
