import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../../api';
import { Button, ErrorBox, Loading, Screen } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, fonts, radius, space } from '../../theme';
import { ProgressBar } from './DashboardScreen';

interface CourseCard { id: string; title: string; description: string | null; lessonCount: number; enrolled: boolean; completionPercent: number | null }

/** Course catalogue: enroll straight from a card, or open the course page. */
export default function CoursesScreen() {
  const { data, error, loading, reload } = useApi<CourseCard[]>('/courses');
  const action = useAction();
  if (loading && !data) return <Loading />;

  const enroll = (c: CourseCard) => action.run(async () => {
    await api.post(`/courses/${c.id}/enroll`);
    navigate(`/courses/${c.id}`);
  });

  const mine = (data ?? []).filter((c) => c.enrolled);
  const others = (data ?? []).filter((c) => !c.enrolled);

  const card = (c: CourseCard) => (
    <View key={c.id} style={styles.card}>
      <Pressable onPress={() => navigate(`/courses/${c.id}`)} accessibilityRole="link">
        {({ hovered }: any) => <Text style={[styles.title, hovered && { textDecorationLine: 'underline' }]}>{c.title}</Text>}
      </Pressable>
      {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
      <Text style={styles.meta}>{c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}</Text>
      {c.enrolled ? (
        <View style={{ gap: space(3) }}>
          <View>
            <Text style={styles.meta}>{Number(c.completionPercent ?? 0)}% complete</Text>
            <ProgressBar percent={Number(c.completionPercent ?? 0)} />
          </View>
          <View style={{ flexDirection: 'row' }}><Button title="Continue →" onPress={() => navigate(`/courses/${c.id}`)} /></View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
          <Button title="Enroll — free" onPress={() => enroll(c)} loading={action.busy} />
          <Button variant="secondary" title="View course" onPress={() => navigate(`/courses/${c.id}`)} />
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: space(3) }}>
        <Text style={styles.h1} role="heading" aria-level={1}>Courses</Text>
        <Text style={styles.lede}>Enroll in any course for free to open its lessons. Practice sets are assigned by your teacher.</Text>
      </View>
      <ErrorBox message={error || action.error} />
      {mine.length ? (
        <>
          <Text style={styles.h2}>Your courses</Text>
          <View style={styles.grid}>{mine.map(card)}</View>
        </>
      ) : null}
      <Text style={styles.h2}>{mine.length ? 'More courses' : 'All courses'}</Text>
      <View style={styles.grid}>{others.map(card)}</View>
      {data && others.length === 0 ? <Text style={styles.meta}>{mine.length ? 'You are enrolled in every course.' : 'No published courses yet.'}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.sans, fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1, color: colors.ink },
  lede: { fontSize: 18, lineHeight: 27, color: colors.ink2 },
  h2: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4) },
  card: { flexGrow: 1, flexBasis: 320, maxWidth: 540, backgroundColor: '#fffdf9', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md + 4, padding: space(6), gap: space(3) },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  desc: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  meta: { fontSize: 13, color: colors.ink3 },
});
