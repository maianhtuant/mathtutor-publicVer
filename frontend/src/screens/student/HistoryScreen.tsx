import { Text } from 'react-native';

import { Badge, Card, ErrorBox, Loading, Screen, Table, formatDate, statusTone } from '../../components/ui';
import { useApi } from '../../hooks';
import { navigate } from '../../router';

export default function HistoryScreen() {
  const { data, error, loading } = useApi<any[]>('/me/attempts');
  if (loading) return <Loading />;
  return (
    <Screen title="Attempt history" subtitle="Every attempt is kept; select one to review it">
      <ErrorBox message={error} />
      <Card>
        <Table
          onRowPress={(r) => navigate(`/attempts/${r.id}`)}
          columns={[
            { key: 'setTitle', title: 'Practice set', flex: 2 },
            { key: 'attemptNo', title: '#', flex: 0.5 },
            { key: 'status', title: 'Status', render: (r) => <Badge tone={statusTone(r.status)} text={r.status.replace('_', ' ')} /> },
            { key: 'score', title: 'Score', render: (r) => <Text>{r.score == null ? '—' : `${Number(r.score)} / ${Number(r.maxScore)}`}</Text> },
            { key: 'passed', title: 'Result', render: (r) => r.passed == null ? <Text>—</Text> : <Badge tone={r.passed ? 'success' : 'danger'} text={r.passed ? 'Passed' : 'Not passed'} /> },
            { key: 'startedAt', title: 'Started', flex: 1.5, render: (r) => <Text>{formatDate(r.startedAt)}</Text> },
          ]}
          rows={data ?? []}
        />
      </Card>
    </Screen>
  );
}
