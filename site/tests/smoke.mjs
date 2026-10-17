/*
 * Browser smoke test for the built site: node tests/smoke.mjs [dist]
 * Needs playwright-core and a Chromium (CHROMIUM, default /usr/bin/chromium).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { site } from '../src/config.ts';

const require = createRequire(import.meta.url);
const find = () => { for (const p of ['playwright-core', process.env.PLAYWRIGHT_CORE]) { try { return require(p); } catch { /* try next */ } } throw new Error('playwright-core not found (set PLAYWRIGHT_CORE)'); };
const { chromium } = find();

const dist = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url)));
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml' };
const srv = http.createServer((q, r) => {
  // served under the site's base path, as on GitHub Pages
  const u = decodeURIComponent(q.url.split('?')[0]).replace(new RegExp(`^${site.base}(?=/|$)`), '');
  let f = path.join(dist, u);
  if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}${site.base}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
const failures = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) failures.push(msg); };

async function page(url, w = 1300, h = 900) {
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  pg.problems = [];
  pg.on('pageerror', (e) => pg.problems.push(`pageerror ${e}`));
  pg.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text() + (m.location()?.url ?? '')) && pg.problems.push(`console ${m.text()}`));
  pg.on('response', (r) => r.status() >= 400 && !/favicon/.test(r.url()) && pg.problems.push(`http ${r.status()} ${r.url()}`));
  await pg.goto(base + url);
  await pg.waitForLoadState('networkidle');
  return pg;
}
/** the playground's sandboxed preview: the figure lives in this frame, not in the page */
const playFrame = (pg) => pg.frames().find((f) => f.url().endsWith('/pg-frame.html')) ?? pg.mainFrame();
const sitemap = () => {
  const out = [];
  (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!['_astro', 'pagefind'].includes(e.name)) walk(path.join(d, e.name), `${rel}${e.name}/`); } else if (e.name === 'index.html') out.push(`/${rel}`); } })(dist, '');
  return out.sort();
};

/* 1. every page loads without errors, and does not scroll sideways at three widths */
for (const url of sitemap()) {
  for (const w of [375, 768, 1300]) {
    const pg = await page(url, w);
    ok(pg.problems.length === 0, `${url} @${w}: ${pg.problems.join('; ')}`);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, `${url} @${w}: horizontal overflow ${over}px`);
    await pg.close();
  }
}

