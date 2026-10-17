import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { MathInline } from '../components/MathText';
import { Button, Footer, Kicker } from '../components/ui';
import { Icon } from '../components/web';
import { useApi } from '../hooks';
import { navigate } from '../router';
import { colors, fonts, radius, shadow, space } from '../theme';
import { indexSubjects } from '../subjects';

interface Subject { id: string; name: string; description: string | null; parentId: string | null; videoCount: number }

/** Public home page, following the GED-Tutor landing layout. */
export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const { data: subjects } = useApi<Subject[]>('/subjects');
  const { data: videos } = useApi<any[]>('/videos');

  const idx = indexSubjects(subjects);
  const roots = idx.roots.filter((r) => [...idx.descendants(r.id)].some((id) => Number(idx.byId.get(id)?.videoCount ?? 0) > 0));
  const countFor = (s: Subject) => [...idx.descendants(s.id)].reduce((n, id) => n + Number(idx.byId.get(id)?.videoCount ?? 0), 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={styles.page}>
        {/* Hero */}
        <View style={[styles.hero, wide && { flexDirection: 'row', alignItems: 'flex-end' }]}>
          <View style={{ flex: 1.05, minWidth: 0 }}>
            <Text style={styles.heroMeta}>Math practice · lessons · progress</Text>
            <Text style={[styles.heroTitle, { fontSize: wide ? 70 : 44, lineHeight: wide ? 74 : 48 }]} role="heading" aria-level={1}>
              Learn math,{'\n'}<Text style={styles.heroEm}>one lesson</Text> at a time.
            </Text>
            <Text style={styles.heroLede}>
              Short video lessons, practice problems generated fresh every time, and exact answers checked instantly.
              Fifteen minutes a day is enough to make real progress.
            </Text>
            <View style={styles.heroCta}>
              <Button title="Start free ›" onPress={() => navigate('/register')} />
              <Button variant="secondary" title="Browse videos" onPress={() => navigate('/videos')} />
            </View>
          </View>
          {wide ? <HeroFigure /> : null}
        </View>

        {/* Stat strip: live numbers only */}
        <View style={[styles.strip, !wide && { flexWrap: 'wrap' }]}>
          <StripStat big={String(videos?.length ?? '—')} small="free videos" first />
          <StripStat big={String(roots.length || '—')} small="subjects" />
          <StripStat big="∞" small="practice problems, generated fresh" />
          <StripStat big="$0" small="to start · no card" />
        </View>

        {/* Subjects */}
        <SectionHead kicker="What you'll study" title="Pick a subject. Start a lesson."
          lede={<>Lessons are grouped by subject and topic, <Text style={{ color: colors.accentInk }}>and each one links to practice problems on the same skill.</Text></>} />
        <View style={styles.subjGrid}>
          {roots.map((s, i) => (
            <View key={s.id} style={[styles.subj, { flexBasis: wide ? '24%' : '48%' } as any]}>
              <Text style={styles.subjNum}>SUBJECT {String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.subjName}>{s.name}</Text>
              <Text style={styles.subjMeta}>{s.description ?? ''}</Text>
              <Striped label={`${s.name.toLowerCase()} · ${countFor(s)} videos`} hue={i} />
              <View style={{ flexDirection: 'row' }}>
                <Button small variant="secondary" title="Browse videos ›" onPress={() => navigate(`/videos?subject=${s.id}`)} />
              </View>
            </View>
          ))}
        </View>

        {/* How it works */}
        <SectionHead kicker="How it works" title="Watch. Practice. Track." />
        <View style={[styles.how, wide && { flexDirection: 'row' }]}>
          {[
            ['01', 'Watch a short video lesson', 'Each lesson is a few minutes long, with clear explanations and worked examples.'],
            ['02', 'Practice with fresh problems', 'Every question is generated new, so you can retry as often as you like. Answers are checked exactly — 3.6, 3,6 and 18/5 all count.'],
            ['03', 'Track your progress', 'Your dashboard shows accuracy by skill, so you know which topic to practise next.'],
          ].map(([n, h, p], i) => (
            <View key={n} style={[styles.howStep, wide && i < 2 && { borderRightWidth: 1, borderRightColor: colors.line, borderStyle: 'dashed' }]}>
              <Text style={styles.stepN}>{n}</Text>
              <Text style={styles.howH}>{h}</Text>
              <Text style={styles.howP}>{p}</Text>
            </View>
          ))}
        </View>

        {/* CTA band */}
        <View style={[styles.cta, !wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.ctaH}>Start studying today.</Text>
            <Text style={styles.ctaP}>Free. No credit card. Just open your first lesson.</Text>
          </View>
          <Pressable onPress={() => navigate('/register')} style={({ hovered }: any) => [styles.ctaBtn, hovered && { backgroundColor: colors.paper2 }]}>
            <Text style={{ color: colors.ink, fontWeight: '500', fontSize: 15 }}>Create free account ›</Text>
          </Pressable>
        </View>
      </View>
      <Footer />
    </ScrollView>
  );
}

