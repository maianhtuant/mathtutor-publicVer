import { Image, Text, View } from 'react-native';

import { api } from '../../api';
import { Badge, Button, Card, ErrorBox, Notice, Screen, Select, Table } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { colors, space } from '../../theme';
import type { Video } from '../videos/VideosScreen';

type Visibility = Video['visibility'];
export const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Public' }, { value: 'PRIVATE', label: 'Members' }, { value: 'DRAFT', label: 'Draft' },
];

export default function AdminVideosScreen() {
  const { data, setData, error } = useApi<Video[]>('/admin/videos');
  const action = useAction();

  const setVisibility = (v: Video, visibility: Visibility) => action.run(async () => {
    const updated = await api.patch<Video>(`/admin/videos/${v.id}`, { visibility });
    setData((data ?? []).map((x) => (x.id === v.id ? { ...x, ...updated } : x)));
  }, `“${v.title}” is now ${visibilityOptions.find((o) => o.value === visibility)?.label.toLowerCase()}`);

  return (
    <Screen kicker="Admin" title="Videos" subtitle="Paste a YouTube or Vimeo link; Public lessons are visible without logging in, Members lessons need an account, Drafts are admin-only."
      actions={<>
        <Button variant="secondary" title="View library" onPress={() => navigate('/videos')} />
        <Button title="New video" onPress={() => navigate('/admin/videos/new')} />
      </>}>
      <ErrorBox message={error || action.error} />
      <Notice message={action.notice} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          onRowPress={(r) => navigate(`/admin/videos/${r.id}`)}
          columns={[
            { key: 'thumb', title: '', flex: 0.8, render: (r) => r.thumbnailUrl
              ? <Image source={{ uri: r.thumbnailUrl }} style={{ width: 80, height: 45, borderRadius: 6, backgroundColor: colors.ink }} />
              : <View style={{ width: 80, height: 45, borderRadius: 6, backgroundColor: colors.paper3 }} /> },
            { key: 'title', title: 'Title', flex: 2.4, render: (r) => <Text style={{ color: colors.ink, fontWeight: '500' }} numberOfLines={2}>{r.title}</Text> },
            { key: 'subjectName', title: 'Subject', flex: 1.2 },
            { key: 'category', title: 'Category', flex: 1.2 },
            { key: 'mathTemplateLabel', title: 'Practice', flex: 1.3, render: (r) => r.mathTemplateLabel ? <Badge tone="primary" text={r.mathTemplateLabel} /> : <Text style={{ color: colors.ink4 }}>—</Text> },
            { key: 'visibility', title: 'Visibility', flex: 2.4, render: (r) => (
              <View style={{ marginBottom: -space(3) }}>
                <Select value={r.visibility} options={visibilityOptions} onChange={(vis) => vis !== r.visibility && setVisibility(r, vis)} />
              </View>
            ) },
          ]}
          rows={data ?? []}
        />
      </Card>
    </Screen>
  );
}
