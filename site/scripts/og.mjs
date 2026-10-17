/*
 * Renders the social card (public/og.png, 1200 by 630) from a scene of the library, through Chromium:
 *   node scripts/og.mjs        (needs playwright-core and a Chromium, as tests/smoke.mjs does)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderStill } from '../../src/index.ts';
import { chartDash } from '../src/demos/scenes.ts';
import { prepare } from '../src/demos/prepare.ts';
import { standalone } from './brand.ts';
import { site } from '../src/config.ts';

const logo = readFileSync(new URL('../src/brand/full-color.svg', import.meta.url), 'utf8').replace(/<title[\s\S]*?<\/desc>/, '').replace(/ width="[^"]*" height="[^"]*"/, ' width="470"');

const require = createRequire(import.meta.url);
const { chromium } = (() => { for (const p of ['playwright-core', process.env.PLAYWRIGHT_CORE]) { try { return require(p); } catch { /* try next */ } } throw new Error('playwright-core not found (set PLAYWRIGHT_CORE)'); })();

const made = prepare(chartDash(), { title: `${site.name}: a monitor showing four charts` });
made.s.size = [620, 520];
made.s.padding = 20;
made.s.camera.set('yaw', 24);
const art = standalone(renderStill(made.s)).replace('<svg ', '<svg width="620" height="520" ');
/** HTML text and double-quoted attribute value */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; background: #f2f2f2; color: #0b0b0b; font-family: system-ui, sans-serif; display: grid; grid-template-columns: 560px 1fr; align-items: center; overflow: hidden; }
  .t { padding: 0 0 0 80px; }
  h1 { margin: 0; line-height: 0; }
  p { font-size: 34px; line-height: 1.25; margin: 22px 0 0; color: #3d3d3d; max-width: 470px; }
  i { display: block; width: 90px; height: 10px; background: #00a86b; border-radius: 5px; margin-top: 34px; }
</style><div class="t"><h1 aria-label="${esc(site.name)}">${logo}</h1><p>${esc(site.tagline)}</p><i></i></div><div>${art}</div>`;

const dir = mkdtempSync(path.join(tmpdir(), 'og-'));
const file = path.join(dir, 'og.html');
writeFileSync(file, html);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(file).href);
  await page.screenshot({ path: fileURLToPath(new URL('../public/og.png', import.meta.url)) });
} finally {
  await browser.close();
}
console.log('wrote public/og.png');
