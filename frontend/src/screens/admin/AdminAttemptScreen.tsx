import AttemptReview from '../../components/AttemptReview';
import { Button, ErrorBox, Loading, Muted, Screen } from '../../components/ui';
import { useApi } from '../../hooks';
import type { Attempt } from '../../types';

export default function AdminAttemptScreen({ id }: { id: string }) {
  const { data, error, loading } = useApi<Attempt & { userId: string }>(`/admin/attempts/${id}`);
  if (loading) return <Loading />;
  if (!data) return <Screen title="Attempt"><ErrorBox message={error} /></Screen>;
  return (
    <Screen title={data.setTitle} subtitle={`Attempt ${data.attemptNo} · ${data.status.replace('_', ' ')}`}
      actions={<Button variant="secondary" title="Back to student" onPress={() => window.history.back()} />}>
      {data.status === 'in_progress'
        ? <Muted>This attempt is still in progress; scores appear after submission.</Muted>
        : <AttemptReview attempt={data} />}
    </Screen>
  );
}
