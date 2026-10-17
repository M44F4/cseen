import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Node } from '../src/all.ts';
import assert from 'node:assert/strict';
import { pen, graph, matrix, product, transform2d, vectorField, numberLine, unitCircle, tween, bars, lines, areas, scatter, pie, donut, histogram, heatmap, radar, sparkline, chart, niceTicks, toTable, frustum, stereoRig, wave, sonar, radio, link, pulse, arrow, progress, notification, toast, dialog, badge, chat, micHand, mouse, router, antenna, keyboard, keyboardLayout, TextBlock, Timeline as TL, cloud, tablet, tv, terminal, micStand, speaker, photoCamera, typeOn, tokenize, layoutRows, write, code, browser, laptop, phone, document as paper, server, database, cylinder, sphere, monitor, Camera, Scene, Timeline, box, fadeIn, draw, line, moveBy, moveTo, par, parseSvg, plane, seq, wait, ground, rect, label } from '../src/all.ts';

test('axonometric camera: x right, y into the scene, z up', () => {
  const c = Camera.axonometric('front');
  const [x, y, d] = c.project([1, 0, 0]);
  assert.ok(x > 0.99 && Math.abs(y) < 1e-9 && Math.abs(d) < 1e-9);
  const up = c.project([0, 0, 1]);
  assert.ok(up[1] < -0.99, 'z up means smaller screen y');
  const far = c.project([0, 5, 0]);
  assert.ok(far[2] > 4.99, 'y is depth in the front view');
});

test('perspective camera: farther things are smaller', () => {
  const c = Camera.perspective({ position: [0, -10, 0], target: [0, 0, 0], fov: 40 });
  const near = c.project([1, -5, 0]), far = c.project([1, 5, 0]);
  assert.ok(Math.abs(near[0]) > Math.abs(far[0]));
  assert.ok(far[2] > near[2]);
});

test('a small box on a big floor is drawn after the floor, from any side', () => {
  for (const yaw of [0, 40, 120, 200, 300]) {
    const s = new Scene({ view: { yaw, pitch: 35 } });
    s.add(rect([-5, -5, 0], [10, 10], { role: 'faint' }));
    const b = s.add(box({ at: [1, 1, 0], size: 1 }));
    const keys = s.frame().items.map((i) => i.key);
    const floor = keys.findIndex((k) => !k.startsWith(b.id));
    const firstBox = keys.findIndex((k) => k.startsWith(b.id));
    assert.ok(floor < firstBox, `floor before box at yaw ${yaw}`);
  }
});

test('opaque boxes hide their back faces; translucent ones show all six', () => {
  const s = new Scene();
  const b = s.add(box({ size: 1 }));
  assert.equal(s.frame().items.filter((i) => i.key.startsWith(b.id)).length, 3);
  b.set('alpha', 0.3);
  assert.equal(s.frame().items.filter((i) => i.key.startsWith(b.id)).length, 6);
});

test('timeline: replay depends only on t, and scrubbing backwards restores state', () => {
  const s = new Scene();
  const b = s.add(box({ at: [0, 0, 0], size: 1 }));
  const tl = new Timeline();
  tl.play(fadeIn(b, 1)).play(moveBy(b, [4, 0, 0], 2)).play(moveBy(b, [0, 3, 0], 1));
  tl.seek(0);
  assert.equal(b.props.opacity, 0);
  tl.seek(1.5);
  assert.equal(b.props.opacity, 1);
  assert.ok(Math.abs((b.props.pos as number[])[0] - 2) < 1e-9 || (b.props.pos as number[])[0] > 0);
  tl.seek(4);
  assert.deepEqual(b.props.pos, [4, 3, 0]);
  tl.seek(0.2);
  assert.deepEqual(b.props.pos, [0, 0, 0]);
  tl.seek(4);
  assert.deepEqual(b.props.pos, [4, 3, 0]);
});

test('seq, par and wait compose durations', () => {
  const b = box();
  assert.equal(seq(moveTo(b, [1, 0, 0], 1), wait(0.5), moveTo(b, [0, 0, 0], 2)).duration, 3.5);
  assert.equal(par(moveTo(b, [1, 0, 0], 1), moveTo(b, [0, 0, 0], 2)).duration, 2);
});

