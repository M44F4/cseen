/*
 * Draws the figures of the README with cseen itself.
 *
 *   npm run readme:art
 *
 * GitHub shows an SVG through <img>, which runs no script and cannot see the page's CSS. So each figure is
 * rendered as a still (the end of its timeline), the stylesheet is copied into the file, and the three theme
 * colours are set on the figure. Every figure is written twice, light and dark; the README picks one with <picture>.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Scene, Timeline, ground, axes, line, plane, fadeIn, draw, stagger, renderStill,
  terminal, browser, cloud, dot, typeOn, moveTo, tween, wait, bars, stereoRig, flowchart,
} from '../src/all.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'img');
const css = readFileSync(join(root, 'src', 'theme', 'cseen.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();

const themes = {
  light: { ink: '#1f2328', bg: '#ffffff', accent: '#0d8f6b' },
  dark: { ink: '#e6edf3', bg: '#0d1117', accent: '#3ddc97' },
};

type Made = { s: Scene; tl?: Timeline };

const figures: Record<string, () => Made> = {
  // the logo laid on a sheet, seen from the isometric camera, in its own colours
  hero() {
    const s = new Scene({ view: 'iso' });
    s.add(ground({ extent: 3 }), ...([[-3, -3, 0], [3, -3, 0], [3, 3, 0], [-3, 3, 0]] as const).map((p, i, a) => line([...p], [...a[(i + 1) % 4]], { role: 'faint' })), axes({ at: [-2.75, -2.75, 0], length: 0.9 }));
    // the mark's own green and black, on a paper sheet so they read on light and dark pages alike
    const pad = 70, [x, y, w, h] = [-417.857, -482.5, 835.715, 956.25];
    const mark = readFileSync(join(root, 'site', 'src', 'brand', 'mark-color.svg'), 'utf8')
      .replace(/viewBox="[^"]*"/, `viewBox="${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}"`)
      .replace(/(<svg[^>]*>)/, `$1<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" rx="40" fill="#F7F3E8"/>`);
    const k = 4 / (h + 2 * pad);
    const sheet = s.add(plane({ svg: mark, size: [(w + 2 * pad) * k, 4], at: [-1.45, -2, 0], u: [1, 0, 0], v: [0, 1, 0], border: false }));
    const tl = new Timeline();
    tl.play(fadeIn(sheet, 0.8));
    tl.lockFit(s);
    return { s, tl };
  },

  // the scene of the README's example
  deploy() {
    const s = new Scene();
    s.add(ground());
    const term = s.add(terminal({ at: [-4, 0, 0], width: 3.6, title: 'zsh' }));
    const cmd = term.write(['$ git push', 'deploying...', 'done.']);
    s.add(cloud({ at: [0, 2.2, 2], size: 2.4 }));
    const site = s.add(browser({ at: [4, 1, 0], width: 3.4, url: 'my.app' }));
    const hello = site.write('Hello, world', { fontSize: 0.32 });
    const packet = s.add(dot([-3, -0.2, 1.4], { role: 'accent', r: 3.6 }));
    const tl = new Timeline();
    tl.play(typeOn(cmd, 2.2));
    tl.play(moveTo(packet, [-0.9, 2.2, 2.4], 1.3));
    tl.play(moveTo(packet, [3.2, 0.9, 1.2], 1.3));
    tl.play(fadeIn(hello, 0.8));
    tl.lockFit(s);
    return { s, tl };
  },

  chart() {
    const s = new Scene({ view: 'iso' });
    s.add(ground());
    const c = s.add(bars({
      data: { 2023: [12, 19, 7, 15], 2024: [14, 22, 11, 19] }, labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      title: 'Revenue', size: [4.4, 2.8], at: [-2.2, 0, 0], legend: 'top',
    }));
    c.set('grow', 0);
    const tl = new Timeline();
    tl.play(tween(c, { grow: 1 }, { duration: 1.6 }));
    tl.lockFit(s);
    return { s, tl };
  },

  flow() {
    const s = new Scene({ view: 'front', size: [420, 262], padding: 8 });
    const d = s.add(flowchart([
      { label: 'start', kind: 'start' },
      { label: 'signed in?', kind: 'decision', to: [['home', 'yes'], ['sign in', 'no']] },
      { label: 'sign in', to: ['signed in?'] },
      { label: 'home', kind: 'end' },
    ]));
    const tl = new Timeline();
    tl.play(stagger(0.5, ...d.edges.map((e) => draw(e, 0.7))));
    tl.lockFit(s);
    return { s, tl };
  },

  stereo() {
    const s = new Scene({ view: { yaw: 12, pitch: 58 } });
    s.add(ground());
    const rig = s.add(stereoRig({ baseline: 2.4, f: 1.5, point: [0.4, 4.2, 0.5] }));
    const tl = new Timeline();
    tl.play(wait(0.1));
    tl.lockFit(s);
    void rig;
    return { s, tl };
  },
};

function standalone(svg: string, t: { ink: string; bg: string; accent: string }, label: string): string {
  const vars = `.cseen{--cn-ink:${t.ink};--cn-bg:${t.bg};--cn-accent:${t.accent}}`;
  return svg
    .replace(/^<svg /, '<svg role="img" ')
    .replace(' aria-hidden="true"', ` aria-label="${label.replace(/"/g, '&quot;')}"`)
    .replace(/(<svg[^>]*>)/, `$1<style>${css}${vars}</style>`);
}

const labels: Record<string, string> = {
  hero: 'The cseen mark laid on a plane, seen from an isometric camera',
  deploy: 'A terminal, a cloud and a browser, with a packet travelling between them',
  chart: 'A bar chart of revenue by quarter for two years',
  flow: 'A flowchart that asks whether the user is signed in',
  stereo: 'A stereo rig: two cameras a baseline apart looking at one point',
};

mkdirSync(out, { recursive: true });
for (const [name, make] of Object.entries(figures)) {
  const { s, tl } = make();
  const svg = renderStill(s, tl);
  for (const [mode, t] of Object.entries(themes)) {
    writeFileSync(join(out, `${name}-${mode}.svg`), standalone(svg, t, labels[name]) + '\n');
  }
  console.log(name, `${(svg.length / 1024).toFixed(0)} kB`);
}
