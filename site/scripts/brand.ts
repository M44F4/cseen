/*
 * Wraps a scene's svg so it stands on its own (used by the social card, scripts/og.mjs). The favicon is the logo: scripts/logo.mjs.
 * A standalone SVG has no page around it, so the stylesheet and the three theme variables go inside the file.
 */
import { readFileSync } from 'node:fs';
import { Scene, box } from '../../src/index.ts';
import { site } from '../src/config.ts';

const css = readFileSync(new URL('../../src/theme/cseen.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const light = { ink: '#0b0b0b', bg: '#f2f2f2', accent: '#00a86b' }, dark = { ink: '#f2f2f2', bg: '#0b0b0b', accent: '#1fd493' };
const vars = (p: typeof light) => `--cn-ink:${p.ink};--cn-bg:${p.bg};--cn-accent:${p.accent}`;

/** wraps a scene's svg so it draws correctly on its own, in light and dark */
export function standalone(svg: string, o: { background?: boolean; radius?: number } = {}): string {
  const style = `<style>${css} .cseen{${vars(light)}} @media (prefers-color-scheme: dark){.cseen{${vars(dark)}}}</style>`;
  const [, open, rest] = /^(<svg[^>]*>)([\s\S]*)$/.exec(svg)!;
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(open)!;
  const bg = o.background ? `<rect width="${vb[1]}" height="${vb[2]}" rx="${o.radius ?? 0}" fill="var(--c-bg)"/>` : '';
  return `${open}${style}${bg}${rest}`;
}

export function logoScene(): Scene {
  const s = new Scene({ size: [64, 64], padding: 9, fit: 'sphere', title: site.name });
  s.add(box({ at: [-0.2, 0, 0], size: [1.7, 1.7, 1.7], role: 'accent', fill: 0.5 }));
  s.add(box({ at: [1.5, -0.9, 0], size: [0.9, 0.9, 0.9] }));
  return s;
}

// the favicon is the cseen mark: node scripts/logo.mjs