function HeroFigure() {
  return (
    <View style={{ flex: 1, minHeight: 420, position: 'relative' }} aria-hidden>
      <View style={[styles.hfCard, { top: 0, left: 0, width: '78%', transform: [{ rotate: '-1.5deg' }] }]}>
        <View style={styles.hfHd}><Text style={styles.hfMono}>Math · Pre-Algebra</Text><Text style={styles.hfMono}>Q 3 of 10</Text></View>
        <View style={{ marginTop: 12, marginBottom: 4 }}><MathInline tex="\operatorname{lcm}(12, 18)" size={19} /></View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {['24', '36 ✓', '54'].map((t, i) => (
            <Text key={t} style={[styles.hfChoice, i === 1 && { backgroundColor: colors.accentSoft, borderColor: colors.accentLine, color: colors.accentInk }]}>{t}</Text>
          ))}
        </View>
        <Text style={[styles.hfMono, { marginTop: 8 }]}>Least common multiple</Text>
      </View>

      <View style={[styles.hfCard, { top: '36%', right: 0, width: '65%', transform: [{ rotate: '1.2deg' }] }]}>
        <View style={{ height: 6, backgroundColor: colors.paper3, borderRadius: 99, overflow: 'hidden' }}>
          <View style={{ width: '68%', height: '100%', backgroundColor: colors.accent, borderRadius: 99 }} />
        </View>
        <Text style={[styles.hfMono, { marginTop: 6, marginBottom: 10 }]}>68% · Decimals</Text>
        {[['done', 'Factors & multiples'], ['done', 'Least common multiple'], ['now', 'Multiplying decimals'], ['lock', 'Adding fractions']].map(([state, label]) => (
          <View key={label} style={[styles.hfLi, state === 'lock' && { opacity: 0.5 }]}>
            {state === 'done' ? <Icon name="check" size={11} color={colors.ink2} strokeWidth={2.5} />
              : state === 'lock' ? <Icon name="lock" size={11} color={colors.ink3} strokeWidth={2} />
              : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, marginHorizontal: 1.5 }} />}
            <Text style={{ fontSize: 12, color: state === 'now' ? colors.ink : colors.ink3, fontWeight: state === 'now' ? '500' : '400' }}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.hfCard, { bottom: 0, left: '6%', width: '72%', transform: [{ rotate: '-0.8deg' }], backgroundColor: colors.ink, borderColor: colors.ink }]}>
        <Text style={[styles.hfMono, { color: '#c3bdb5' }]}>quick check</Text>
        <Text style={{ marginVertical: 10, fontSize: 15, color: '#e6ded3' }}>What is 2.4 × 1.5?</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="check" size={12} color="#8fd19a" strokeWidth={2.5} />
          <Text style={[styles.hfMono, { color: '#8fd19a' }]}>18/5 — correct</Text>
        </View>
      </View>
    </View>
  );
}

