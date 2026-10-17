import { Fragment, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp } from 'react-native';

import { colors, fonts, radius, shadow, space } from '../theme';

export function Screen({ title, subtitle, kicker, actions, children, footer = true, wide }: {
  title?: string; subtitle?: string; kicker?: string; actions?: ReactNode; children: ReactNode; footer?: boolean;
  /** Wider content area for pages with a side panel next to a table. */
  wide?: boolean;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={[styles.inner, wide && { maxWidth: 1400 }]}>
        {title ? (
          <View style={styles.header}>
            <View style={{ flexShrink: 1 }}>
              {kicker ? <Kicker>{kicker}</Kicker> : null}
              <Text style={styles.h1} role="heading" aria-level={1}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {actions ? <View style={styles.row}>{actions}</View> : null}
          </View>
        ) : null}
        {children}
      </View>
      {footer ? <Footer /> : null}
    </ScrollView>
  );
}

export function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={{ color: colors.ink3, fontSize: 12, textAlign: 'center' }}>
        © MathTutor — learn math with lessons, practice and progress tracking.
      </Text>
    </View>
  );
}

/** Small uppercase mono label (".kicker" in the GED-Tutor stylesheet). */
export function Kicker({ children, color = colors.ink3, style }: { children: ReactNode; color?: string; style?: any }) {
  return <Text style={[styles.kicker, { color }, style]}>{children}</Text>;
}

/** "lessons / math / title" breadcrumb row. */
export function Crumbs({ items }: { items: { label: string; onPress?: () => void }[] }) {
  return (
    <View style={styles.crumbs}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
          {i > 0 ? <Text style={[styles.crumbText, { color: colors.ink4 }]}>/</Text> : null}
          {it.onPress
            ? <Pressable onPress={it.onPress}><Text style={styles.crumbText}>{it.label}</Text></Pressable>
            : <Text style={[styles.crumbText, i === items.length - 1 && { color: colors.ink }]} numberOfLines={1}>{it.label}</Text>}
        </View>
      ))}
    </View>
  );
}

