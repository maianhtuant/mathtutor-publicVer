import { useState } from 'react';
import { Text } from 'react-native';

import { Card, ErrorBox, H2, Loading, Screen, Select, Table, formatDate, formatDuration } from '../../components/ui';
import { useApi } from '../../hooks';
import { navigate } from '../../router';
import { topicLabel } from '../student/DashboardScreen';

export default function ReportsScreen() {
  const { data: courses } = useApi<any[]>('/admin/courses');
  const [courseId, setCourseId] = useState('');
  const { data, error, loading } = useApi<any>(`/admin/reports/learning${courseId ? `?courseId=${courseId}` : ''}`);
  const pct = (v: any) => (v == null ? '—' : `${Number(v)}%`);

  return (
    <Screen title="Learning reports" subtitle="Lesson completion, practice scores and accuracy by topic (finished attempts only)">
      <Select label="Course" value={courseId} onChange={setCourseId}
        options={[{ value: '', label: 'All courses' }, ...(courses ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <Card>
            <H2>Students</H2>
            <Table onRowPress={(r) => navigate(`/admin/users/${r.userId}`)} columns={[
              { key: 'email', title: 'Student', flex: 2 },
              { key: 'courseTitle', title: 'Course', flex: 1.5 },
              { key: 'completionPercent', title: 'Lessons', render: (r) => <Text>{r.completedLessons}/{r.totalLessons} ({pct(r.completionPercent)})</Text> },
              { key: 'activeSeconds', title: 'Study time', render: (r) => <Text>{formatDuration(Number(r.activeSeconds))}</Text> },
              { key: 'finishedAttempts', title: 'Attempts' },
              { key: 'avgScorePercent', title: 'Avg score', render: (r) => <Text>{pct(r.avgScorePercent)}</Text> },
              { key: 'lastStudiedAt', title: 'Last studied', flex: 1.5, render: (r) => <Text>{formatDate(r.lastStudiedAt)}</Text> },
            ]} rows={data.students} />
          </Card>
          <Card>
            <H2>Practice sets</H2>
            <Table columns={[
              { key: 'title', title: 'Set', flex: 2 },
              { key: 'courseTitle', title: 'Course', flex: 1.5 },
              { key: 'students', title: 'Students' },
              { key: 'finishedAttempts', title: 'Finished' },
              { key: 'passedAttempts', title: 'Passed' },
              { key: 'avgScorePercent', title: 'Avg score', render: (r) => <Text>{pct(r.avgScorePercent)}</Text> },
            ]} rows={data.sets.map((s: any) => ({ ...s, id: s.setId }))} />
          </Card>
          <Card>
            <H2>Accuracy by topic</H2>
            <Table columns={[
              { key: 'topicCode', title: 'Topic', flex: 2, render: (r) => <Text>{topicLabel(r.topicCode)}</Text> },
              { key: 'correctQuestions', title: 'Correct' },
              { key: 'totalQuestions', title: 'Total' },
              { key: 'accuracyPercent', title: 'Accuracy', render: (r) => <Text>{pct(r.accuracyPercent)}</Text> },
            ]} rows={data.topics.map((t: any) => ({ ...t, id: t.topicCode }))} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