function StripStat({ big, small, first }: { big: string; small: string; first?: boolean }) {
  return (
    <View style={[styles.stripStat, first && { borderLeftWidth: 0, paddingLeft: 0 }]}>
      <Text style={styles.stripBig}>{big}</Text>
      <Text style={styles.stripSmall}>{small}</Text>
    </View>
  );
}

function SectionHead({ kicker, title, lede }: { kicker: string; title: string; lede?: ReactNode }) {
  return (
    <View style={{ marginTop: space(18), marginBottom: space(6), maxWidth: 620, gap: space(2) }}>
      <Kicker style={{ marginBottom: 0 }}>{kicker}</Kicker>
      <Text style={styles.secTitle} role="heading" aria-level={2}>{title}</Text>
      {lede ? <Text style={styles.secLede}>{lede}</Text> : null}
    </View>
  );
}

const STRIPE_HUES = ['rgba(212,117,53,0.16)', 'rgba(56,120,140,0.16)', 'rgba(34,25,14,0.12)', 'rgba(150,62,120,0.13)'];

function Striped({ label, hue }: { label: string; hue: number }) {
  const c = STRIPE_HUES[hue % STRIPE_HUES.length];
  return (
    <View style={{ height: 88, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end', padding: 10,
      backgroundImage: `repeating-linear-gradient(135deg, ${c} 0 6px, transparent 6px 14px)` } as any}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink2, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: space(6), paddingBottom: space(12) },
  hero: { paddingTop: space(16), paddingBottom: space(14), gap: space(12) },
  heroMeta: { fontFamily: fonts.mono, color: colors.ink3, fontSize: 10.5, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: space(4) },
  heroTitle: { fontFamily: fonts.serif, color: colors.ink, letterSpacing: -1.6, fontWeight: '400' },
  heroEm: { fontStyle: 'italic', color: colors.accentInk },
  heroLede: { marginTop: 22, fontSize: 18, lineHeight: 28, color: colors.ink2, maxWidth: 520 },
  heroCta: { marginTop: 26, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  hfCard: { position: 'absolute', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 16, ...shadow.md },
  hfHd: { flexDirection: 'row', justifyContent: 'space-between' },
  hfMono: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink3 },
  hfChoice: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.paper2, borderWidth: 1, borderColor: colors.line, borderRadius: 999, fontSize: 12, fontFamily: fonts.mono, color: colors.ink },
  hfLi: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed' },
  strip: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 20, rowGap: 14 },
  stripStat: { flexGrow: 1, flexBasis: '24%', minWidth: 150, borderLeftWidth: 1, borderLeftColor: colors.line, borderStyle: 'dashed', paddingHorizontal: 18, gap: 2 },
  stripBig: { fontFamily: fonts.mono, fontSize: 24, color: colors.ink },
  stripSmall: { fontSize: 12, color: colors.ink3 },
  secTitle: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, color: colors.ink, letterSpacing: -0.4 },
  secLede: { fontSize: 16, lineHeight: 25, color: colors.ink2 },
  subjGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: colors.line, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden' },
  subj: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, gap: 10 },
  subjNum: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink4, letterSpacing: 1.3 },
  subjName: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  subjMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink3, minHeight: 30 },
  how: { borderTopWidth: 1, borderTopColor: colors.line },
  howStep: { flex: 1, paddingVertical: 26, paddingHorizontal: 24, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  stepN: { fontFamily: fonts.mono, fontSize: 11, color: colors.accentInk, letterSpacing: 1.3 },
  howH: { fontSize: 16, fontWeight: '600', color: colors.ink },
  howP: { fontSize: 14, lineHeight: 21, color: colors.ink2 },
  cta: { marginTop: space(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingVertical: 26, paddingHorizontal: 32, backgroundColor: colors.ink, borderRadius: radius.xl },
  ctaH: { fontFamily: fonts.serif, fontSize: 30, color: colors.paper },
  ctaP: { color: '#c3bdb5', marginTop: 6, fontSize: 14 },
  ctaBtn: { backgroundColor: colors.paper, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999 },
});