/** Rounded pill tabs with optional counts (".pill-tab"). */
export function PillTabs<T extends string>({ tabs, value, onChange, small }: {
  tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }} role="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable key={t.value} role="tab" aria-selected={on} onPress={() => onChange(t.value)}
            style={({ hovered }: any) => [styles.pillTab, small && styles.pillTabSmall, on ? styles.pillTabOn : hovered ? { borderColor: colors.ink3 } : null]}>
            <Text style={[styles.pillTabText, small && { fontSize: 12.5 }, on && { color: colors.paper }]}>
              {t.label}
              {t.count != null ? <Text style={[styles.pillCount, on && { color: colors.paper }]}>  {t.count}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2} role="heading" aria-level={2}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ title, onPress, variant = 'primary', disabled, loading, small }: {
  title: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean; small?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed, hovered }: any) => [
        styles.button,
        small && styles.buttonSmall,
        styles[`btn_${variant}`],
        (pressed || hovered) && !off && styles[`btn_${variant}_active`],
        off && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={variant === 'primary' ? colors.paper : colors.ink} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 13 }, styles[`btnText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={[styles.field, style as any]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink4}
        {...props}
        aria-label={label}
        style={[styles.input, props.multiline && styles.inputMulti, error ? { borderColor: colors.danger } : null]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            aria-checked={o.value === value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, o.value === value && styles.chipOn]}
          >
            <Text style={[styles.chipText, o.value === value && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Checkbox({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={value} onPress={() => onChange(!value)} style={[styles.row, { marginBottom: space(3) }]}>
      <View style={[styles.box, value && styles.boxOn]}>{value ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'primary' }) {
  const map = {
    neutral: [colors.paper3, colors.ink3],
    success: [colors.successSoft, colors.successInk],
    danger: [colors.dangerSoft, colors.dangerInk],
    warning: [colors.warningSoft, colors.warning],
    primary: [colors.accentSoft, colors.accentInk],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function statusTone(status: string): 'neutral' | 'success' | 'danger' | 'warning' | 'primary' {
  switch (status) {
    case 'published': case 'active': case 'submitted': case 'completed': return 'success';
    case 'draft': case 'in_progress': return 'warning';
    case 'archived': case 'revoked': case 'blocked': case 'expired': return 'danger';
    default: return 'neutral';
  }
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} role="alert">
      <Text style={{ color: colors.dangerInk, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

export function Notice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.notice} role="status">
      <Text style={{ color: colors.successInk, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space(10), alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** Simple responsive table: header + rows of cells (scrolls horizontally when narrow). */
export function Table({ columns, rows, onRowPress, empty = 'No data yet.', wrapRow }: {
  /** A non-string title (e.g. a select-all checkbox) is rendered as is. */
  columns: { key: string; title: ReactNode; flex?: number; render?: (row: any) => ReactNode }[];
  rows: any[]; onRowPress?: (row: any) => void; empty?: string;
  /** Wraps each rendered row, e.g. in a draggable element. */
  wrapRow?: (row: any, node: ReactNode) => ReactNode;
}) {
  return (
    // width 100%: columns wrap to fit the card instead of growing to their widest content; below 640px it scrolls.
    <ScrollView horizontal contentContainerStyle={{ width: '100%' }}>
      <View style={{ flex: 1, minWidth: 640 }}>
        <View style={[styles.tr, styles.th]}>
          {columns.map((c) => (
            typeof c.title === 'string'
              ? <Text key={c.key} style={[styles.thText, { flex: c.flex ?? 1 }]}>{c.title}</Text>
              : <View key={c.key} style={{ flex: c.flex ?? 1 }}>{c.title}</View>
          ))}
        </View>
        {rows.length === 0 ? <Muted style={{ padding: space(3) }}>{empty}</Muted> : null}
        {rows.map((r, i) => {
          const node = (
          <Pressable key={r.id ?? i} disabled={!onRowPress} onPress={() => onRowPress?.(r)}
            style={({ hovered }: any) => [styles.tr, hovered && onRowPress ? { backgroundColor: colors.paper2 } : null]}>
            {columns.map((c) => (
              <View key={c.key} style={{ flex: c.flex ?? 1, paddingRight: space(2) }}>
                {c.render ? c.render(r) : <Text style={styles.text}>{r[c.key] == null ? '—' : String(r[c.key])}</Text>}
              </View>
            ))}
          </Pressable>
          );
          return wrapRow ? <Fragment key={r.id ?? i}>{wrapRow(r, node)}</Fragment> : node;
        })}
      </View>
    </ScrollView>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 160, minWidth: 140, alignItems: 'center', paddingVertical: space(5) }}>
      <Text style={styles.statValue}>{value}</Text>
      <Muted style={{ marginTop: space(1) }}>{label}</Muted>
    </Card>
  );
}

export function formatDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { paddingTop: space(8), paddingHorizontal: space(5), flexGrow: 1 },
  inner: { width: '100%', maxWidth: 1100, alignSelf: 'center', gap: space(5), flexGrow: 1, paddingBottom: space(10) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: space(3) },
  h1: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, fontWeight: '400', letterSpacing: -0.6, color: colors.ink },
  h2: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, fontWeight: '400', color: colors.ink, marginBottom: space(3) },
  subtitle: { color: colors.ink2, marginTop: space(2), fontSize: 16, lineHeight: 24, maxWidth: 640 },
  kicker: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: space(2) },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(1.5) },
  crumbText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.ink3 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space(5), paddingHorizontal: space(5), marginTop: 'auto' as any },
  text: { color: colors.ink, fontSize: 14, fontFamily: fonts.sans },
  muted: { color: colors.ink3, fontSize: 14, fontFamily: fonts.sans },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  card: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(6), ...shadow.sm },
  button: { flexDirection: 'row', gap: space(2), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', ...({ transitionDuration: '140ms' } as any) },
  buttonSmall: { paddingHorizontal: 12, paddingVertical: 5 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 14, fontWeight: '500', fontFamily: fonts.sans, letterSpacing: -0.07 },
  btn_primary: { backgroundColor: colors.ink, ...shadow.sm },
  btn_primary_active: { transform: [{ translateY: -1 }] },
  btnText_primary: { color: colors.paper },
  btn_secondary: { backgroundColor: 'transparent', borderColor: colors.lineStrong },
  btn_secondary_active: { backgroundColor: colors.paper2 },
  btnText_secondary: { color: colors.ink },
  btn_danger: { backgroundColor: 'transparent', borderColor: colors.danger },
  btn_danger_active: { backgroundColor: colors.dangerSoft },
  btnText_danger: { color: colors.danger },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_ghost_active: { backgroundColor: colors.paper2 },
  btnText_ghost: { color: colors.accentInk },
  field: { marginBottom: space(4), flexGrow: 1 },
  label: { fontSize: 13.5, fontWeight: '500', color: colors.ink, marginBottom: space(1.5), fontFamily: fonts.sans },
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: space(1.5), fontFamily: fonts.sans },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, color: colors.ink, backgroundColor: colors.paper, fontFamily: fonts.sans },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', fontFamily: fonts.mono, fontSize: 13.5 },
  errorText: { color: colors.danger, fontSize: 12.5, marginTop: space(1) },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper2 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink2, fontSize: 13, fontWeight: '500', fontFamily: fonts.sans },
  chipTextOn: { color: colors.paper },
  pillTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper2 },
  pillTabSmall: { paddingHorizontal: 13, paddingVertical: 5 },
  pillTabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillTabText: { color: colors.ink2, fontSize: 13.5, fontWeight: '500', fontFamily: fonts.sans },
  pillCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink4 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tick: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.sans },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: space(3), borderWidth: 1, borderColor: '#ebc0b6' },
  notice: { backgroundColor: colors.successSoft, borderRadius: radius.sm, padding: space(3), borderWidth: 1, borderColor: '#c4d2b6' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { backgroundColor: colors.paper2, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  thText: { fontSize: 12, fontWeight: '600', color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fonts.sans },
  statValue: { fontSize: 30, fontWeight: '400', color: colors.accent, fontFamily: fonts.mono },
});
