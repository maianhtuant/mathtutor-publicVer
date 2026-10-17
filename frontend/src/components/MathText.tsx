import { createElement, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import { colors } from '../theme';
import { splitMath } from '../mathSplit';

/** Plain text with **bold** spans (used for short emphasis in lesson content). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  return (
    <Text>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4
        ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>
        : <Text key={i}>{p}</Text>))}
    </Text>
  );
}

function renderLatex(tex: string, display = false): string {
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    trust: false, // no \href, \url, \htmlClass ... (no arbitrary HTML)
    strict: 'ignore',
    maxSize: 20,
    maxExpand: 200,
    output: 'html',
  });
}

export function MathText({ source, size = 16, color = colors.text }: { source: string; size?: number; color?: string }) {
  const segments = useMemo(() => splitMath(source ?? ''), [source]);
  return (
    <Text style={[styles.text, { fontSize: size, color }]}>
      {segments.map((s, i) =>
        s.math
          ? createElement('span', { key: i, dangerouslySetInnerHTML: { __html: renderLatex(s.text) } })
          : <RichText key={i} text={s.text} />,
      )}
    </Text>
  );
}

/** Pure LaTeX (no surrounding text), e.g. an answer option or formula. */
export function MathInline({ tex, size = 16 }: { tex: string; size?: number }) {
  return (
    <View>
      <Text style={{ fontSize: size, color: colors.text }}>
        {createElement('span', { dangerouslySetInnerHTML: { __html: renderLatex(tex) } })}
      </Text>
    </View>
  );
}

/** Multi-paragraph lesson body: blank lines separate paragraphs. */
export function MathParagraphs({ source }: { source: string }) {
  return (
    <View style={{ gap: 12 }}>
      {source.split(/\n\s*\n/).map((p, i) => (
        <MathText key={i} source={p.trim()} size={16} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { lineHeight: 26 },
});
