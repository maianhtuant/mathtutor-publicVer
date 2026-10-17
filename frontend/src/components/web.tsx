import { createElement } from 'react';
import { Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

/** Inline SVG icons (stroke style from the GED-Tutor design). react-native-web renders DOM elements directly. */
const PATHS: Record<string, string> = {
  brand: 'M9 11h14M9 16h14M9 21h14',
  play: 'M7 5l12 7-12 7V5z',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M21 21l-4.35-4.35',
  lock: 'M8 11V8a4 4 0 018 0v3',
  practice: 'M6 5h12L11 12l7 7H6',
  send: 'M5 12l15-7-7 15-2-6-6-2z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.8 }: {
  name: keyof typeof PATHS | 'brandMark'; size?: number; color?: string; strokeWidth?: number;
}) {
  const vb = name === 'brandMark' ? '0 0 32 32' : '0 0 24 24';
  const children = [];
  if (name === 'brandMark') {
    children.push(createElement('circle', { key: 'c', cx: 16, cy: 16, r: 13 }));
    children.push(createElement('path', { key: 'p', d: PATHS.brand }));
  } else if (name === 'search') {
    children.push(createElement('circle', { key: 'c', cx: 11, cy: 11, r: 7 }));
    children.push(createElement('path', { key: 'p', d: PATHS.search }));
  } else if (name === 'lock') {
    children.push(createElement('rect', { key: 'r', x: 5, y: 11, width: 14, height: 9, rx: 1.5 }));
    children.push(createElement('path', { key: 'p', d: PATHS.lock }));
  } else if (name === 'play') {
    children.push(createElement('path', { key: 'p', d: PATHS.play, fill: color, stroke: 'none' }));
  } else {
    children.push(createElement('path', { key: 'p', d: PATHS[name] }));
  }
  return createElement('svg', {
    viewBox: vb, width: size, height: size, fill: 'none', stroke: color, strokeWidth,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, style: { display: 'block', flexShrink: 0 },
  }, ...children);
}

/** Client-side mirror of the backend VideoUrlParser, for previews in forms and course lessons. */
export function parseVideoUrl(url?: string | null): { provider: 'youtube' | 'vimeo' | 'unknown'; embedId: string | null } {
  const u = (url ?? '').trim();
  const yt = u.match(/youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{6,})/) || u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)
    || u.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
  if (yt) return { provider: 'youtube', embedId: yt[1] };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { provider: 'vimeo', embedId: vm[1] };
  return { provider: 'unknown', embedId: null };
}

export function embedUrlFor(url?: string | null): string | null {
  const p = parseVideoUrl(url);
  if (p.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${p.embedId}`;
  if (p.provider === 'vimeo') return `https://player.vimeo.com/video/${p.embedId}`;
  return null;
}

/** Responsive 16:9 player (".player"). Falls back to a link when the URL is not embeddable. */
export function VideoPlayer({ embedUrl, sourceUrl, title }: { embedUrl: string | null; sourceUrl?: string; title: string }) {
  return (
    <View style={[{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paper2 }, shadow.md]}>
      {embedUrl ? (
        createElement('iframe', {
          src: embedUrl, title,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin',
          style: { display: 'block', width: '100%', aspectRatio: '16 / 9', border: 0 },
        })
      ) : (
        <View style={{ aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Icon name="play" size={40} color={colors.ink4} />
          <Text style={{ color: colors.ink3, fontSize: 14 }}>
            Video unavailable{sourceUrl ? ' — ' : ''}
            {sourceUrl ? createElement('a', { href: sourceUrl, target: '_blank', rel: 'noopener noreferrer', style: { color: colors.accentInk } }, 'open on source site ↗') : null}
          </Text>
        </View>
      )}
    </View>
  );
}

export function useDocumentTitle(title: string) {
  if (typeof document !== 'undefined') document.title = title ? `${title} · MathTutor` : 'MathTutor';
}

/** Filled tree icons for the admin content tree (folder = subject, book = course, page = chapter). */
export function TreeIcon({ kind, size = 20 }: { kind: 'folder' | 'book' | 'page' | 'lesson'; size?: number }) {
  const el = createElement;
  let body;
  if (kind === 'folder') {
    body = [
      el('path', { key: 'b', d: 'M2.5 6.5a1.5 1.5 0 011.5-1.5h5l2 2h9a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 01-1.5 1.5H4a1.5 1.5 0 01-1.5-1.5z', fill: '#9aa6b5' }),
      el('path', { key: 'f', d: 'M4.5 10h17l-1.6 8.2a1.5 1.5 0 01-1.5 1.3H4a1.5 1.5 0 01-1.5-1.5L4 11.2A1.5 1.5 0 014.5 10z', fill: '#c7d0db' }),
    ];
  } else if (kind === 'book') {
    body = [
      el('rect', { key: 'b', x: 5, y: 3, width: 14, height: 18, rx: 1.5, fill: '#3f6fb5' }),
      el('rect', { key: 's', x: 5, y: 3, width: 3, height: 18, rx: 1, fill: '#2b5394' }),
      el('rect', { key: 'p', x: 9.5, y: 6, width: 7, height: 2, rx: 0.6, fill: '#a9c2e6' }),
    ];
  } else if (kind === 'page') {
    body = [
      el('path', { key: 'p', d: 'M6 2.5h8.5L19 7v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 20V4a1.5 1.5 0 011-1.5z', fill: '#e9e6e1', stroke: '#b9b3ab', strokeWidth: 1 }),
      el('path', { key: 'f', d: 'M14.5 2.5V7H19', fill: '#d4cfc8', stroke: '#b9b3ab', strokeWidth: 1 }),
      el('rect', { key: 'l', x: 8, y: 10, width: 6, height: 1.6, rx: 0.5, fill: '#b9b3ab' }),
    ];
  } else {
    body = [el('circle', { key: 'c', cx: 12, cy: 12, r: 3.5, fill: '#bdb6ae' })];
  }
  return el('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block', flexShrink: 0 } }, ...body);
}

/**
 * A question's figure (SVG drawn by the math-service). Shown through <img>, so nothing inside it can run;
 * the SVG has its own white background and scales down on narrow screens.
 */
export function Figure({ svg, maxWidth = 440 }: { svg?: string | null; maxWidth?: number }) {
  if (!svg) return null;
  return createElement('img', {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    alt: 'Figure for this question',
    style: { display: 'block', width: '100%', maxWidth, height: 'auto', margin: '8px 0', borderRadius: radius.md,
      border: `1px solid ${colors.line}` },
  });
}
