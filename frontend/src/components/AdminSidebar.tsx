import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth';
import { roleLabel, seesPeople } from '../types';
import { useApi } from '../hooks';
import { navigate } from '../router';
import { colors, fonts, space } from '../theme';

// teacher: shown to teachers too. people: user accounts / student data, hidden from editors.
const ITEMS: { to: string; label: string; also?: string[]; count?: 'subjects'; teacher?: boolean; people?: boolean }[] = [
  { to: '/admin/users', label: 'Users', also: ['/admin/attempts'], teacher: true, people: true },
  { to: '/admin/subjects', label: 'Subjects' },
  { to: '/admin/tree', label: 'Content Tree', also: ['/admin/content', '/admin/lessons'], count: 'subjects' },
  { to: '/admin/videos', label: 'Videos' },
  { to: '/admin/templates', label: 'Math templates', teacher: true },
  { to: '/admin/sets', label: 'Practice sets', teacher: true },
  { to: '/admin/questions', label: 'Question bank', teacher: true },
  { to: '/admin/reports', label: 'Reports', teacher: true, people: true },
];

/** Left admin navigation from the reference design; becomes a horizontal strip on narrow screens. */
export default function AdminSidebar({ path, vertical }: { path: string; vertical: boolean }) {
  const { data: subjects } = useApi<{ parentId: string | null }[]>('/admin/subjects');
  const counts = { subjects: subjects?.filter((s) => !s.parentId).length };
  const active = (it: (typeof ITEMS)[number]) =>
    [it.to, ...(it.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`)) || (it.to === '/admin/tree' && path === '/');

  const role = useAuth().user?.role;
  const teacher = role === 'TEACHER';
  const items = ITEMS.filter((it) => (!teacher || it.teacher) && (seesPeople(role) || !it.people)).map((it) => {
    const on = active(it);
    const count = it.count ? counts[it.count] : undefined;
    return (
      <Pressable key={it.to} onPress={() => navigate(it.to)} accessibilityRole="link" aria-current={on ? 'page' : undefined}
        style={({ hovered }: any) => [styles.item, !vertical && styles.itemH, on ? styles.itemOn : hovered ? { backgroundColor: colors.paper2 } : null]}>
        <Text style={[styles.itemText, on && { color: colors.ink, fontWeight: '600' }]}>{teacher && it.to === '/admin/users' ? 'My students' : it.label}</Text>
        {count != null ? <Text style={styles.count}>{count}</Text> : null}
      </Pressable>
    );
  });

  if (!vertical) {
    return (
      <ScrollView horizontal style={styles.strip} contentContainerStyle={{ paddingHorizontal: space(3), gap: space(1) }}>
        {items}
      </ScrollView>
    );
  }
  return (
    <View style={styles.side} role="navigation" aria-label="Admin">
      <Text style={styles.heading}>{role && role !== 'USER' ? roleLabel[role].toUpperCase() : 'ADMIN'}</Text>
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 236, paddingTop: space(6), paddingHorizontal: space(2.5), borderRightWidth: 1, borderRightColor: colors.line, gap: 2, alignSelf: 'stretch' },
  heading: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.ink3, paddingHorizontal: space(3), marginBottom: space(2) },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(3), paddingVertical: 10, borderRadius: 8 },
  itemH: { paddingVertical: 7 },
  itemOn: { backgroundColor: '#eeecf4' },
  itemText: { fontSize: 14.5, color: colors.ink2, fontWeight: '500' },
  count: { fontSize: 12, color: colors.ink, fontWeight: '600', marginLeft: space(3) },
  strip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space(2) },
});
