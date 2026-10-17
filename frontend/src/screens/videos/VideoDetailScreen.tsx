import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { api, errorMessage } from '../../api';
import { useAuth } from '../../auth';
import { MathInline, MathParagraphs, MathText } from '../../components/MathText';
import { Button, Crumbs, ErrorBox, Kicker, Loading, Muted, Screen } from '../../components/ui';
import { Figure, Icon, VideoPlayer, useDocumentTitle } from '../../components/web';
import { useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, radius, shadow, space } from '../../theme';
import { Video, VideoCard } from './VideosScreen';

type Detail = Video & { parentSubjectName: string | null; subjectPath: { id: string; name: string }[]; related: Video[] };

/** Lesson page: player + Notes/Resources tabs, with a sticky practice sidebar (GED-Tutor "video-detail"). */
export default function VideoDetailScreen({ id }: { id: string }) {
  const { data: v, error, loading } = useApi<Detail>(`/videos/${id}`);
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [tab, setTab] = useState<'notes' | 'resources'>('notes');
  useDocumentTitle(v?.title ?? 'Lesson');

  if (loading) return <Loading />;
  if (!v) return <Screen title="Lesson"><ErrorBox message={error} /></Screen>;


  return (
    <Screen>
      <Crumbs items={[
        { label: 'videos', onPress: () => navigate('/videos') },
        ...(v.subjectPath ?? []).map((s) => ({ label: s.name.toLowerCase(), onPress: () => navigate(`/videos?subject=${s.id}`) })),
        { label: v.title },
      ]} />
      <View style={[{ gap: 40 }, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ marginBottom: 20 }}>
            <Kicker>{[v.subjectName, v.category].filter(Boolean).join(' · ')}</Kicker>
            <Text style={styles.h1} role="heading" aria-level={1}>{v.title}</Text>
          </View>
          <VideoPlayer embedUrl={v.embedUrl} sourceUrl={v.videoUrl} title={v.title} />

          <View style={styles.tabs} role="tablist">
            {(['notes', 'resources'] as const).map((t) => (
              <Pressable key={t} role="tab" aria-selected={tab === t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
                <Text style={[styles.tabText, tab === t && { color: colors.ink }]}>{t === 'notes' ? 'Notes' : 'Resources'}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'notes' ? (
            v.description ? <MathParagraphs source={v.description} /> : <Muted>No notes for this lesson yet.</Muted>
          ) : (
            <View>
              <ResourceRow icon="practice" label="Practice sets assigned to you" tag="practice" onPress={() => navigate('/practice')} />
              <ResourceRow icon="play" label={`More videos in ${v.subjectName}`} tag="videos" onPress={() => navigate(`/videos?subject=${v.subjectId}`)} />
              <ResourceRow icon="arrow" label="Open on the video site" tag={v.provider} href={v.videoUrl} />
            </View>
          )}

          {v.related.length ? (
            <View style={{ marginTop: space(10), gap: space(3) }}>
              <Text style={styles.h3}>More in {v.subjectName}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {v.related.slice(0, 3).map((r) => <VideoCard key={r.id} video={r} />)}
              </View>
            </View>
          ) : null}
        </View>

        <View style={[{ gap: 16 }, wide && { width: 360, position: 'sticky' as any, top: 80 }]}>
          <PracticePanel video={v} />
        </View>
      </View>
    </Screen>
  );
}

function ResourceRow({ icon, label, tag, onPress, href }: { icon: any; label: string; tag: string; onPress?: () => void; href?: string }) {
  return (
    <Pressable onPress={onPress ?? (() => href && window.open(href, '_blank', 'noopener,noreferrer'))}
      style={({ hovered }: any) => [styles.resRow, hovered && { backgroundColor: colors.paper2 }]}>
      <Icon name={icon} size={16} color={colors.ink2} />
      <Text style={{ color: colors.ink2, fontSize: 14.5, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.ink4, fontSize: 12, fontFamily: fonts.mono }}>{tag}</Text>
    </Pressable>
  );
}

type Question = { token: string; label: string; promptLatex: string; figureSvg?: string | null; answerMode: string; options: string[] };
type Result = { correct: boolean; correctAnswer: string; correctOptionIndex: number };

/** One question at a time from the linked math template; answers are checked on the server. */
function PracticePanel({ video }: { video: Detail }) {
  const { user } = useAuth();
  const [q, setQ] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true); setError(null); setResult(null); setAnswer(''); setPicked(null);
    try { setQ(await api.post<Question>(`/videos/${video.id}/practice`)); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (user && video.mathTemplateId) load();
  }, [user?.id, video.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = async () => {
    if (!q) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<Result>(`/videos/${video.id}/practice/check`,
        q.options.length ? { token: q.token, optionIndex: picked } : { token: q.token, answer });
      setResult(r);
      setHistory((h) => [...h, r.correct].slice(-4));
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const pips = [0, 1, 2, 3].map((i) => (i < history.length ? (history[i] ? 'on' : 'miss') : i === history.length ? 'now' : 'off'));
  const canCheck = !!q && !result && (q.options.length ? picked != null : answer.trim() !== '');

  return (
    <View style={styles.quiz}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Kicker style={{ marginBottom: 0 }}>{video.mathTemplateLabel ?? 'Practice'}</Kicker>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {pips.map((p, i) => (
            <View key={i} style={[styles.pip, p === 'on' && { backgroundColor: colors.accent }, p === 'miss' && { backgroundColor: colors.danger }, p === 'now' && { backgroundColor: colors.ink }]} />
          ))}
        </View>
      </View>

      {!video.mathTemplateId ? (
        <>
          <Text style={styles.quizQ}>Ready to try some problems?</Text>
          <Muted>This lesson has no linked practice yet. Your assigned practice sets are on the Practice page.</Muted>
          {user ? <Button title="Go to practice" onPress={() => navigate('/practice')} /> : null}
        </>
      ) : !user ? (
        <>
          <Text style={styles.quizQ}>Practise this skill with fresh problems.</Text>
          <Muted>Log in or create a free account to try problems for this lesson.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Start free" onPress={() => navigate('/register')} />
            <Button variant="secondary" title="Log in" onPress={() => navigate('/login')} />
          </View>
        </>
      ) : (
        <>
          <View style={{ minHeight: 48 }}>
            {q ? <><MathText source={q.promptLatex} size={19} /><Figure svg={q.figureSvg} /></> : busy ? <Muted>Loading problem…</Muted> : null}
          </View>
          {q && q.options.length ? (
            <View style={{ gap: 8 }}>
              {q.options.map((o, i) => {
                const state = result ? (i === result.correctOptionIndex ? 'correct' : i === picked ? 'wrong' : '') : i === picked ? 'picked' : '';
                return (
                  <Pressable key={i} disabled={!!result} onPress={() => setPicked(i)}
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
            <View>
              <TextInput value={answer} onChangeText={setAnswer} editable={!result} placeholder="Type your answer…"
                placeholderTextColor={colors.ink4} inputMode="decimal" aria-label="Your answer"
                onSubmitEditing={() => canCheck && check()} style={styles.answer} />
              <Text style={{ color: colors.ink3, fontSize: 12, marginTop: 5 }}>Integers, decimals or fractions like 18/5.</Text>
            </View>
          ) : null}

          <ErrorBox message={error} />
          {result ? (
            <View style={[styles.feedback, { backgroundColor: result.correct ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: result.correct ? colors.successInk : colors.dangerInk, fontSize: 14, lineHeight: 21 }}>
                {result.correct ? '✓ Correct!' : `Not quite. The answer is ${result.correctAnswer}.`}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {result || !q
              ? <View style={{ flex: 1 }}><Button title="Next problem →" onPress={load} loading={busy} /></View>
              : <View style={{ flex: 1 }}><Button title="Check answer" onPress={check} disabled={!canCheck} loading={busy} /></View>}
          </View>
          {history.length >= 2 ? (
            <Pressable onPress={() => navigate('/practice')} style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.accentInk, fontSize: 13 }}>Go to your practice sets →</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 46, color: colors.ink, letterSpacing: -0.8 },
  h3: { fontFamily: fonts.serif, fontSize: 21, color: colors.ink },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 26, marginBottom: 18 },
  tab: { paddingVertical: 11, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: colors.accent },
  tabText: { fontSize: 13.5, fontWeight: '500', color: colors.ink3 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.line, borderStyle: 'dashed' },
  quiz: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 20, gap: 16, ...shadow.md },
  pip: { width: 18, height: 4, borderRadius: 99, backgroundColor: colors.paper3 },
  quizQ: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25, color: colors.ink },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper },
  choiceKey: { fontFamily: fonts.mono, color: colors.ink4, width: 14 },
  answer: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: fonts.mono, color: colors.ink, backgroundColor: colors.paper },
  feedback: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md },
});