/* 2. a gallery card opens a window; dragging turns it; an option changes the code */
{
  const pg = await page('/gallery/devices/');
  await pg.click('#monitor');
  await pg.waitForSelector('.dm-float .dm-view svg');
  const svg = '.dm-float .dm-view svg';
  const before = await pg.$eval(svg, (e) => e.innerHTML);
  const box = await (await pg.$(svg)).boundingBox();
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pg.mouse.down();
  await pg.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 6 });
  await pg.mouse.up();
  await pg.waitForTimeout(150);
  ok((await pg.$eval(svg, (e) => e.innerHTML)) !== before, 'drag turns the figure');
  await pg.click('.dm-float [data-tab=code]');
  const code0 = await pg.$eval('.dm-float .dm-code', (e) => e.textContent);
  ok(/monitor\(\{ width: 3 \}\)/.test(code0), `code shows the default: ${code0}`);
  await pg.$eval('.dm-float input[data-k=width]', (e) => { e.value = '4.5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(150);
  ok(/width: 4\.5/.test(await pg.$eval('.dm-float .dm-code', (e) => e.textContent)), 'changing an option updates the code');
  await pg.click('.dm-float [data-tab=fig]');
  const kept = await pg.$eval(svg, (e) => e.innerHTML);
  await pg.click('.dm-float [data-view=top]');
  await pg.waitForTimeout(100);
  ok((await pg.$eval(svg, (e) => e.innerHTML)) !== kept, 'view presets change the figure');
  // a second window can be open at once
  await pg.$eval('#tv', (e) => e.click()); // the first window covers it, as windows do
  await pg.waitForFunction(() => document.querySelectorAll('.dm-float').length === 2);
  ok(true, 'two windows');
  await pg.click('.dm-float:last-child [data-act=close]');
  ok((await pg.$$('.dm-float')).length === 1, 'close removes one window');
  ok(pg.problems.length === 0, `gallery window: ${pg.problems.join('; ')}`);
  await pg.close();
}

/* 2b. a malformed hash must not break a page: a broken percent-escape on the gallery, a damaged share link in the playground */
{
  const pg = await page('/gallery/devices/#%E0%A4%A');
  ok(pg.problems.length === 0, `gallery with a broken hash: ${pg.problems.join('; ')}`);
  await pg.close();
  const bad = await page('/playground/#code=%25%25%25');
  await playFrame(bad).waitForSelector('svg .sz');
  ok(bad.problems.length === 0 && (await bad.$eval('.pg-error', (e) => e.hidden)), `playground with a damaged share link falls back to the default example: ${bad.problems.join('; ')}`);
  await bad.close();
}

/* 3. playback on a timeline demo */
{
  const pg = await page('/concepts/timeline/');
  const demo = 'cseen-demo[data-id="core/buildup"]';
  await pg.$eval(demo, (e) => e.scrollIntoView());
  await pg.waitForTimeout(600);
  const range = `${demo} [data-act=scrub]`;
  await pg.click(`${demo} [data-act=play]`);
  await pg.$eval(range, (e) => { e.value = '1.5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(100);
  const a = await pg.$eval(`${demo} .dm-view svg`, (e) => e.innerHTML);
  await pg.$eval(range, (e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(100);
  ok(a !== (await pg.$eval(`${demo} .dm-view svg`, (e) => e.innerHTML)), 'the scrubber changes the frame');
  ok(pg.problems.length === 0, `playback: ${pg.problems.join('; ')}`);
  await pg.close();
}

/* 4. the theme editor recolours the page and the figures */
{
  const pg = await page('/gallery/charts/');
  const fill = () => pg.$eval('.gl-thumb svg', (e) => getComputedStyle(e).getPropertyValue('--c-s2') + getComputedStyle(e).getPropertyValue('--c-ink'));
  const a = await fill();
  await pg.click('.te-toggle');
  await pg.click('[data-preset=sand]');
  await pg.waitForTimeout(100);
  ok(a !== (await fill()), 'a theme preset recolours charts');
  const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await pg.click('[data-random]');
  await pg.waitForTimeout(100);
  ok(bg !== (await pg.evaluate(() => getComputedStyle(document.body).backgroundColor)), 'random theme changes the page');
  await pg.close();
}

/* 5. the playground runs a sample, shows a readable error for bad code, and shares code in the address */
{
  const pg = await page('/playground/');
  const fr = () => playFrame(pg);
  await fr().waitForSelector('svg .sz');
  ok((await fr().$$eval('svg path', (e) => e.length)) > 5, 'the default example draws');
  ok(await pg.$eval('.pg-frame', (f) => f.getAttribute('sandbox') === 'allow-scripts'), 'the preview is sandboxed with allow-scripts and nothing else');
  ok((await pg.$$('.pg-view svg.cseen')).length === 0, 'no figure is drawn in the page itself');
  const typeCode = async (code) => { await pg.click('.cm-content'); await pg.keyboard.press('Control+A'); await pg.keyboard.insertText(code); await pg.keyboard.press('Control+Enter'); await pg.waitForTimeout(200); };
  await typeCode("import { Scene, box } from 'cseen';\nconst s = new Scene();\ns.add(box({ at: [0, 0, 0], size: 2 }));\ns.add(box({ at: [4, 0, 0], size: 1, role: 'accent' }));");
  ok(await pg.$eval('.pg-error', (e) => e.hidden), 'valid code shows no error');
  const good = await fr().$eval('svg', (e) => e.innerHTML);
  ok(/cn-r-accent/.test(good), 'the edited scene is drawn');
  ok(/^#code=/.test(await pg.evaluate(() => location.hash)), 'the code is in the address');
  await typeCode("import { Scene } from 'cseen';\nconst s = new Scene();\nnull.boom;");
  const msg = await pg.$eval('.pg-error', (e) => (e.hidden ? '' : e.textContent));
  ok(/Line 3/.test(msg) && /null|boom/.test(msg), `a runtime error names its line: ${msg}`);
  ok((await fr().$eval('svg', (e) => e.innerHTML)) === good, 'the last good figure stays while the code is broken');
  ok((await pg.$$('.cm-errline')).length === 1, 'the failing line is marked');
  await typeCode("import { Scene } from 'cseen';\nconst s = new Scene(;");
  ok(/Line 2/.test(await pg.$eval('.pg-error', (e) => e.textContent)), 'a syntax error names its line');
  await typeCode("import _ from 'lodash';");
  ok(/Cannot import/.test(await pg.$eval('.pg-error', (e) => e.textContent)), 'a foreign import explains itself');
  // code that never ends is stopped with a message that names its line, and the editor works again afterwards
  await typeCode("import { Scene } from 'cseen';\nconst s = new Scene();\nwhile (true) {}");
  await pg.waitForFunction(() => /ran for more than/.test(document.querySelector('.pg-error')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => {});
  const stuck = await pg.$eval('.pg-error', (e) => (e.hidden ? '' : e.textContent));
  ok(/ran for more than/.test(stuck) && /Line 3/.test(stuck), `a loop that never ends is stopped: ${stuck}`);
  await typeCode("import { Scene } from 'cseen';\nconst s = new Scene();");
  ok(await pg.$eval('.pg-error', (e) => e.hidden), 'the editor works after a stopped loop');
  // a shared link reproduces the code
  await typeCode("import { Scene, box } from 'cseen';\nconst s = new Scene();\ns.add(box({ at: [1, 1, 0], size: 1, role: 's3' }));");
  const url = await pg.evaluate(() => location.href);
  const pg2 = await page(url.replace(/^https?:\/\/[^/]+/, '').replace(new RegExp(`^${site.base}`), ''));
  await pg2.waitForSelector('.cm-content');
  await pg2.waitForTimeout(800);
  ok(/cn-r-s3/.test(await pg2.$eval('.cm-content', (e) => e.textContent)) || /role: 's3'/.test(await pg2.$eval('.cm-content', (e) => e.textContent)), 'a shared link restores the code');
  ok(!(await pg2.$eval('.pg-notice', (e) => e.hidden)), 'a shared link says the code has not been run');
  ok((await playFrame(pg2).$$('svg')).length === 0, 'a shared link does not run its code until Run is pressed');
  await pg2.click('[data-act=run]');
  await playFrame(pg2).waitForSelector('svg .sz');
  ok(/cn-r-s3/.test(await playFrame(pg2).$eval('svg', (e) => e.innerHTML)) && (await pg2.$eval('.pg-notice', (e) => e.hidden)), 'Run draws a shared link\'s scene');
  ok(pg2.problems.length === 0, `shared link: ${pg2.problems.join('; ')}`);
  // an example from the list loads and runs
  await pg.selectOption('.pg-examples', 'waves/rings');
  await pg.waitForTimeout(700);
  ok(await pg.$eval('.pg-error', (e) => e.hidden), 'a picked example runs');
  ok(!(await pg.$eval('.pg-play', (e) => e.hidden)), 'an example with a timeline shows playback');
  ok(pg.problems.length === 0, `playground: ${pg.problems.join('; ')}`);
  // every example in the list must run exactly as it is shown, and draw something
  const all = await pg.$$eval('.pg-examples option', (o) => o.map((x) => x.value).filter(Boolean));
  const broken = [];
  for (const id of all) {
    await pg.selectOption('.pg-examples', id);
    await pg.waitForTimeout(150);
    const err = await pg.$eval('.pg-error', (e) => (e.hidden ? '' : e.textContent.trim().slice(0, 100)));
    const shapes = await fr().$$eval('svg *', (n) => n.length);
    if (err || !shapes) broken.push(`${id}: ${err || 'nothing drawn'}`);
  }
  ok(all.length > 50 && broken.length === 0, `all ${all.length} playground examples run as shown${broken.length ? ` (broken: ${broken.join('; ')})` : ''}`);
  // the view buttons turn the figure, and it keeps that view while the code runs again
  await pg.selectOption('.pg-examples', 'core/hello');
  await pg.waitForTimeout(500);
  const before = await fr().$eval('svg', (n) => n.innerHTML);
  await pg.click('[data-view=top]');
  await pg.waitForTimeout(500);
  ok(await pg.$eval('[data-view=top]', (b) => b.getAttribute('aria-pressed') === 'true'), 'a view button shows as pressed');
  ok((await fr().$eval('svg', (n) => n.innerHTML)) !== before, 'a view button changes the figure');
  // full screen: the preview, the code, and both
  for (const [k, cls] of [['out', 'pg-out'], ['code', 'pg-editor'], ['pg', 'pg']]) {
    await pg.click(`[data-full=${k}]`);
    await pg.waitForTimeout(300);
    ok(await pg.evaluate((c) => document.fullscreenElement?.classList.contains(c) ?? false, cls), `full screen: ${k}`);
    await pg.evaluate(() => document.exitFullscreen());
    await pg.waitForTimeout(200);
  }
  // the example list opens inside the window, however short it is
  await pg.click('.pg-pick-btn');
  const box = await pg.$eval('.pg-pick-list', (l) => { const r = l.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
  ok(box.top >= 0 && box.bottom <= box.h, 'the example list stays inside the window');
  await pg.click('.pg-pick-list [data-value="waves/rings"]');
  await pg.waitForTimeout(500);
  ok(await pg.$eval('.pg-examples', (s) => s.value === 'waves/rings'), 'picking from the list selects the example');
  ok(pg.problems.length === 0, `playground examples: ${pg.problems.join('; ')}`);
  // hostile code stays in its box: it cannot read or change the page, its storage or its cookies, or reach the network
  const titleBefore = await pg.title(), pagesBefore = pg.context().pages().length;
  const outside = [];
  // a request the browser refuses (failed with "csp") is the sandbox working; only one that gets an answer, or fails for another reason, counts
  const refused = new Set();
  pg.on('requestfailed', (r) => { if (r.failure()?.errorText === 'csp') refused.add(r); });
  pg.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r); });
  await pg.evaluate(() => { document.cookie = 'cseen_probe=1'; localStorage.setItem('cseen_probe', '1'); });
  await typeCode(`import { Scene } from 'cseen';
const s = new Scene();
const seen = {};
for (const [k, f] of Object.entries({
  parentDoc: () => parent.document.title,
  parentWrite: () => { parent.document.title = 'pwned'; },
  top: () => { top.location = 'https://example.com/'; },
  cookie: () => document.cookie,
  storage: () => localStorage.getItem('cseen_probe'),
  fetch: () => fetch('https://example.com/pwn'),
  image: () => { new Image().src = 'https://example.com/pwn.png'; },
  open: () => window.open('https://example.com/'),
})) { try { seen[k] = String(f()); } catch (e) { seen[k] = 'blocked'; } }
parent.postMessage({ type: 'result', id: -1, ok: true, size: [1, 1] }, '*');
document.title = JSON.stringify(seen);`);
  await pg.waitForTimeout(800);
  const seen = JSON.parse(await fr().title().catch(() => '{}') || '{}');
  ok(await pg.title() === titleBefore, 'code in the preview cannot change the page it sits in');
  ok(seen.parentDoc === 'blocked' && seen.parentWrite === 'blocked' && seen.top === 'blocked' && seen.cookie === 'blocked' && seen.storage === 'blocked', `the preview cannot reach the page, its cookies or its storage: ${JSON.stringify(seen)}`);
  ok(outside.every((r) => refused.has(r)), `the preview sends nothing to another origin: ${outside.filter((r) => !refused.has(r)).map((r) => r.url()).join(' ')}`);
  ok(pg.context().pages().length === pagesBefore, 'the preview cannot open windows');
  ok(/pg-frame\.html$/.test(playFrame(pg).url()), 'the preview stays on its own page');
  // a frame that stops answering is replaced and the editor works again
  await typeCode("import { Scene } from 'cseen';\nconst s = new Scene();\nsetTimeout(() => { for (;;) {} }, 50);");
  await pg.waitForFunction(() => /stopped responding/.test(document.querySelector('.pg-error')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => {});
  ok(/stopped responding/.test(await pg.$eval('.pg-error', (e) => (e.hidden ? '' : e.textContent))), 'a preview that locks up is reset');
  await typeCode("import { Scene, box } from 'cseen';\nconst s = new Scene();\ns.add(box({ at: [0, 0, 0], size: 1 }));");
  await playFrame(pg).waitForSelector('svg .sz', { timeout: 8000 });
  ok(await pg.$eval('.pg-error', (e) => e.hidden), 'the playground works again after a reset');
  await pg2.close();
  await pg.close();
}

/* 5b. the copy message follows what really happened: a refusal says so, a success says copied */
{
  // a clipboard that refuses, in place before the page's own scripts run
  const denied = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await denied.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }); });
  await denied.goto(base + '/');
  await denied.waitForLoadState('networkidle');
  await denied.click('[data-copy]');
  await denied.waitForFunction(() => document.querySelector('.cn-toast.show'), null, { timeout: 3000 }).catch(() => {});
  ok(/Could not copy/.test(await denied.$eval('.cn-toast', (e) => e.textContent)), 'a refused copy says it could not copy');
  await denied.close();
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1300, height: 900 } });
  const granted = await ctx.newPage();
  await granted.goto(base + '/');
  await granted.waitForLoadState('networkidle');
  await granted.click('[data-copy]');
  await granted.waitForFunction(() => document.querySelector('.cn-toast.show'), null, { timeout: 3000 }).catch(() => {});
  ok(/Copied to the clipboard/.test(await granted.$eval('.cn-toast', (e) => e.textContent)), 'a copy that worked says copied');
  ok(/npm install/.test(await granted.evaluate(() => navigator.clipboard.readText())), 'and the text really is on the clipboard');
  await ctx.close();
}

