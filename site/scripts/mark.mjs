/*
 * Draws the cseen logo and writes its four master SVGs into src/brand:
 *   node scripts/mark.mjs && node scripts/logo.mjs
 * mark-* is the cube alone and full-* is the cube with the word. Each comes in three colourings: -color for a light page
 * (black and green), -dark for a dark page (white and green) and -mono (one colour).
 * logo.mjs then builds the site's sprite and the favicon from the -color and -mono files.
 *
 * The logo is a cube seen from a corner. Each of its three faces is a letter, c on top and e on the two sides, and
 * the thin gaps between the faces are its edges: there is no outline. The word is set in the same letters, flat.
 * Letters are walks along a 3 x 3 grid of points in a unit square, drawn as filled rectangles with flat ends.
 *
 * Two roles, as in the rest of the site: A (the ink) and B (the accent). The c is B, so is the n of the word.
 * The accent is one green in each mode, the cseen theme's own: #00A86B on a light page and #1FD493 on a dark one.
 */
import { writeFileSync } from 'node:fs';

const LIGHT = { a: '#0B0B0B', b: '#00A86B' };    // for a light page: the theme's ink and accent
const DARK = { a: '#F2F2F2', b: '#1FD493' };     // for a dark page
const MONO = '#16130F';

// The numbers that set the look.
const R = 500;                              // from the middle of the cube to a corner, which is also the side of the cube as drawn
const T = 0.18;                             // thickness of a stroke, as a share of the letter
const FACE_GAP = 0.035;                     // space at the edge of each face, as a share of the face (the gaps are twice this)
// The spacing is measured on the letters. The two ends of the c are 1 - T apart, centre to centre of its bars: call that D.
// The cube stands D from the c, and the letters stand D / 2 apart, which is also the distance between the bars of the s.
const D = 1 - T;

const hw = T / 2, a = hw, b = 0.5, z = 1 - hw;
const walks = {
  c: [[1, a], [a, a], [a, z], [1, z]],
  s: [[1, a], [a, a], [a, b], [z, b], [z, z], [0, z]],
  e: [[a, b], [z, b], [z, a], [a, a], [a, z], [1, z]],
  n: [[a, 1], [a, a], [z, a], [z, 1]],
};
/** The rectangles of a walk. A stroke runs on through the corner at a joint and stops flat at the two ends. */
function strokes(pts) {
  return pts.slice(1).map((q, i) => {
    const p = pts[i];
    const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    const s0 = [p[0] - (i > 0 ? dx * hw : 0), p[1] - (i > 0 ? dy * hw : 0)];
    const s1 = [q[0] + (i < pts.length - 2 ? dx * hw : 0), q[1] + (i < pts.length - 2 ? dy * hw : 0)];
    const nx = dy !== 0 ? hw : 0, ny = dx !== 0 ? hw : 0;
    const x0 = Math.min(s0[0], s1[0]) - nx, x1 = Math.max(s0[0], s1[0]) + nx;
    const y0 = Math.min(s0[1], s1[1]) - ny, y1 = Math.max(s0[1], s1[1]) + ny;
    // every rectangle is written the same way round, so where two overlap they merge
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  });
}
const rad = (d) => (d * Math.PI) / 180;
const num = (n) => String(Math.round(n * 1000) / 1000);
const all = [];                              // every point drawn, for the box
/** a letter, after a map from its unit square to the page, as one path */
function letter(name, map) {
  return strokes(walks[name]).map((rect) => {
    const pts = rect.map(map);
    all.push(...pts);
    return 'M' + pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L') + 'Z';
  }).join('');
}

