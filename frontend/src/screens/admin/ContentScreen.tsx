import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '../../api';
import { Badge, Button, Card, ErrorBox, Field, H2, Screen, Table, statusTone } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { navigate } from '../../router';
import { space } from '../../theme';

export default function ContentScreen() {
  const { data, error } = useApi<any[]>('/admin/courses');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const action = useAction();

  const create = () => action.run(async () => {
    const c = await api.post<any>('/admin/courses', { title, description });
    navigate(`/admin/content/${c.id}`);
  });

  return (
    <Screen title="Course content" subtitle="Courses → chapters → lessons">
      <ErrorBox message={error || action.error} />
      <Card>
        <H2>New course</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          <Field label="Title" value={title} onChangeText={setTitle} style={{ flexBasis: 260 }} />
          <Field label="Description" value={description} onChangeText={setDescription} style={{ flexBasis: 360 }} />
        </View>
        <View style={{ flexDirection: 'row' }}><Button title="Create course" onPress={create} disabled={!title.trim()} loading={action.busy} /></View>
      </Card>
      <Card>
        <Table
          onRowPress={(r) => navigate(`/admin/content/${r.id}`)}
          columns={[
            { key: 'title', title: 'Course', flex: 2 },
            { key: 'status', title: 'Status', render: (r) => <Badge tone={statusTone(r.status)} text={r.status} /> },
            { key: 'lessonCount', title: 'Lessons' },
            { key: 'enrollmentCount', title: 'Enrolled' },
            { key: 'description', title: 'Description', flex: 3, render: (r) => <Text numberOfLines={1}>{r.description || '—'}</Text> },
          ]}
          rows={data ?? []}
        />
      </Card>
    </Screen>
  );
}