/* 6. the generated reference has signatures, option tables and working links between them */
{
  const pg = await page('/reference/devices/');
  ok((await pg.$$('h3#monitor')).length === 1, 'reference has a section for monitor');
  ok(/function monitor\(o\?: MonitorOpts\): Device/.test(await pg.$eval('h3#monitor ~ div pre, h3#monitor + div', (e) => e.textContent).catch(() => '')) || /function monitor/.test(await pg.content()), 'reference shows the signature');
  const rows = await pg.evaluate(() => {
    let n = document.getElementById('monitoropts').closest('.sl-heading-wrapper') ?? document.getElementById('monitoropts');
    while ((n = n.nextElementSibling)) {
      if (n.matches('.sl-heading-wrapper')) return [];
      const t = n.matches('table') ? n : n.querySelector('table');
      if (t) return [...t.querySelectorAll('tbody tr')].map((r) => r.textContent);
    }
    return [];
  });
  ok(rows.some((t) => /width\?/.test(t) && /width in world units/.test(t)), `MonitorOpts has a documented width row (${rows.length} rows)`);
  await pg.click('.sl-markdown-content a[href="#monitoropts"]');
  ok((await pg.evaluate(() => location.hash)) === '#monitoropts', 'an options link jumps to its table');
  const core = await page('/reference/core/');
  ok((await core.$$('h3#scene')).length === 1 && (await core.$$('h3#timeline')).length === 1, 'core reference lists Scene and Timeline');
  ok(core.problems.length === 0 && pg.problems.length === 0, 'reference pages load cleanly');
  await core.close();
  await pg.close();
}

