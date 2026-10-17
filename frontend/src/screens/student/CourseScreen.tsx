import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../../api';
import { Button, ErrorBox, Loading, Screen } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, radius, space } from '../../theme';

interface Lesson { id: string; title: string; position: number; freePreview: boolean; progressStatus: string }
interface Chapter { id: string; title: string; position: number; lessons: Lesson[] }
interface Course {
  id: string; title: string; description: string | null; readiness: string | null; subjectName: string | null;
  enrolled: boolean; chapters: Chapter[]; chapterCount: number; publishedLessonCount: number;
  continueLesson: { id: string; title: string } | null;
}

/** Course overview (reference: pics/users/Course.png). */
export default function CourseScreen({ id }: { id: string }) {
  const { data: c, setData, error, loading } = useApi<Course>(`/courses/${id}`);
  const action = useAction();
  if (loading) return <Loading />;
  if (!c) return <Screen title="Course"><ErrorBox message={error} /></Screen>;

  const enroll = () => action.run(async () => setData(await api.post<Course>(`/courses/${id}/enroll`)));
  const allDone = c.enrolled && !c.continueLesson && c.publishedLessonCount > 0;
  const firstLesson = c.chapters.flatMap((ch) => ch.lessons)[0];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Pressable onPress={() => navigate('/courses')}><Text style={[styles.crumb, styles.crumbLink]}>COURSES</Text></Pressable>
        {c.subjectName ? <Text style={styles.crumb}>/ {c.subjectName.toUpperCase()}</Text> : null}
      </View>
      <View style={{ gap: space(4) }}>
        <Text style={styles.h1} role="heading" aria-level={1}>{c.title}</Text>
        {c.description ? <Text style={styles.lede}>{c.description}</Text> : null}
      </View>
      <ErrorBox message={action.error} />

      <View style={styles.cards}>
        <InfoCard title="Readiness">
          <Text style={styles.body}>{c.readiness || 'No prerequisites'}</Text>
          <Text style={styles.small}>Advisory only — you can start any course.</Text>
        </InfoCard>
        <InfoCard title="What's inside">
          <Text style={styles.body}>{c.chapterCount} chapter{c.chapterCount === 1 ? '' : 's'} · {c.publishedLessonCount} published lesson{c.publishedLessonCount === 1 ? '' : 's'}</Text>
        </InfoCard>
        <InfoCard title={c.enrolled ? (allDone ? 'Course complete' : 'Keep going') : 'Start learning'}>
          {c.enrolled ? (
            c.continueLesson ? (
              <>
                <Text style={styles.body}>Continue with <Text style={{ fontWeight: '600' }}>{c.continueLesson.title}</Text>.</Text>
                <View style={{ flexDirection: 'row' }}><Button title="Continue →" onPress={() => navigate(`/lessons/${c.continueLesson!.id}`)} /></View>
              </>
            ) : (
              <>
                <Text style={styles.body}>{allDone ? 'You have completed every published lesson.' : 'Lessons are on the way.'}</Text>
                {firstLesson ? <View style={{ flexDirection: 'row' }}><Button variant="secondary" title="Review from the start" onPress={() => navigate(`/lessons/${firstLesson.id}`)} /></View> : null}
              </>
            )
          ) : (
            <>
              <Text style={styles.body}>Enroll to open every lesson, practice set and diagnostic.</Text>
              <View style={{ flexDirection: 'row' }}><Button title="Enroll — free" onPress={enroll} loading={action.busy} /></View>
            </>
          )}
        </InfoCard>
      </View>

      <Text style={styles.h2} role="heading" aria-level={2}>Chapters</Text>
      <View style={{ gap: space(4) }}>
        {c.chapters.map((ch) => (
          <View key={ch.id} style={styles.chapter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3) }}>
              <Text style={styles.chapterTitle}>{ch.position}. {ch.title}</Text>
              {ch.lessons.length === 0 ? <View style={styles.soon}><Text style={styles.soonText}>Coming soon</Text></View> : null}
            </View>
            {ch.lessons.length ? (
              <View style={{ marginTop: space(3), gap: space(2) }}>
                {ch.lessons.map((l) => {
                  const open = c.enrolled || l.freePreview;
                  const label = `${ch.position}.${l.position} ${l.title}`;
                  return (
                    <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}>
                      <Text style={styles.bullet}>•</Text>
                      {open ? (
                        <Pressable onPress={() => navigate(`/lessons/${l.id}`)} accessibilityRole="link">
                          {({ hovered }: any) => <Text style={[styles.lessonLink, hovered && { color: colors.ink }]}>{label}</Text>}
                        </Pressable>
                      ) : <Text style={styles.lessonText}>{label}</Text>}
                      {!c.enrolled && l.freePreview ? <View style={styles.preview}><Text style={styles.previewText}>Free preview</Text></View> : null}
                      {c.enrolled && l.progressStatus === 'completed' ? <Text style={{ color: colors.success, fontSize: 13 }}>✓ done</Text> : null}
                      {c.enrolled && l.progressStatus === 'in_progress' ? <Text style={{ color: colors.ink3, fontSize: 13 }}>in progress</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))}
        {c.chapters.length === 0 ? <Text style={styles.small}>Chapters are coming soon.</Text> : null}
      </View>
    </Screen>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ gap: space(3) }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  crumb: { fontSize: 12, letterSpacing: 1.1, color: colors.ink3, fontFamily: fonts.sans },
  crumbLink: { color: colors.link, textDecorationLine: 'underline' },
  h1: { fontFamily: fonts.sans, fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1, color: colors.ink },
  lede: { fontSize: 19, lineHeight: 28, color: colors.ink2, maxWidth: 820 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4) },
  card: { flexGrow: 1, flexBasis: 280, backgroundColor: '#fffdf9', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md + 4, padding: space(6), gap: space(4), minHeight: 170 },
  cardTitle: { fontSize: 17.5, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  small: { fontSize: 12.5, color: colors.ink3 },
  h2: { fontSize: 25, fontWeight: '700', color: colors.ink, marginTop: space(2), letterSpacing: -0.4 },
  chapter: { backgroundColor: '#fffdf9', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md + 4, paddingVertical: space(5), paddingHorizontal: space(6) },
  chapterTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  bullet: { color: colors.ink, fontSize: 14 },
  lessonLink: { fontSize: 15, color: colors.link, textDecorationLine: 'underline' },
  lessonText: { fontSize: 15, color: colors.ink },
  preview: { backgroundColor: colors.lav, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  previewText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  soon: { backgroundColor: colors.paper3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  soonText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
});