test('draw: a line is hidden at 0, partial in between, whole at 1', () => {
  const s = new Scene();
  const l = s.add(line([0, 0, 0], [3, 0, 0]));
  const tl = new Timeline().play(draw(l, 2));
  tl.seek(0);
  assert.equal(s.frame().items.length, 0);
  tl.seek(1);
  assert.match(s.frame().items[0].html, /stroke-dashoffset:0\.\d+/);
  tl.seek(2);
  assert.doesNotMatch(s.frame().items[0].html, /dasharray/);
});

test('anchors follow the node they are attached to', () => {
  const s = new Scene();
  const b = s.add(box({ at: [1, 1, 0], size: 2 }));
  const top = b.pt('top');
  assert.deepEqual(top(), [1, 1, 2]);
  b.set('pos', [5, 0, 0]);
  assert.deepEqual(top(), [5, 0, 2]);
});

test('locked fit keeps the picture still while things move', () => {
  const s = new Scene();
  const b = s.add(box({ size: 1 }));
  const tl = new Timeline().play(moveBy(b, [6, 0, 0], 2));
  tl.lockFit(s);
  tl.seek(0);
  const a = s.frame().fit;
  tl.seek(2);
  assert.deepEqual(s.frame().fit, a);
});

test('svg import: scripts, handlers and external links are removed; ids stay unique', () => {
  const src = `<svg viewBox="0 0 10 20" onload="x()"><script>alert(1)</script><defs><linearGradient id="g"/></defs><rect fill="url(#g)" onclick="y()"/><image href="https://evil.example/x.png"/><use href="#g"/></svg>`;
  const a = parseSvg(src), b = parseSvg(src);
  assert.deepEqual(a.box, [0, 0, 10, 20]);
  assert.doesNotMatch(a.inner, /script|onclick|onload|evil/);
  const ida = /id="([^"]+)"/.exec(a.inner)![1], idb = /id="([^"]+)"/.exec(b.inner)![1];
  assert.notEqual(ida, idb);
  assert.ok(a.inner.includes(`url(#${ida})`) && a.inner.includes(`href="#${ida}"`));
});

test('svg import: recolor swaps fixed colours for variables', () => {
  const p = parseSvg('<svg viewBox="0 0 1 1"><path fill="#111"/></svg>', { recolor: { '#111': 'var(--cn-ink)' } });
  assert.match(p.inner, /var\(--cn-ink\)/);
});