/* 7. polish: everything is same-origin, figures have names, motion stops when asked, weights stay small, 404 works */
{
  const zlib = await import('node:zlib');
  const gz = (b) => zlib.gzipSync(b).length;
  const weigh = async (url, w = 1300) => {
    const pg = await browser.newPage({ viewport: { width: w, height: 900 } });
    let js = 0, html = 0;
    const foreign = [];
    pg.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) foreign.push(r.url()); });
    pg.on('response', async (r) => { try { const b = await r.body(); if (/\.js$/.test(r.url())) js += gz(b); else if (r.request().resourceType() === 'document') html += gz(b); } catch { /* redirects have no body */ } });
    await pg.goto(base + url);
    await pg.waitForLoadState('networkidle');
    await pg.waitForTimeout(400);
    return { pg, js, html, foreign };
  };
  const docs = await weigh('/concepts/theming/');
  ok(docs.foreign.length === 0, `a docs page loads nothing from another origin: ${docs.foreign.join(' ')}`);
  ok(docs.js < 60_000, `a docs page loads under 60 KB of gzipped JS before any demo is visible (${docs.js})`);
  await docs.pg.close();
  const land = await weigh('/');
  ok(land.foreign.length === 0, 'the landing page loads nothing from another origin');
  ok(land.js < 130_000, `the landing page stays under 130 KB gzipped JS (${land.js})`);
  await land.pg.close();
  const gal = await weigh('/gallery/devices/');
  ok(gal.html < 90_000 && gal.js < 60_000, `a gallery page stays small (html ${gal.html}, js ${gal.js})`);
  await gal.pg.close();
  const play = await weigh('/playground/');
  ok(play.foreign.length === 0, 'the playground loads nothing from another origin');
  await play.pg.close();

  // a figure has an accessible name
  const pg = await page('/concepts/theming/');
  await pg.$eval('cseen-demo[data-id="charts/grouped"]', (e) => e.scrollIntoView());
  await pg.waitForTimeout(600);
  const label = await pg.$eval('cseen-demo[data-id="charts/grouped"] .dm-view svg', (e) => e.getAttribute('aria-label') + '|' + e.getAttribute('role'));
  ok(/Grouped bars\|img/.test(label), `a demo figure is named: ${label}`);
  await pg.close();

  // reduced motion: dashes stop travelling and playback does not start by itself
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1300, height: 900 } });
  const rm = await ctx.newPage();
  await rm.goto(base + '/gallery/shapes/');
  await rm.waitForLoadState('networkidle');
  await rm.$eval('#arrows', (e) => e.click());
  await rm.waitForSelector('.dm-float .dm-view svg .cn-flow, .dm-float .dm-view svg');
  await rm.waitForTimeout(500);
  const anim = await rm.evaluate(() => { const e = document.querySelector('.dm-float svg .cn-flow'); return e ? getComputedStyle(e).animationName : 'none'; });
  ok(anim === 'none', `dashes do not animate under reduced motion (${anim})`);
  const t0 = await rm.$eval('.dm-float [data-act=scrub]', (e) => e.value);
  await rm.waitForTimeout(700);
  ok(t0 === (await rm.$eval('.dm-float [data-act=scrub]', (e) => e.value)), 'the timeline does not advance under reduced motion');
  await ctx.close();

  // the 404 page
  const nf = await page('/404.html');
  ok((await nf.$$('main cseen-mini:not(.cn-footer *)')).length === 1 && /Page not found/.test(await nf.title()), 'the 404 page draws a figure and says so');
  await nf.close();
}

