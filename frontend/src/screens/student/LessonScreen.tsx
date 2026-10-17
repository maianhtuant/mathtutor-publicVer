import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { api } from '../../api';
import { useAuth } from '../../auth';
import { isStaff } from '../../types';
import { MathParagraphs, MathText } from '../../components/MathText';
import SectionPractice from '../../components/SectionPractice';
import { Button, ErrorBox, Footer, Loading, Screen, formatDuration } from '../../components/ui';
import { Icon, VideoPlayer } from '../../components/web';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, radius, space } from '../../theme';

interface OutlineLesson { id: string; title: string; position: number; freePreview: boolean; progressStatus: string }
interface OutlineChapter { id: string; title: string; position: number; lessons: OutlineLesson[] }
interface Section {
  id: string; position: number; title: string; videoUrl: string | null; embedUrl: string | null;
  explanation: string; transcript: string | null; workedExample: string | null;
  hasPractice: boolean; practiceCount: number; practiceHint: string | null; practiceLabel: string | null;
}
interface Lesson {
  id: string; title: string; goal: string | null; content: string; videoUrl: string | null; embedUrl: string | null;
  position: number; freePreview: boolean; enrolled: boolean; courseId: string; courseTitle: string;
  chapterId: string; chapterTitle: string; chapterPosition: number;
  progressStatus: string; activeSeconds: number; sections: Section[]; outline: OutlineChapter[];
  previousLessonId: string | null; nextLessonId: string | null;
}

const HEARTBEAT_SECONDS = 30;

