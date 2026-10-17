/*
 * Builds the playground's sandbox page: node scripts/frame.ts
 * The sandboxed page has an opaque origin, so any file it fetched from the site would count as a cross-origin
 * request that the host may refuse (the dev server does). Everything it runs is therefore bundled and written
 * into one self-contained page, public/pg-frame.html, from scripts/pg-frame.template.html. It is generated and
 * not committed.
 */
import { build } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const site = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

const out = await build({
  configFile: false,
  root: site('.'),
  logLevel: 'warn',
  publicDir: false,
  build: {
    write: false,
    minify: true,
    sourcemap: false,
    lib: { entry: site('src/components/playground/frame.ts'), name: 'cseenPlaygroundFrame', formats: ['iife'], fileName: () => 'pg-frame.js', cssFileName: 'pg-frame' },
  },
});
const files = (Array.isArray(out) ? out : [out]).flatMap((o) => ('output' in o ? o.output : []));
const text = (name: RegExp) => {
  const f = files.find((x) => name.test(x.fileName));
  if (!f) throw new Error(`frame build produced no ${name}`);
  return f.type === 'chunk' ? f.code : String(f.source);
};
// the replacement is a function so that "$" in the bundle is not read as a pattern
const js = text(/\.js$/).replace(/<\/(script)/gi, '<\\/$1');
const css = text(/\.css$/).replace(/<\/(style)/gi, '<\\/$1');
const html = readFileSync(site('scripts/pg-frame.template.html'), 'utf8').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
writeFileSync(site('public/pg-frame.html'), html);
console.log(`playground frame built (${Math.round(html.length / 1024)} KB)`);