// search: the built site has an index, and a query finds a page
{
  const pg = await page('/start/install/');
  await pg.keyboard.press('Control+k');
  await pg.waitForSelector('.pagefind-ui__search-input', { timeout: 20000 });
  await pg.fill('.pagefind-ui__search-input', 'perspective');
  await pg.waitForSelector('.pagefind-ui__result-link', { timeout: 10000 });
  const hrefs = await pg.$$eval('.pagefind-ui__result-link', (as) => as.map((a) => a.getAttribute('href')));
  ok(hrefs.some((h) => /coordinates-and-cameras/.test(h)), `search finds "perspective" (${hrefs.slice(0, 3).join(', ')})`);
  await pg.close();
}

// reference: a page type label, a filter that narrows the list, an example with a way to run it, a way back from the gallery
{
  const pg = await page('/reference/core/');
  ok(/Reference/i.test(await pg.locator('.page-kind').innerText()), 'a reference page says it is a reference');
  const before = await pg.locator('.sl-heading-wrapper.level-h3:visible').count();
  await pg.fill('ref-filter input', 'fadeIn');
  const after = await pg.locator('.sl-heading-wrapper.level-h3:visible').count();
  ok(after >= 1 && after < before / 4, `the filter narrows the list (${before} to ${after})`);
  await pg.fill('ref-filter input', '');
  ok(await pg.locator('a.run-link').count() > 20, 'reference examples have a link that runs them');
  await pg.close();
  const all = await page('/reference/all/');
  const rows = await all.locator('tbody tr:visible').count();
  await all.fill('ref-filter input', 'monitor');
  ok((await all.locator('tbody tr:visible').count()) < rows / 10, 'the list of all exports filters');
  await all.close();
  const gal = await page('/gallery/devices/');
  await gal.click('#monitor');
  await gal.click('.dm-float [data-tab="code"], .dm-floating [data-tab="code"]');
  ok(await gal.locator('a[data-act="reference"]').first().isVisible(), 'a gallery window links to the reference entry');
  await gal.close();
}