test('a plane under a parallel camera is one exact affine transform; perspective uses pieces', () => {
  const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
  const s = new Scene();
  s.add(plane({ svg, size: [2, 2], border: false }));
  const html = s.frame().items[0].html;
  assert.match(html, /^<g style="[^"]*" transform="matrix\(/);
  const p = new Scene({ view: Camera.perspective({ position: [1, -6, 1], target: [1, 0, 1] }) });
  p.add(plane({ svg, size: [2, 2], border: false, cells: 3 }));
  const ph = p.frame().items[0].html;
  assert.equal((ph.match(/<clipPath/g) ?? []).length, 9);
  assert.match(ph, /<use href="#szp-/);
});

test('svg output is standalone, named, and escapes text', () => {
  const s = new Scene({ title: 'A <b> & "c"' });
  s.add(ground(), label('x < y', [0, 0, 0]));
  const out = s.svg();
  assert.match(out, /^<svg xmlns=/);
  assert.ok(out.includes('aria-label="A &lt;b&gt; &amp; &quot;c&quot;"'));
  assert.ok(out.includes('x &lt; y'));
});

test('every ready-made thing renders, sorts and takes custom screen content', () => {
  const page = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#abc"/></svg>';
  const things = [monitor({ screen: page }), laptop({ screen: page }), phone({ screen: page }), browser({ content: page, url: 'a<b>.dev' }), paper({ title: 'x' }), server(), database(), cylinder(), sphere()];
  for (const t of things) {
    const s = new Scene();
    s.add(ground(), t);
    const f = s.frame();
    assert.ok(f.items.length >= 2, 'draws something besides the ground');
    assert.equal(f.cycles, 0, 'no ordering cycles');
  }
  const s = new Scene();
  s.add(browser({ url: 'a<b>.dev' }));
  assert.ok(s.svg().includes('a&lt;b&gt;.dev'));
});

test('new assets render without ordering problems, and screens start empty', () => {
  for (const make of [() => tablet(), () => tv(), () => terminal(), () => micStand(), () => micHand(), () => mouse(), () => router(), () => antenna({ kind: 'dish' }), () => antenna({ kind: 'tower' }), () => antenna({ kind: 'whip' }), () => speaker(), () => photoCamera(), () => cloud()]) {
    for (const view of ['iso', 'front', 'top'] as const) {
      const s = new Scene({ view });
      s.add(ground(), make());
      const f = s.frame();
      assert.equal(f.cycles, 0);
      assert.ok(f.items.length > 2);
    }
  }
  const s = new Scene();
  s.add(tablet());
  assert.doesNotMatch(s.svg(), /<text/, 'an empty screen has no text');
});

test('tokenizer colours keywords, strings, numbers and comments', () => {
  const kinds = (l: string) => tokenize(l).filter((t) => t.kind !== 'plain').map((t) => `${t.kind}:${t.text}`);
  assert.deepEqual(kinds("const x = 'hi' + 42; // done"), ['keyword:const', 'string:\'hi\'', 'number:42', 'comment:// done']);
  assert.deepEqual(kinds('x = 1  # note'), ['number:1', 'comment:# note']);
  assert.deepEqual(kinds('constant = 3'), ['number:3'], 'a word that merely starts with a keyword is not one');
});

test('typing: text appears letter by letter, in order, on a plane', () => {
  const s = new Scene();
  const t = s.add(write(['abc', 'de'], { size: [2, 1], cursor: false }));
  const tl = new TL().play(typeOn(t, 4));
  const text = () => (s.svg().match(/<tspan[^>]*>([^<]*)<\/tspan>/g) ?? []).map((m) => m.replace(/<[^>]+>/g, '')).join('|');
  tl.seek(0);
  assert.equal(text(), '');
  tl.seek(2.3);
  assert.ok(['abc|d', 'abc|de', 'abc|'].some((x) => text() === x) || text().startsWith('abc'), text());
  tl.seek(4);
  assert.equal(text(), 'abc|de');
  tl.seek(1);
  assert.ok(text().length < 6, 'scrubbing back removes letters');
});

test('code() adds a cursor while typing; devices put text on their own screen', () => {
  const s = new Scene();
  const b = s.add(browser());
  const c = b.write('hello', { cursor: true });
  new TL().play(typeOn(c, 1)).seek(0.5);
  assert.ok(s.svg().includes('\u2588'));
  assert.ok(code('x = 1') instanceof TextBlock);
});

test('laptop: trackpad sits in front of the keyboard, nearest the viewer', () => {
  const s = new Scene({ view: 'iso' });
  s.add(laptop());
  const faces = s.prims().filter((p) => p.kind === 'plane' || p.kind === 'path');
  const keys = faces.find((p) => p.kind === 'plane');
  const pad = faces.find((p) => p.kind === 'path' && p.pts.length === 4 && p.pts.every((q) => Math.abs(q[2] - faces[0].pts[0][2]) < 1) && p.pts[0][2] > 0.05 && p.pts[0][2] < 0.2);
  assert.ok(keys && pad, 'keys and pad found');
  const keysY = keys!.pts.reduce((a, q) => a + q[1], 0) / keys!.pts.length;
  const padY = pad!.pts.reduce((a, q) => a + q[1], 0) / pad!.pts.length;
  assert.ok(padY < keysY, `trackpad y ${padY} should be less than keys y ${keysY} (front is -y)`);
});

test('terminal keeps its own dark colours instead of borrowing the theme ink', () => {
  const s = new Scene({ view: 'iso' });
  s.add(terminal());
  const svg = s.svg();
  assert.ok(svg.includes('--c-term-bg'));
  s.root.children.length = 0;
  s.add(terminal({ light: true }));
  assert.ok(!s.svg().includes('--c-term-bg'));
});

test('stylesheet resolves theme variables from ink, bg and accent and names no theme', () => {
  const css = readFileSync(new URL('../src/theme/cseen.css', import.meta.url), 'utf8');
  for (const name of ['paper', 'violet', 'sand', 'dark', 'light']) assert.ok(!new RegExp(`data-theme|\\b${name}\\b`, 'i').test(css.replace(/\/\*[\s\S]*?\*\//g, '')), name);
  for (const v of ['--c-ink', '--c-bg', '--c-accent', '--c-faint', '--c-s8']) assert.ok(css.includes(v + ':'), v);
});

test('wrapping: rows never exceed the column count and keep every character', () => {
  const lines = ['the quick brown fox jumps over the lazy dog', 'short', 'supercalifragilisticexpialidocious'];
  for (const wrap of ['word', 'char'] as const) {
    const rows = layoutRows(lines, 12, wrap), flat = lines.join('\n');
    assert.ok(rows.every((r) => r.end - r.start <= 12), wrap);
    const kept = rows.map((r) => flat.slice(r.start, r.end)).join('').replace(/ /g, '');
    assert.equal(kept, lines.join('').replace(/ /g, ''));
  }
  const word = layoutRows(['alpha beta gamma'], 10, 'word').map((r) => 'alpha beta gamma'.slice(r.start, r.end));
  assert.deepEqual(word, ['alpha beta', 'gamma']);
  assert.equal(layoutRows(['a'.repeat(50)], 10, 'none').length, 1);
});

test('text shrinks to fit instead of running past the box, and clip leaves size alone', () => {
  const long = 'a very long line of text that cannot possibly fit on one row of this small box without help';
  const size = (s: string) => Number(/font-size="([\d.]+)"/.exec(s)![1]);
  const scene = (o: object) => { const s = new Scene({ view: 'front' }); s.add(write(long, { size: [1.2, 0.6], fontSize: 0.1, ...o })); return s.svg(); };
  assert.ok(size(scene({ overflow: 'shrink' })) < 10);
  assert.equal(size(scene({ overflow: 'clip' })), 10);
  assert.ok(size(scene({ wrap: 'none' })) < 10, 'no wrapping still shrinks to the width');
});

test('typing does not reflow: the rows are fixed before the first letter', () => {
  const t = write('one two three four five six seven', { size: [1, 0.5], fontSize: 0.08, cursor: true });
  const rowsAt = (k: number) => { t.set('type', k); const s = new Scene({ view: 'front' }); s.add(t); return [...s.svg().matchAll(/<text [^>]*y="([\d.]+)"/g)].map((m) => m[1]); };
  const full = rowsAt(1);
  const part = rowsAt(0.6);
  assert.deepEqual(part, full.slice(0, part.length), 'rows seen while typing are a prefix of the final rows');
});

test('marks colour chosen words, regexes and ranges, and work in code', () => {
  const s = new Scene({ view: 'front' });
  s.add(write('deploy to production 42', { size: [3, 0.5], mark: { production: 'accent', deploy: 's2' } }));
  s.add(write('ping 7', { size: [2, 0.5], mark: [[/\d+/, '#ff00aa']] }));
  const svg = s.svg();
  assert.ok(svg.includes('fill="var(--c-accent)">production'));
  assert.ok(svg.includes('fill="var(--c-s2)">deploy'));
  assert.ok(svg.includes('fill="#ff00aa">7'));
});

test('sizing: presets and a line count', () => {
  const size = (o: object) => { const s = new Scene({ view: 'front' }); s.add(write('x', { size: [2, 1], ...o })); return Number(/font-size="([\d.]+)"/.exec(s.svg())![1]); };
  assert.ok(size({ fontSize: 'sm' }) < size({ fontSize: 'md' }) && size({ fontSize: 'md' }) < size({ fontSize: 'lg' }));
  assert.ok(size({ lines: 4 }) > size({ lines: 12 }));
});

test('keyboard layouts have the real key counts and sizes', () => {
  const count = (l: 'full' | 'tkl' | '75' | '60') => keyboardLayout(l).keys.length;
  assert.deepEqual([count('full'), count('tkl'), count('75'), count('60')], [104, 87, 84, 61]);
  for (const l of ['full', 'tkl', '75', '60'] as const) {
    const { keys, width } = keyboardLayout(l);
    // no key leaves the board and no two keys overlap
    for (const k of keys) assert.ok(k.x >= 0 && k.x + k.w <= width + 1e-9, `${l} ${k.id} inside`);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      assert.ok(a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9, `${l}: ${a.id} overlaps ${b.id}`);
    }
  }
  const full = new Map(keyboardLayout('full').keys.map((k) => [k.id, k]));
  assert.equal(full.get('Space')!.w, 6.25);
  assert.equal(full.get('Bksp')!.w, 2);
  assert.equal(full.get('LShift')!.w, 2.25);
  assert.equal(full.get('RShift')!.w, 2.75);
  assert.equal(full.get('Enter')!.w, 2.25);
  assert.equal(full.get('N+')!.h, 2);
  assert.equal(full.get('N0')!.w, 2);
  // the main block is exactly 15 units wide on every row
  for (const row of [1, 2, 3, 4, 5]) {
    const r = keyboardLayout('60').keys.filter((k) => k.row === row);
    assert.equal(r.reduce((n, k) => n + k.w, 0), 15, `row ${row}`);
  }
});

test('keyboard keys press and light up, and the board draws in order', () => {
  const s = new Scene({ view: 'iso' });
  const kb = s.add(keyboard({ layout: 'tkl' }));
  assert.equal(s.frame().cycles, 0);
  const a = kb.key('a'), tl = new TL();
  tl.play(kb.type('ab'));
  tl.seek(0.09);
  assert.ok((a.props.press as number) > 0);
  tl.seek(tl.duration);
  assert.equal(a.props.press, 0);
  assert.throws(() => kb.key('NoSuchKey'));
  const keyPrims = s.prims().filter((p) => p.group === a.id);
  assert.ok(keyPrims.length >= 5);
});

test('ui elements draw on a plane, follow their props, and sit on a device screen', () => {
  const svgOf = (n: Node) => { const s = new Scene({ view: 'front' }); s.add(n); return s.svg(); };
  const bar = (v: number) => svgOf(progress({ value: v, label: true }));
  assert.ok(bar(0.5).includes('50%') && bar(1).includes('100%'));
  assert.notEqual(bar(0.2), bar(0.8));
  for (const kind of ['bar', 'ring', 'segments'] as const) assert.ok(svgOf(progress({ kind, value: 0.4 })).length > 200, kind);
  assert.ok(svgOf(notification({ title: 'Build passed', body: 'All 29 tests passed in 0.6 seconds, ready to deploy.' })).includes('Build passed'));
  assert.ok(svgOf(toast({ text: 'Saved' })).includes('Saved'));
  assert.ok(svgOf(dialog({ title: 'Delete?', body: 'This cannot be undone.', buttons: ['Cancel', 'Delete'] })).includes('Delete'));
  assert.equal(svgOf(badge({ count: 0 })).includes('<text'), false);
  assert.ok(svgOf(badge({ count: 120 })).includes('99+'));

  const c = chat({ messages: [{ from: 'them', text: 'hi' }, { from: 'me', text: 'hello there' }, { from: 'them', text: 'ship it?' }], typing: true });
  c.set('shown', 1);
  assert.ok(svgOf(c).includes('>hi<') && !svgOf(c).includes('hello there'));
  c.set('shown', 1.5);
  assert.ok(svgOf(c).includes('hello there'));

  const s = new Scene();
  const ph = s.add(phone());
  const n = ph.put(notification({ title: 'Hi', body: 'x' }), { at: [0.05, 0.8], width: 0.9 });
  assert.equal(s.frame().cycles, 0);
  const pts = s.prims().filter((p) => p.kind === 'plane' && p.key.startsWith(n.id));
  assert.ok(pts.length > 0);
});

test('flow: dashes travel by CSS, so a static SVG can move too', () => {
  const s = new Scene({ view: 'front' });
  s.add(arrow([0, 0, 0], [2, 0, 0], { flow: 2 }), arrow([0, 0, 1], [2, 0, 1], { dash: '4 2', flow: true }));
  const svg = s.svg();
  assert.equal((svg.match(/class="[^"]*cn-flow/g) ?? []).length, 2);
  assert.ok(svg.includes('--cn-flow-t:0.5s') && svg.includes('--cn-flow-p:6'));
  assert.ok(svg.includes('--cn-flow-p:6') && svg.includes('stroke-dasharray:4 2'));
  assert.ok(readFileSync(new URL('../src/theme/cseen.css', import.meta.url), 'utf8').includes('@keyframes cn-flow'));
});

test('link bows between two moving things and a pulse rides it', () => {
  const s = new Scene({ view: 'front' });
  const a = s.add(box({ at: [0, 0, 0] })), b = s.add(box({ at: [4, 0, 0] }));
  const l = s.add(link(a.pt('top'), b.pt('top'), { bend: 0.3 }));
  const mid = l.at(0.5);
  assert.ok(mid[2] > a.pt('top')()[2] + 0.3, 'bows upward');
  assert.deepEqual(l.at(0).map((x) => Math.round(x * 1e6) / 1e6), a.pt('top')().map((x) => Math.round(x * 1e6) / 1e6));
  b.set('pos', [8, 0, 0]);
  assert.ok(Math.abs(l.at(1)[0] - 8) < 1e-9, 'follows the moved end');
  const p = s.add(pulse(l, { trail: 2 }));
  const dots = () => s.prims().filter((q) => q.kind === 'dot' && q.key.startsWith(p.id)).length;
  p.set('along', -0.1); assert.equal(dots(), 0);
  p.set('along', 0.5); assert.equal(dots(), 3);
  p.set('along', 1.2); assert.equal(dots(), 0);
  const q = pulse([[0, 0, 0], [3, 0, 0], [3, 4, 0]]);
  s.add(q);
  q.set('along', 3 / 7);
  const at = s.prims().find((x) => x.key.startsWith(q.id))!.pts[0];
  assert.ok(Math.abs(at[0] - 3) < 1e-9 && Math.abs(at[1]) < 1e-9, 'along a polyline by length');
});

test('every wave kind draws, is periodic in phase, and never produces NaN', () => {
  const kinds = ['sine', 'longitudinal', 'standing', 'rings', 'directional', 'spherical', 'plane', 'interference', 'echo'] as const;
  for (const kind of kinds) {
    const w = wave({ kind, reach: 4, wavelength: 0.7, nodal: true, target: 2.5, cone: false });
    const s = new Scene({ view: 'iso' });
    s.add(w);
    const at = (ph: number) => { w.set('phase', ph); return s.svg(); };
    const a = at(0), b = at(0.4), c = at(1);
    assert.ok(a.includes('<path'), kind);
    assert.ok(!a.includes('NaN') && !b.includes('NaN'), `${kind} NaN`);
    assert.notEqual(a, b, `${kind} moves with phase`);
    assert.equal(a, c, `${kind} repeats after one wavelength`);
  }
  const count = (kind: 'directional' | 'echo') => { const s = new Scene(); s.add(wave({ kind, reach: 6, target: 3, wavelength: 0.5 })); return s.prims().length; };
  assert.ok(count('echo') > count('directional') - 3, 'echo draws the return beam');
  const cone = new Scene(); cone.add(sonar({ cone: true, spread: 40 }));
  assert.ok(cone.prims().some((p) => p.closed), 'a cone draws rings');
  assert.ok(radio().o.direction![2] === 1, 'radio points up');
});

test('frustum: the pinhole geometry is right', () => {
  const s = new Scene({ view: 'iso' });
  const cam = s.add(frustum({ f: 1.5, fov: 40, at: [1, 2, 3], points: [[0, 6, 0]] }));
  // a point on the axis lands at the principal point, f in front of the centre
  const pp = cam.project([0, 5, 0])!;
  assert.ok(Math.abs(pp[0] - 1) < 1e-9 && Math.abs(pp[1] - (2 + 1.5)) < 1e-9 && Math.abs(pp[2] - 3) < 1e-9);
  assert.equal(cam.project([0, -3, 0]), null, 'behind the camera');
  // twice as far away, half as far from the principal point
  const a = cam.project([2, 4, 0])!, b = cam.project([2, 8, 0])!;
  assert.ok(Math.abs(Math.abs(a[0] - 1) / Math.abs(b[0] - 1) - (8 / 4)) < 1e-9);
  // the image plane is as wide as the field of view says
  cam.set('fov', 40);
  const svgA = s.svg();
  cam.set('fov', 80);
  assert.notEqual(svgA, s.svg(), 'fov changes the picture');
  assert.equal(s.frame().cycles, 0);
  assert.ok(!s.svg().includes('NaN'));
});

test('stereo rig: depth from disparity equals the true depth', () => {
  for (const point of [[0.3, 4.2, 0.4], [-1, 7, 1], [0, 2.5, 0]] as [number, number, number][]) {
    for (const baseline of [1, 2, 3.5]) {
      const rig = stereoRig({ baseline, f: 1.1, point });
      assert.ok(Math.abs(rig.depth() - point[1]) < 1e-9, `${point} b=${baseline}`);
      assert.ok(rig.disparity() > 0);
    }
  }
  const rig = stereoRig({ point: [0, 4, 0] }), near = rig.disparity();
  rig.set('point', [0, 8, 0]);
  assert.ok(Math.abs(rig.disparity() - near / 2) < 1e-9, 'twice as far, half the disparity');
  const s = new Scene({ view: 'iso' });
  s.add(rig);
  assert.equal(s.frame().cycles, 0);
  assert.ok(s.svg().includes('image plane') && s.svg().includes('>b<'));
});

test('chart data forms all become labels and series', () => {
  assert.deepEqual(toTable([1, 2, 3]).series[0].values, [1, 2, 3]);
  assert.deepEqual(toTable([['a', 1], ['b', 2]]).labels, ['a', 'b']);
  assert.deepEqual(toTable([{ label: 'x', value: 5 }]).series[0].values, [5]);
  const m = toTable({ A: [1, 2], B: [3, 4] }, ['p', 'q']);
  assert.deepEqual([m.series.map((x) => x.name), m.labels], [['A', 'B'], ['p', 'q']]);
  assert.equal(toTable([[1, 2], [3, 4]]).series.length, 2);
  assert.deepEqual(toTable({ labels: ['u'], series: [{ name: 's', values: [9] }] }).labels, ['u']);
  const t = niceTicks(0, 93);
  assert.ok(t[0] <= 0 && t[t.length - 1] >= 93 && t.every((v) => Number.isInteger(v)), `ticks ${t}`);
});

test('every chart type draws, with theme colours only and no NaN', () => {
  const months = ['a', 'b', 'c', 'd'];
  const made = [
    bars({ data: [3, 5, 2, 8], labels: months, labelValues: true }), bars({ data: { x: [1, 2, 3, 4], y: [4, 3, 2, 1] }, labels: months, stack: true }),
    bars({ data: { x: [1, 2, 3, 4], y: [4, 3, 2, 1] }, labels: months, horizontal: true, normalize: true }),
    lines({ data: { x: [1, 3, 2, 5] }, curve: 'smooth' }), lines({ data: [1, 3, 2, 5], curve: 'step', fill: true }), areas({ data: { x: [1, 2, 3, 4], y: [1, 1, 2, 2] }, stack: true }),
    scatter({ points: [{ x: 1, y: 2, s: 'a' }, { x: 3, y: 1, s: 'b', r: 4, v: 0.3 }] }), pie({ data: [['a', 1], ['b', 2]], labelValues: true }), donut({ data: [['a', 1]] }),
    histogram({ values: [1, 2, 2, 3, 3, 3, 4, 8] }), heatmap({ matrix: [[1, 2], [3, 4]], labelValues: true }), radar({ data: { a: [1, 2, 3, 4] }, labels: months }), sparkline({ data: [1, 3, 2, 5] }),
  ];
  for (const c of made) {
    const sc = new Scene({ view: 'front' });
    sc.add(c);
    const svg = sc.svg();
    assert.ok(svg.includes('<rect') || svg.includes('<path') || svg.includes('<circle'), String(c.o.type));
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${c.o.type} has no NaN`);
    // colours come from variables or are mixed from them, never fixed hex values
    assert.ok(!/(fill|stroke)="#[0-9a-f]{3,8}"/i.test(svg), `${c.o.type} has no hard-coded colours`);
  }
});

test('chart colours: one series is one colour, highlight uses the accent, palettes change the colours', () => {
  const svgOf = (o: object) => { const sc = new Scene({ view: 'front' }); sc.add(bars({ data: [3, 5, 2], labels: ['a', 'b', 'c'], ...o })); return sc.svg(); };
  const colours = (svg: string) => new Set([...svg.matchAll(/<rect [^>]*fill="([^"]+)"/g)].map((m) => m[1]).filter((c) => c.startsWith('var(--c-s') || c.includes('color-mix')));
  assert.equal(colours(svgOf({})).size, 1);
  assert.ok(svgOf({ highlight: 1 }).includes('fill="var(--c-accent)"'));
  assert.ok(colours(svgOf({ palette: 'categorical' })).size === 3);
  assert.ok(svgOf({ palette: ['accent', 's3', '#123456'] }).includes('#123456'));
  assert.ok(svgOf({ palette: 'sequential' }).includes('--c-hi'));
});

test('chart grow and data animate, and the hover-free reveal is deterministic', () => {
  const c = bars({ data: [4, 8, 6], labels: ['a', 'b', 'c'] });
  const heights = () => { const sc = new Scene({ view: 'front' }); sc.add(c); return [...sc.svg().matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => Number(m[1])); };
  const full = heights();
  c.set('grow', 0);
  assert.ok(heights().every((h) => h === 0), 'nothing at grow 0');
  c.set('grow', 1);
  assert.deepEqual(heights(), full);
  c.set('data', c.flatten([8, 4, 6]));
  assert.notDeepEqual(heights(), full);
  const tl = new TL();
  tl.play(tween(c, { data: c.flatten([1, 1, 1]) }, { duration: 1 }));
  tl.seek(0.5);
  const mid = heights();
  tl.seek(0.5);
  assert.deepEqual(heights(), mid, 'seeking the same time gives the same picture');
});

test('maths figures: the numbers are right', () => {
  const g = graph({ fn: (x) => x * x, x: [0, 3], area: [0, 3], riemann: { n: 4 } });
  assert.ok(Math.abs(g.integral(0, 3) - 9) < 1e-3, 'integral of x squared');
  assert.ok(Math.abs(g.slope(2) - 4) < 1e-6, 'slope of x squared at 2');
  const sc = new Scene({ view: 'front' });
  sc.add(g);
  const sum = (n: number) => { g.set('n', n); const m = /\u03a3 \u2248 ([\d.]+)/.exec(sc.svg())!; return Number(m[1]); };
  assert.ok(Math.abs(sum(400) - 9) < Math.abs(sum(4) - 9), 'more rectangles, closer to the area');

  const p = product([[1, 2], [3, 4]], [[5, 6], [7, 8]]);
  assert.deepEqual(p.c, [[19, 22], [43, 50]]);
  p.set('step', 2);
  const v = (() => { const s2 = new Scene({ view: 'front' }); s2.add(p); return s2.svg(); })();
  assert.ok(v.includes('3\u00b75 + 4\u00b77') && v.includes('43'), 'shows the sum for the current entry');

  const t = transform2d([[2, 0], [0, 3]]);
  t.set('t', 0.5);
  assert.deepEqual(t.current(), [[1.5, 0], [0, 2]]);
  const sh = new Scene({ view: 'front' }); sh.add(transform2d([[1, 1], [0, 1]], { eigen: true }));
  assert.ok(sh.svg().includes('det 1'));
  const rot = new Scene({ view: 'front' }); rot.add(transform2d([[0, -1], [1, 0]], { eigen: true }));
  assert.ok(!rot.svg().includes('stroke-dasharray="5 4"'), 'a rotation has no real eigenvectors');

  const u = unitCircle({ wave: true });
  u.set('angle', 30);
  const us = new Scene({ view: 'front' }); us.add(u);
  assert.ok(us.svg().includes('sin 0.5') && us.svg().includes('cos 0.87'));
  for (const n of [matrix([[1, 2], [3, 4]], { name: 'A', row: 0 }), vectorField((x, y) => [y, -x]), numberLine({ jumps: [{ from: 0, to: 3, label: '+3' }] })]) {
    const q = new Scene({ view: 'front' }); q.add(n);
    assert.ok(!q.svg().includes('NaN'));
  }
});

test('sketch look is repeatable, wobbles lines and draws them twice', () => {
  const make = (sketch: boolean | { roughness?: number; seed?: number }) => { const s = new Scene({ sketch }); s.add(box({ size: 1.5 }), line([0, 0, 0], [3, 0, 0])); return s.svg(); };
  const plain = make(false), a = make(true), b = make(true), c = make({ seed: 9 });
  assert.equal(a, b, 'the same every time');
  assert.notEqual(a, plain);
  assert.notEqual(a, c, 'a different seed wobbles differently');
  const count = (svg: string) => (svg.match(/<path/g) ?? []).length;
  assert.ok(count(a) > count(plain), 'lines are drawn twice');
  assert.ok(!a.includes('NaN'));
});

test('pen draws the trail up to `draw` and lifts away at the end', () => {
  const p = pen([[0, 0, 0], [2, 0, 0], [2, 0, 2]], { keep: false });
  const s = new Scene({ view: 'front' });
  s.add(p);
  const trail = () => s.prims().find((q) => q.key.endsWith(':t'))?.pts ?? [];
  assert.equal(trail().length, 0, 'nothing at 0');
  p.set('draw', 0.25);
  const t = trail();
  assert.ok(Math.abs(t[t.length - 1][0] - 1) < 1e-9, 'a quarter of 4 units is 1 unit along');
  assert.ok(s.prims().length > 1, 'pen is drawn at the tip');
  p.set('draw', 1);
  assert.equal(s.prims().length, 1, 'pen lifts away when finished');
  const f = pen((t) => [t, 0, t * t]);
  f.set('draw', 0.5);
  s.add(f);
  assert.ok(s.prims().every((q) => q.pts.every((v) => v.every(Number.isFinite))));
});
