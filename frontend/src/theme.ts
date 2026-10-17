/**
 * Design tokens adapted from the GED-Tutor stylesheet ("paper & ink" with a terracotta accent).
 * The oklch values from styles.css are converted to hex for React Native.
 */
export const colors = {
  // paper (backgrounds)
  paper: '#fbf6ee',
  paper2: '#f6efe5',
  paper3: '#f0e6db',
  // ink (text)
  ink: '#22190e',
  ink2: '#3f362c',
  ink3: '#6b6157',
  ink4: '#9e978f',
  // lines
  line: '#d6d0c9',
  lineStrong: '#bdb6ae',
  // accent — warm terracotta
  accent: '#d47535',
  accentSoft: '#f6e4d4',
  accentLine: '#ecc3a3',
  accentInk: '#a85924',

  // lavender accents from the course / lesson reference screens
  lav: '#eeecf4',
  lavSoft: '#f5f3fb',
  lavLine: '#c8c0e8',
  link: '#4b3f8f',

  // semantic aliases used across screens
  bg: '#fbf6ee',
  surface: '#fbf6ee',
  border: '#d6d0c9',
  text: '#22190e',
  muted: '#6b6157',
  primary: '#d47535',
  primaryDark: '#a85924',
  primarySoft: '#f6e4d4',
  success: '#38853e',
  successSoft: '#e4e8d9',
  successInk: '#1f5a26',
  danger: '#c5372f',
  dangerSoft: '#f6e3db',
  dangerInk: '#760909',
  warning: '#9a5b00',
  warningSoft: '#f8ecd2',
};

export const fonts = {
  serif: "'Newsreader', ui-serif, 'Iowan Old Style', Georgia, serif",
  sans: "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };

export const shadow = {
  sm: { boxShadow: '0 1px 2px rgba(34, 25, 14, 0.06)' } as any,
  md: { boxShadow: '0 8px 28px rgba(34, 25, 14, 0.10)' } as any,
};

export const space = (n: number) => n * 4;
