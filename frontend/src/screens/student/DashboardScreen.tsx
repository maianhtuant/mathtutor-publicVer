import { Text, View } from 'react-native';

import { useAuth } from '../../auth';
import { Badge, Button, Card, ErrorBox, H2, Loading, Muted, Screen, Stat, Table, formatDuration } from '../../components/ui';
import { useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';

interface Progress {
  courses: { courseId: string; courseTitle: string; totalLessons: number; completedLessons: number; completionPercent: number; activeSeconds: number }[];
  recentLesson: { id: string; title: string } | null;
  practice: { setId: string; title: string; finishedAttempts: number; bestScore: number; latestScore: number; maxScore: number }[];
  topics: { topicCode: string; totalQuestions: number; correctQuestions: number; accuracyPercent: number }[];
}

export function topicLabel(code: string) {
  return code.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).replace(/^Lcm$/, 'LCM');
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<Progress>('/me/progress');
  const { data: sets } = useApi<any[]>('/me/practice-sets');

  if (loading) return <Loading />;
  const p = data;
  const studySeconds = p?.courses.reduce((s, c) => s + Number(c.activeSeconds), 0) ?? 0;
  const finished = p?.practice.reduce((s, x) => s + Number(x.finishedAttempts), 0) ?? 0;
  const weakest = p?.topics.filter((t) => Number(t.accuracyPercent) < 70)[0];

  return (
    <Screen title={`Welcome, ${user?.fullName.split(' ')[0]}`} subtitle="Your lessons and practice at a glance">
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Stat label="Enrolled courses" value={p?.courses.length ?? 0} />
        <Stat label="Study time" value={formatDuration(studySeconds)} />
        <Stat label="Assigned practice sets" value={sets?.length ?? 0} />
        <Stat label="Finished attempts" value={finished} />
      </View>

      {weakest ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: '#f3d19c' }}>
          <Text style={{ color: colors.warning, fontWeight: '600' }}>
            Suggestion: practise {topicLabel(weakest.topicCode)} more — {weakest.correctQuestions}/{weakest.totalQuestions} correct so far.
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4) }}>
        <Card style={{ flexGrow: 1, flexBasis: 420 }}>
          <H2>Lessons</H2>
          {p?.courses.length ? p.courses.map((c) => (
            <View key={c.courseId} style={{ marginBottom: space(3) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{c.courseTitle}</Text>
                <Muted>{c.completedLessons}/{c.totalLessons} lessons</Muted>
              </View>
              <ProgressBar percent={Number(c.completionPercent)} />
            </View>
          )) : <Muted>You are not enrolled in any course yet.</Muted>}
          {p?.recentLesson ? (
            <View style={{ marginTop: space(2) }}>
              <Button variant="secondary" title={`Continue: ${p.recentLesson.title}`} onPress={() => navigate(`/lessons/${p.recentLesson!.id}`)} />
            </View>
          ) : (
            <View style={{ marginTop: space(2) }}><Button variant="secondary" title="Browse courses" onPress={() => navigate('/courses')} /></View>
          )}
        </Card>

        <Card style={{ flexGrow: 1, flexBasis: 420 }}>
          <H2>Accuracy by skill</H2>
          <Muted style={{ marginBottom: space(2), fontSize: 12 }}>Across all finished attempts</Muted>
          {p?.topics.length ? p.topics.map((t) => (
            <View key={t.topicCode} style={{ marginBottom: space(3) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>{topicLabel(t.topicCode)}</Text>
                <Muted>{t.correctQuestions}/{t.totalQuestions} · {Number(t.accuracyPercent)}%</Muted>
              </View>
              <ProgressBar percent={Number(t.accuracyPercent)} tone={Number(t.accuracyPercent) >= 70 ? 'good' : 'warn'} />
            </View>
          )) : <Muted>Finish a practice set to see your results by skill.</Muted>}
        </Card>
      </View>

      <Card>
        <H2>Practice results</H2>
        <Table
          columns={[
            { key: 'title', title: 'Practice set', flex: 2 },
            { key: 'finishedAttempts', title: 'Attempts' },
            { key: 'latestScore', title: 'Latest', render: (r) => <Text>{Number(r.latestScore)} / {Number(r.maxScore)}</Text> },
            { key: 'bestScore', title: 'Best', render: (r) => <Badge tone="primary" text={`${Number(r.bestScore)} / ${Number(r.maxScore)}`} /> },
          ]}
          rows={p?.practice ?? []}
        />
      </Card>
    </Screen>
  );
}

export function ProgressBar({ percent, tone = 'good' }: { percent: number; tone?: 'good' | 'warn' }) {
  return (
    <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, marginTop: space(1.5), overflow: 'hidden' }}
      role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <View style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', backgroundColor: tone === 'good' ? colors.primary : colors.warning }} />
    </View>
  );
}
