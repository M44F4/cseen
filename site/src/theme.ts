/**
 * Palettes for the docs. These belong to the site, not the library: the library only reads
 * --cn-ink, --cn-bg and --cn-accent and never names a theme.
 */
export interface Palette { ink: string; bg: string; accent: string; dark: boolean; /** the brand's own two logo colours, for a preset that has them */ logo?: [string, string] }

/** What the logo wears under a theme: two colours, or the one-colour logo in the ink. */
export interface LogoLook { a: string; b: string; mono: boolean }

/** A theme is a family with a light and a dark face, so the light/dark switch keeps the theme and changes only the face. */
export const THEMES: Record<string, { label: string; light: Palette; dark: Palette }> = {
  // the default: black and white with one green, which is the logo's two colours too
  cseen: {
    label: 'cseen',
    light: { ink: '#0b0b0b', bg: '#f2f2f2', accent: '#00a86b', dark: false },
    dark: { ink: '#f2f2f2', bg: '#0b0b0b', accent: '#1fd493', dark: true },
  },
  // the first palette of the project, kept as an option: dark emerald and antique gold, on warm paper by day and on deep emerald by night
  scribe: {
    label: 'Scribe',
    light: { ink: '#0e1f19', bg: '#f6f2e7', accent: '#9a7424', dark: false, logo: ['#064e3b', '#c4a052'] },
    dark: { ink: '#efe9d8', bg: '#07201a', accent: '#d2ae5e', dark: true, logo: ['#f4f1ea', '#c4a052'] },
  },
  sand: {
    label: 'Sand',
    light: { ink: '#3b2f22', bg: '#efe4cf', accent: '#c2410c', dark: false },
    dark: { ink: '#efe4cf', bg: '#1d1710', accent: '#f08a4b', dark: true },
  },
  ocean: {
    label: 'Ocean',
    light: { ink: '#0e1424', bg: '#eef3ff', accent: '#2f5fd0', dark: false },
    dark: { ink: '#dbe4ff', bg: '#0e1424', accent: '#7aa2ff', dark: true },
  },
  lime: {
    label: 'Lime',
    light: { ink: '#14210f', bg: '#f1f7e4', accent: '#4d7c0f', dark: false },
    dark: { ink: '#e6f2d0', bg: '#0f1a0a', accent: '#9bd44a', dark: true },
  },
};

/** hsl (degrees, percent, percent) to #rrggbb */
const hsl = (h: number, s: number, l: number) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * What makes a random palette its own: two hues. The light and the dark face of one seed share them.
 * Any three colours make a theme, so a random one proves nothing is tied to the presets.
 */
export interface Seed { h: number; a: number }
/** Two fresh hues: the base and the offset of the accent from it. */
export const randomSeed = (): Seed => ({ h: Math.random() * 360, a: (150 + Math.random() * 60) % 360 });
/** The light or dark face of a random palette. */
export function fromSeed({ h, a }: Seed, dark: boolean): Palette {
  return {
    bg: hsl(h, 30, dark ? 10 : 94),
    ink: hsl(h, 20, dark ? 92 : 12),
    accent: hsl((h + a) % 360, 70, dark ? 62 : 40),
    dark,
  };
}

/** WCAG relative luminance of #rrggbb */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** WCAG contrast ratio of two #rrggbb colours, 1 to 21 */
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/** Is this background dark enough that light text reads better on it? True below the luminance where black and white text have equal contrast. */
export const isDark = (hex: string) => lum(hex) < 0.179;

/**
 * Two colours from the theme for the logo's two roles: the ink and the accent. A preset may name its own pair.
 * If the accent is too close to the background to carry a mark (yellow on white), the logo drops to one colour,
 * the ink, which is the near-black or near-white of the theme; the one-colour artwork keeps the two roles apart with a thin gap.
 */
export function logoFor(p: Palette): LogoLook {
  if (p.logo) return { a: p.logo[0], b: p.logo[1], mono: false };
  if (contrast(p.accent, p.bg) < 2) return { a: p.ink, b: p.ink, mono: true };
  return { a: p.ink, b: p.accent, mono: false };
}