// every link from the reference to a gallery card lands on a card that exists (the link checker cannot see card ids)
{
  let checked = 0;
  const bad = [];
  for (const pk of ['core', 'devices', 'ui', 'charts', 'waves', 'optics', 'math', 'flow']) {
    const html = fs.readFileSync(path.join(dist, 'reference', pk, 'index.html'), 'utf8');
    for (const m of html.matchAll(/href="([^"#]*\/gallery\/([\w-]+)\/)#([\w-]+)"/g)) {
      const target = fs.readFileSync(path.join(dist, 'gallery', m[2], 'index.html'), 'utf8');
      checked++;
      if (!target.includes(`id="${m[3]}"`)) bad.push(`${pk} -> ${m[2]}#${m[3]}`);
    }
  }
  ok(checked > 20 && bad.length === 0, `reference links to gallery cards resolve (${checked} checked${bad.length ? `, broken: ${bad.join(', ')}` : ''})`);
}

// the home page has no stray line under the header, the footer has its figure, and the On this page button steps aside while reading
{
  const pg = await page('/', 1440, 800);
  const px = await pg.evaluate(() => { const e = document.elementFromPoint(700, 64); return e ? getComputedStyle(e).borderTopWidth : 'none'; });
  ok(px === '0px', `no rule under the home page header (found ${px})`);
  ok((await pg.locator('.cn-footer .cn-footer-logo svg.cn-logo').count()) === 1 && (await pg.locator('header .cn-brand svg.cn-logo').count()) === 2, 'the header and the footer carry the logo');
  await pg.close();
  const doc = await page('/concepts/theming/', 640, 700);
  ok(await doc.locator('cn-otp').isVisible(), 'On this page shows at tablet width');
  await doc.evaluate(() => scrollTo(0, 900));
  await doc.waitForTimeout(400);
  ok(await doc.evaluate(() => document.querySelector('cn-otp').classList.contains('away')), 'On this page steps aside when scrolling down');
  await doc.evaluate(() => scrollTo(0, 700));
  await doc.waitForTimeout(400);
  ok(await doc.evaluate(() => !document.querySelector('cn-otp').classList.contains('away')), 'On this page returns when scrolling up');
  await doc.close();
}

// the site's own details: toast, tooltips, shortcuts, bars, the ring over figures and the grid on the home page
{
  const pg = await page('/', 1300, 900);
  ok((await pg.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)) === 'thin', 'scrollbars are thin and themed');
  await pg.click('[data-copy]');
  await pg.waitForSelector('.cn-toast.show', { timeout: 3000 });
  ok(true, 'a copy button shows a toast');
  await pg.hover('.te-mode');
  await pg.waitForSelector('.cn-tip.show', { timeout: 3000 });
  ok((await pg.locator('.cn-tip').innerText()).length > 3, 'an icon button gets a themed tooltip');
  ok(await pg.evaluate(() => !document.querySelector('.te-mode').hasAttribute('title')), 'the slow native tooltip is replaced');
  // the ring over a figure, and the grid lighting up under the pointer in the hero
  const fig = await pg.locator('.hero-fig cseen-mini').boundingBox();
  await pg.mouse.move(fig.x + fig.width / 2, fig.y + fig.height / 2, { steps: 6 });
  await pg.waitForSelector('.cn-ring.on', { timeout: 3000 });
  ok(true, 'a ring follows the pointer over a figure');
  const hero = await pg.locator('.landing .hero').boundingBox();
  for (let i = 0; i < 12; i++) await pg.mouse.move(hero.x + 200 + i * 30, hero.y + 200 + i * 6);
  await pg.waitForTimeout(150);
  const lit = await pg.evaluate(() => { const c = document.querySelector('canvas.cn-trail'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  ok(lit > 0, `the home page grid lights up under the pointer (${lit} pixels)`);
  await pg.keyboard.press('?');
  ok(await pg.evaluate(() => !!document.querySelector('dialog.cn-keys[open]')), '? opens the shortcut list');
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('/');
  ok(await pg.evaluate(() => !!document.querySelector('dialog[open]')), '/ opens search');
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('g');
  await pg.keyboard.press('p');
  await pg.waitForURL('**/playground/', { timeout: 5000 });
  ok(true, 'g then p goes to the playground');
  await pg.close();
  const long = await page('/reference/core/', 1300, 700);
  await long.evaluate(() => scrollTo(0, 1500));
  await long.waitForTimeout(300);
  ok((await long.evaluate(() => getComputedStyle(document.querySelector('.cn-read')).opacity)) === '1', 'a long page shows how far you have read');
  await long.close();
}

// layout: every size from phone to desktop keeps the page inside the viewport and the way around reachable
for (const w of [390, 640, 820, 1024, 1440]) {
  for (const url of ['/', '/start/introduction/', '/playground/', '/gallery/devices/']) {
    const pg = await page(url, w, 800);
    ok((await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${url} has no horizontal scroll at ${w}px`);
    const nav = w >= 800 ? '.cn-nav a' : url === '/' ? '[data-cn-burger]' : 'starlight-menu-button, .sl-menu-button';
    ok(await pg.locator(nav).first().isVisible(), `${url} shows a way to navigate at ${w}px`);
    const top = await pg.evaluate(() => document.querySelector('h1')?.getBoundingClientRect().top ?? 0);
    ok(url === '/' || top < 320, `${url} starts its title near the top at ${w}px (title at ${Math.round(top)})`);
    if (url === '/playground/') {
      const h = await pg.evaluate(() => [document.querySelector('.pg-editor')?.getBoundingClientRect().height, document.querySelector('.pg-view')?.getBoundingClientRect().height]);
      ok(h[0] >= 280 && h[1] >= 180, `the playground editor and preview are both usable at ${w}px`);
    }
    await pg.close();
  }
}
const home = await page('/', 390, 800);
await home.click('[data-cn-burger]');
ok(await home.locator('[data-cn-drawer] a').first().isVisible(), 'the phone menu opens on the landing page');
await home.close();

await browser.close();
srv.close();
console.log(`${checks} checks, ${failures.length} failed`);
for (const f of failures) console.log(' FAIL', f);
process.exit(failures.length ? 1 : 0);
