import { Text, View } from 'react-native';

import { Button, Card, ErrorBox, Loading, Muted, Screen } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { api } from '../../api';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import type { Attempt } from '../../types';

export default function PracticeListScreen() {
  const { data, error, loading } = useApi<any[]>('/me/practice-sets');
  const action = useAction();
  if (loading) return <Loading />;

  const start = (setId: string) => action.run(async () => {
    const attempt = await api.post<Attempt>(`/practice-sets/${setId}/attempts`);
    navigate(`/attempts/${attempt.id}`);
  });

  return (
    <Screen title="Practice" subtitle="Sets assigned to you by an administrator">
      <ErrorBox message={error || action.error} />
      {data && data.length === 0 ? (
        <Card><Muted>No practice sets have been assigned to your account yet.</Muted></Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4) }}>
        {(data ?? []).map((s) => {
          const left = s.maxAttempts == null ? null : s.maxAttempts - s.attemptsUsed;
          return (
            <Card key={s.id} style={{ flexGrow: 1, flexBasis: 320, maxWidth: 540 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{s.title}</Text>
              <Muted style={{ marginTop: space(1) }}>{s.courseTitle}</Muted>
              <View style={{ marginVertical: space(3), gap: space(1) }}>
                <Muted>{s.questionCount} questions · pass at {Number(s.passPercent)}%</Muted>
                <Muted>{s.timeLimitSeconds ? `Time limit: ${Math.round(s.timeLimitSeconds / 60)} min` : 'No time limit'}</Muted>
                <Muted>Attempts: {s.attemptsUsed}{s.maxAttempts ? ` of ${s.maxAttempts}` : ' (unlimited)'}</Muted>
                {s.bestScore != null ? <Muted>Best score: {Number(s.bestScore)}</Muted> : null}
              </View>
              {s.openAttemptId ? (
                <Button title="Resume attempt" onPress={() => navigate(`/attempts/${s.openAttemptId}`)} />
              ) : (
                <Button title={left === 0 ? 'No attempts left' : 'Start new attempt'} disabled={left === 0}
                  onPress={() => start(s.id)} loading={action.busy} />
              )}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
