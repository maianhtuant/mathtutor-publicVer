import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Crumbs, ErrorBox, Loading, Muted, PillTabs, Screen } from '../../components/ui';
import { Icon } from '../../components/web';
import { useApi } from '../../hooks';
import { navigate, queryParam } from '../../router';
import { colors, fonts, radius, shadow, space } from '../../theme';
import { indexSubjects } from '../../subjects';

export interface Video {
  id: string; title: string; description: string | null; videoUrl: string; provider: string; embedId: string | null;
  category: string | null; visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT'; subjectId: string; subjectName: string;
  parentSubjectId: string | null; mathTemplateId: string | null; mathTemplateLabel: string | null;
  createdAt: string; embedUrl: string | null; thumbnailUrl: string | null;
}
interface Subject { id: string; name: string; parentId: string | null; videoCount: number }

/** Lesson library: subject pill tabs, child sub-tabs, search, and category sections (GED-Tutor "videos" page). */
export default function VideosScreen() {
  const { data: subjects } = useApi<Subject[]>('/subjects');
  const { data: videos, error, loading } = useApi<Video[]>('/videos');
  // Selected subject (any depth); "all" shows everything. A deep link (?subject=) preselects it.
  const [selected, setSelected] = useState<string>(queryParam('subject') ?? 'all');
  const [q, setQ] = useState('');

  const idx = useMemo(() => indexSubjects(subjects), [subjects]);
  const roots = idx.roots.filter((r) => [...idx.descendants(r.id)].some((id) => Number(idx.byId.get(id)?.videoCount ?? 0) > 0));
  const count = (id: string) => [...idx.descendants(id)].reduce((n, d) => n + Number(idx.byId.get(d)?.videoCount ?? 0), 0);
  // One row of pill tabs per level along the selected path: roots, then children of each selected level.
  const pathIds = selected === 'all' ? [] : idx.path(selected).map((s) => s.id);
  const activeTab = pathIds[0] ?? 'all';
  const hasVideos = (id: string) => [...idx.descendants(id)].some((d) => Number(idx.byId.get(d)?.videoCount ?? 0) > 0);
  const levels = pathIds.map((id) => ({ parent: id, kids: idx.children(id).filter((k) => hasVideos(k.id)) })).filter((l) => l.kids.length);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const allowed = selected === 'all' ? null : idx.descendants(selected);
    return (videos ?? []).filter((v) => {
      if (allowed && !allowed.has(v.subjectId)) return false;
      return !term || v.title.toLowerCase().includes(term) || (v.category ?? '').toLowerCase().includes(term)
        || v.subjectName.toLowerCase().includes(term);
    });
  }, [videos, selected, idx, q]);

  const sections = useMemo(() => {
    const m = new Map<string, Video[]>();
    shown.forEach((v) => {
      const key = activeTab === 'all' ? v.subjectName : v.category || 'General';
      m.set(key, [...(m.get(key) ?? []), v]);
    });
    return [...m.entries()];
  }, [shown, activeTab]);

  const tabName = selected === 'all' ? undefined : idx.byId.get(selected)?.name;

  return (
    <Screen>
      <View style={{ gap: space(2) }}>
        <Crumbs items={[{ label: 'videos' }]} />
        <Text style={styles.h1} role="heading" aria-level={1}>Videos</Text>
        <Muted style={{ fontSize: 16 }}>Watch, learn, and practice — all in one place.</Muted>
      </View>
      <ErrorBox message={error} />

      <View style={styles.tabBar}>
        <PillTabs value={activeTab} onChange={setSelected}
          tabs={[{ value: 'all', label: 'All', count: videos?.length ?? 0 }, ...roots.map((s) => ({ value: s.id, label: s.name, count: count(s.id) }))]} />
      </View>
      {levels.map((level, i) => (
        <View key={level.parent} style={[styles.tabBar, { marginTop: -space(3), paddingTop: 0 }]}>
          <PillTabs small value={pathIds[i + 1] ?? level.parent} onChange={setSelected}
            tabs={[{ value: level.parent, label: `All ${idx.byId.get(level.parent)?.name ?? ''}`, count: count(level.parent) },
              ...level.kids.map((c) => ({ value: c.id, label: c.name, count: count(c.id) }))]} />
        </View>
      ))}

      <View style={styles.search}>
        <Icon name="search" size={16} color={colors.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${tabName ?? ''} videos…`.replace('  ', ' ')}
          placeholderTextColor={colors.ink4} aria-label="Search videos" style={styles.searchInput} />
        <Text style={styles.searchCount}>{shown.length} {shown.length === 1 ? 'video' : 'videos'}</Text>
      </View>

      {loading ? <Loading /> : null}
      {!loading && shown.length === 0 ? (
        <Text style={styles.noResults}>{q ? 'No videos match your search.' : 'No videos in this subject yet.'}</Text>
      ) : null}

      {sections.map(([title, list]) => (
        <View key={title} style={{ marginBottom: space(4) }}>
          <View style={styles.catTitle}>
            <Text style={styles.catText}>{title}</Text>
            <Text style={styles.catCount}>{list.length}</Text>
          </View>
          <View style={styles.grid}>
            {list.map((v) => <VideoCard key={v.id} video={v} showCategory={activeTab === 'all'} />)}
          </View>
        </View>
      ))}
    </Screen>
  );
}

export function VideoCard({ video, showCategory = true, compact }: { video: Video; showCategory?: boolean; compact?: boolean }) {
  return (
    <Pressable onPress={() => navigate(`/videos/${video.id}`)} accessibilityRole="link"
      style={({ hovered }: any) => [styles.card, compact && { flexBasis: 'auto' as any, minWidth: 0 }, hovered && [{ transform: [{ translateY: -2 }] }, shadow.md]]}>
      {video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} resizeMode="cover" accessibilityLabel="" />
      ) : (
        <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }]}>
          <View style={{ opacity: 0.4 }}><Icon name="play" size={28} color={colors.paper} /></View>
        </View>
      )}
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Badge tone="primary" text={video.subjectName} />
          {showCategory && video.category ? <Text style={styles.cardCat}>{video.category}</Text> : null}
          {video.visibility !== 'PUBLIC' ? <Badge tone="neutral" text={video.visibility === 'DRAFT' ? 'Draft' : 'Members'} /> : null}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
        {!compact ? <Text style={styles.cardDate}>{new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 50, color: colors.ink, letterSpacing: -0.8 },
  tabBar: { paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: colors.line },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, backgroundColor: colors.paper },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.ink, fontFamily: fonts.sans, outlineStyle: 'none' } as any,
  searchCount: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink4 },
  noResults: { color: colors.ink3, fontStyle: 'italic', paddingVertical: space(3), fontSize: 14 },
  catTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 10, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  catText: { fontFamily: fonts.serif, fontSize: 21, color: colors.ink },
  catCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: { flexGrow: 1, flexBasis: 260, maxWidth: 360, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', transitionDuration: '140ms' } as any,
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.ink },
  cardCat: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.ink4 },
  cardTitle: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: colors.ink },
  cardDate: { fontSize: 12.5, color: colors.ink3 },
});