/** Lesson page (reference: pics/users/Lesson.png) with inline, collapsible section practice. */
export default function LessonScreen({ id }: { id: string }) {
  const { data: l, error, loading } = useApi<Lesson>(`/lessons/${id}`);
  const isAdmin = isStaff(useAuth().user?.role); // staff may open any lesson
  const [progress, setProgress] = useState<any>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const action = useAction();
  const lastBeat = useRef(Date.now());

  // Study-time heartbeat (enrolled students only; free-preview visitors are not tracked).
  useEffect(() => {
    if (!l?.enrolled) return;
    lastBeat.current = Date.now();
    api.post(`/lessons/${id}/progress`, { activeSeconds: 0, progressPercent: 10 }).then(setProgress).catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') { lastBeat.current = Date.now(); return; }
      const secs = Math.round((Date.now() - lastBeat.current) / 1000);
      lastBeat.current = Date.now();
      api.post(`/lessons/${id}/progress`, { activeSeconds: secs }).then(setProgress).catch(() => {});
    }, HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(t);
  }, [l?.enrolled, id]);

  if (loading) return <Loading />;
  if (!l) return <Screen title="Lesson"><ErrorBox message={error} /></Screen>;

  const status = progress?.status ?? l.progressStatus;
  const complete = () => action.run(async () => setProgress(await api.post(`/lessons/${id}/progress`, { completed: true })));
  const lessonNo = `${l.chapterPosition}.${l.position}`;
  // Lessons created before sections existed render as one section from their content + video.
  const sections: Section[] = l.sections.length ? l.sections : [{
    id: 'legacy', position: 1, title: l.title, videoUrl: l.videoUrl, embedUrl: l.embedUrl, explanation: l.content,
    transcript: null, workedExample: null, hasPractice: false, practiceCount: 0, practiceHint: null, practiceLabel: null,
  }];
  const scrollTo = (sid: string) => document.getElementById(`section-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const main = (
    <View style={styles.main}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pressable onPress={() => navigate(`/courses/${l.courseId}`)}><Text style={[styles.crumb, styles.crumbLink]}>{l.courseTitle.toUpperCase()}</Text></Pressable>
        <Text style={styles.crumb}>/ {l.chapterTitle.toUpperCase()} / LESSON {lessonNo}</Text>
      </View>
      <Text style={styles.h1} role="heading" aria-level={1}>{l.title}</Text>
      {l.goal ? <Text style={styles.goal}><Text style={{ fontWeight: '700' }}>Goal: </Text>{l.goal}</Text> : null}

      {isAdmin ? (
        <View style={styles.previewBanner}>
          <Text style={{ color: colors.ink, flex: 1, minWidth: 220 }}>
            <Text style={{ fontWeight: '700' }}>Student view.</Text> You are seeing this lesson as students do.
          </Text>
          <Button small title="Edit this lesson" onPress={() => navigate(`/admin/lessons/${l.id}`)} />
        </View>
      ) : !l.enrolled ? (
        <View style={styles.previewBanner}>
          <Text style={{ color: colors.ink, flex: 1, minWidth: 220 }}>
            <Text style={{ fontWeight: '700' }}>Free preview.</Text> Enroll in {l.courseTitle} to open every lesson and track your progress.
          </Text>
          <Button small title="View course" onPress={() => navigate(`/courses/${l.courseId}`)} />
        </View>
      ) : null}

      {sections.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {sections.map((s) => (
            <Pressable key={s.id} onPress={() => scrollTo(s.id)} accessibilityRole="link">
              <Text style={styles.anchor}>{s.position}. {s.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {sections.map((s) => <SectionCard key={s.id} section={s} />)}

      <View style={styles.doneCard}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          {l.enrolled ? (
            <>
              <Text style={{ fontWeight: '700', color: status === 'completed' ? colors.success : colors.ink }}>
                {status === 'completed' ? '✓ Lesson completed' : 'Finished this lesson?'}
              </Text>
              <Text style={{ color: colors.ink3, fontSize: 13 }}>Study time: {formatDuration(Number(progress?.activeSeconds ?? l.activeSeconds))}</Text>
            </>
          ) : <Text style={{ color: colors.ink3 }}>Enroll to save your progress.</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
          {l.previousLessonId ? <Button variant="secondary" title="← Previous" onPress={() => navigate(`/lessons/${l.previousLessonId}`)} /> : null}
          {l.enrolled && status !== 'completed' ? <Button variant="secondary" title="Mark as completed" onPress={complete} loading={action.busy} /> : null}
          {l.nextLessonId ? <Button title="Next lesson →" onPress={() => navigate(`/lessons/${l.nextLessonId}`)} /> : null}
        </View>
      </View>
      <ErrorBox message={action.error} />
    </View>
  );

  if (!wide) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ padding: space(5), gap: space(5) }}>
        <CourseOutline lesson={l} compact isAdmin={isAdmin} />
        {main}
        <Footer />
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.paper }}>
      <ScrollView style={styles.side} contentContainerStyle={{ paddingVertical: space(7), paddingHorizontal: space(3) }}>
        <CourseOutline lesson={l} isAdmin={isAdmin} />
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: space(8), paddingHorizontal: space(9) }}>
        {main}
        <View style={{ marginTop: space(10) }}><Footer /></View>
      </ScrollView>
    </View>
  );
}

/** One lesson section: video, Explanation / Transcript / Worked example tabs, then inline practice. */
function SectionCard({ section: s }: { section: Section }) {
  const tabs = [
    { key: 'explanation', label: 'Explanation', body: s.explanation },
    { key: 'transcript', label: 'Transcript', body: s.transcript },
    { key: 'worked', label: 'Worked example', body: s.workedExample },
  ].filter((t) => t.key === 'explanation' || (t.body && t.body.trim()));
  const [tab, setTab] = useState(tabs[0].key);
  const body = tabs.find((t) => t.key === tab)?.body ?? '';

  return (
    <View style={styles.section} nativeID={`section-${s.id}`}>
      <Text style={styles.h2} role="heading" aria-level={2}>{s.position}. {s.title}</Text>
      {s.embedUrl ? (
        <VideoPlayer embedUrl={s.embedUrl} sourceUrl={s.videoUrl ?? undefined} title={s.title} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Icon name="play" size={26} color={colors.ink} />
          <Text style={styles.placeholderTitle}>Video {s.position} · {s.title}</Text>
          <Text style={styles.placeholderText}>Video not available yet — the explanation below covers this section.</Text>
        </View>
      )}

      <View style={styles.segment} role="tablist">
        {tabs.map((t) => (
          <Pressable key={t.key} role="tab" aria-selected={tab === t.key} onPress={() => setTab(t.key)}
            style={[styles.segBtn, tab === t.key && styles.segOn]}>
            <Text style={[styles.segText, tab === t.key && { color: colors.paper }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {body.trim() ? <MathParagraphs source={body} /> : <Text style={{ color: colors.ink3 }}>Nothing here yet.</Text>}

      {s.hasPractice ? (
        <SectionPractice sectionId={s.id} count={s.practiceCount} hint={s.practiceHint} label={s.practiceLabel} />
      ) : null}
    </View>
  );
}

/** "Your course" sidebar: collapsible chapters, current lesson highlighted, chapter practice link. */
function CourseOutline({ lesson: l, compact, isAdmin }: { lesson: Lesson; compact?: boolean; isAdmin?: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set([l.chapterId]));
  const [shown, setShown] = useState(!compact);
  const toggle = (cid: string) => setOpen((s) => { const n = new Set(s); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });

  if (compact && !shown) {
    return (
      <Pressable onPress={() => setShown(true)} style={styles.outlineToggle}>
        <Text style={styles.sideLabel}>YOUR COURSE</Text>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>{l.courseTitle} ▾</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 2 }} role="navigation" aria-label="Course outline">
      <Text style={[styles.sideLabel, { paddingHorizontal: space(2.5) }]}>YOUR COURSE</Text>
      <Pressable onPress={() => navigate(`/courses/${l.courseId}`)} style={{ paddingHorizontal: space(2.5), paddingVertical: space(2) }}>
        <Text style={styles.sideCourse}>{l.courseTitle}</Text>
      </Pressable>
      {l.outline.map((ch) => {
        const isOpen = open.has(ch.id);
        return (
          <View key={ch.id}>
            <Pressable onPress={() => toggle(ch.id)} accessibilityRole="button" aria-expanded={isOpen}
              style={({ hovered }: any) => [styles.sideChapter, hovered && { backgroundColor: colors.paper2 }]}>
              <Text style={styles.sideCaret}>{isOpen ? '▾' : '▸'}</Text>
              <Text style={styles.sideChapterText}>{ch.position}. {ch.title}</Text>
            </Pressable>
            {isOpen ? (
              <View style={{ paddingLeft: space(3), gap: 2 }}>
                {ch.lessons.map((x) => {
                  const current = x.id === l.id;
                  const locked = !isAdmin && !l.enrolled && !x.freePreview;
                  return (
                    <Pressable key={x.id} disabled={locked} onPress={() => navigate(`/lessons/${x.id}`)}
                      style={({ hovered }: any) => [styles.sideLesson, current && styles.sideLessonOn, hovered && !current && !locked && { backgroundColor: colors.paper2 }]}>
                      <Text style={[styles.sideLessonText, current && { fontWeight: '700', color: colors.ink }, locked && { color: colors.ink4 }]}>
                        {ch.position}.{x.position} {x.title}
                      </Text>
                      {x.progressStatus === 'completed' ? <Text style={{ color: colors.success, fontSize: 12 }}>✓</Text> : null}
                    </Pressable>
                  );
                })}
                {ch.lessons.length === 0 ? <Text style={[styles.sideLessonText, { paddingHorizontal: space(2.5), color: colors.ink4 }]}>Coming soon</Text> : null}
                <Pressable onPress={() => navigate('/practice')} style={{ paddingHorizontal: space(2.5), paddingVertical: space(2) }}>
                  <Text style={styles.sideSmall}>Chapter practice →</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={styles.sideDivider} />
      <SideLink label="Quizzes" onPress={() => navigate('/practice')} />
      <SideLink label="My progress" onPress={() => navigate('/')} />
      {compact ? <Pressable onPress={() => setShown(false)} style={{ padding: space(2.5) }}><Text style={styles.sideSmall}>Hide outline ▴</Text></Pressable> : null}
    </View>
  );
}

function SideLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [styles.sideChapter, hovered && { backgroundColor: colors.paper2 }]}>
      <Text style={[styles.sideChapterText, { color: colors.ink2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  main: { width: '100%', maxWidth: 820, gap: space(5) },
  crumb: { fontSize: 12, letterSpacing: 1.1, color: colors.ink3 },
  crumbLink: { color: colors.link, textDecorationLine: 'underline' },
  h1: { fontFamily: fonts.sans, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -0.9, color: colors.ink },
  goal: { fontSize: 15.5, color: colors.ink },
  anchor: { fontSize: 13, color: colors.link, textDecorationLine: 'underline' },
  previewBanner: { flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap', backgroundColor: colors.lav, borderRadius: radius.md, padding: space(4) },
  section: { backgroundColor: '#fffdf9', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space(6), gap: space(4) },
  h2: { fontSize: 19, fontWeight: '700', color: colors.ink },
  videoPlaceholder: { aspectRatio: 16 / 7, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: radius.sm, backgroundColor: '#ebe8e3', alignItems: 'center', justifyContent: 'center', gap: space(2), padding: space(4) },
  placeholderTitle: { fontSize: 13, color: colors.ink2, marginTop: space(2) },
  placeholderText: { fontSize: 13, color: colors.ink2, textAlign: 'center' },
  segment: { flexDirection: 'row', alignSelf: 'flex-start', flexWrap: 'wrap', backgroundColor: colors.paper3, borderRadius: 999, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 999 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontSize: 13.5, color: colors.ink2, fontWeight: '500' },
  doneCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3), flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(5) },
  side: { width: 260, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.line },
  sideLabel: { fontSize: 11.5, letterSpacing: 1.2, color: colors.ink3, marginBottom: space(2) },
  sideCourse: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sideChapter: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: space(2.5), paddingVertical: space(2), borderRadius: 8 },
  sideCaret: { fontSize: 10, color: colors.ink2, width: 10, marginTop: 4 },
  sideChapterText: { fontSize: 14.5, color: colors.ink, lineHeight: 21, flexShrink: 1 },
  sideLesson: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: space(2.5), paddingVertical: space(2), borderRadius: 8 },
  sideLessonOn: { backgroundColor: colors.lav },
  sideLessonText: { fontSize: 14, color: colors.ink2, lineHeight: 21, flexShrink: 1 },
  sideSmall: { fontSize: 12.5, color: colors.ink2 },
  sideDivider: { height: 1, backgroundColor: colors.line, marginVertical: space(4), marginHorizontal: space(2) },
  outlineToggle: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space(3), gap: 2 },
});