// The cube, seen from a corner, the middle of it at the origin.
const v = [90, 30, -30, -90, -150, 150].map((deg) => [R * Math.cos(rad(deg)), -R * Math.sin(rad(deg))]);
const mid = [0, 0];
const sub = (p, q) => [q[0] - p[0], q[1] - p[1]];
/** a letter on a face: origin + u * U + v * V, after turning it by quarter turns and leaving a gap at the edges */
const onFace = (name, o, U, V, turn = 0) => {
  const rot = (p) => { let q = p; for (let i = 0; i < turn; i++) q = [1 - q[1], q[0]]; return [FACE_GAP + q[0] * (1 - 2 * FACE_GAP), FACE_GAP + q[1] * (1 - 2 * FACE_GAP)]; };
  return letter(name, (p) => { const [u, w] = rot(p); return [o[0] + u * U[0] + w * V[0], o[1] + u * U[1] + w * V[1]]; });
};
const cube = [
  { id: 'cube-c', role: 'b', d: onFace('c', v[5], sub(v[5], v[0]), sub(v[5], mid), 1) },     // top: follows the face, turned a quarter
  { id: 'cube-e-left', role: 'a', d: onFace('e', v[5], sub(v[5], mid), sub(v[5], v[4])) },   // left face, upright
  { id: 'cube-e-right', role: 'a', d: onFace('e', mid, sub(mid, v[1]), sub(mid, v[3])) },    // right face, upright
];
const cubeBox = boxOf(all);
// The word, in the same letters, flat: each letter is a square as high as the side of the cube, level with the side faces.
const right = v[1][0], H = R, space = D / 2, x0 = right + D * H;
const word = [...'cseen'].map((ch, i) => ({
  id: `word-${i}-${ch}`, role: ch === 'c' || ch === 'n' ? 'b' : 'a',
  d: letter(ch, ([u, w]) => [x0 + i * H * (1 + space) + u * H, -H / 2 + w * H]),
}));
const fullBox = boxOf(all);

function boxOf(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  return { x, y, w, h, attr: `${num(x)} ${num(y)} ${num(w)} ${num(h)}` };
}

const path = (s, pal) => `<path id="${s.id}"${pal ? ` fill="${pal[s.role]}"` : ''} d="${s.d}"/>`;
function doc({ box, title, desc, mono, pal, parts }) {
  const body = parts.map(([id, shapes]) => `    <g id="${id}">\n${shapes.map((s) => '      ' + path(s, mono ? null : pal)).join('\n')}\n    </g>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.attr}" width="${num(box.w)}" height="${num(box.h)}" role="img" aria-labelledby="t d">
  <title id="t">${title}</title>
  <desc id="d">${desc}</desc>
  <g id="logo"${mono ? ` fill="${MONO}"` : ''}>
${body}
  </g>
</svg>
`;
}

const what = 'A cube seen from a corner: its three faces are the letters c, e and e, and the thin gaps between them are its edges.';
const wordNote = 'The word is set in the same letters, flat.';
const lightNote = `Black ${LIGHT.a} and green ${LIGHT.b}, for a light page.`;
const darkNote = `White ${DARK.a} and green ${DARK.b}, for a dark page.`;
const monoNote = `Single colour ${MONO}. The two colours of the full-colour logo are separated by the thin gaps between the faces.`;
const cubeParts = [['mark', cube]], fullParts = [['mark', cube], ['word', word]];
const files = {
  'mark-color': doc({ box: cubeBox, title: 'cseen mark', desc: `cseen mark. ${lightNote} ${what}`, pal: LIGHT, parts: cubeParts }),
  'mark-dark': doc({ box: cubeBox, title: 'cseen mark, for a dark page', desc: `cseen mark. ${darkNote} ${what}`, pal: DARK, parts: cubeParts }),
  'mark-mono': doc({ box: cubeBox, title: 'cseen mark, near-black', desc: `cseen mark, near-black. ${monoNote} ${what}`, mono: true, parts: cubeParts }),
  'full-color': doc({ box: fullBox, title: 'cseen', desc: `cseen. ${lightNote} ${what} ${wordNote}`, pal: LIGHT, parts: fullParts }),
  'full-dark': doc({ box: fullBox, title: 'cseen, for a dark page', desc: `cseen. ${darkNote} ${what} ${wordNote}`, pal: DARK, parts: fullParts }),
  'full-mono': doc({ box: fullBox, title: 'cseen, near-black', desc: `cseen, near-black. ${monoNote} ${what} ${wordNote}`, mono: true, parts: fullParts }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(`../src/brand/${name}.svg`, import.meta.url), svg);
console.log(`wrote src/brand/{mark,full}-{color,dark,mono}.svg (mark ${num(cubeBox.w)} x ${num(cubeBox.h)}, full ${num(fullBox.w)} x ${num(fullBox.h)})`);
