import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';
import starlightLinksValidator from 'starlight-links-validator';
import { fileURLToPath } from 'node:url';
import { site } from './src/config.ts';
import { remarkTokens } from './src/remark-tokens.ts';

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

// Self-hosted, latin subset. The fallbacks are sized to match, so the text does not jump when a face arrives.
const fontFaces = `
@font-face { font-family: 'Instrument Sans Variable'; font-style: normal; font-weight: 400 700; font-display: swap; src: url('${site.base}/fonts/instrument-sans-latin-wght-normal.woff2') format('woff2-variations'); }
@font-face { font-family: 'JetBrains Mono Variable'; font-style: normal; font-weight: 100 800; font-display: swap; src: url('${site.base}/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2-variations'); }
@font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 700; font-display: swap; src: url('${site.base}/fonts/orbitron-latin-700-normal.woff2') format('woff2'); }
@font-face { font-family: 'Instrument Sans Fallback'; src: local('Arial'), local('Liberation Sans'), local('Helvetica'); size-adjust: 98%; ascent-override: 94%; descent-override: 24%; line-gap-override: 0%; }
@font-face { font-family: 'JetBrains Mono Fallback'; src: local('Menlo'), local('Consolas'), local('DejaVu Sans Mono'), local('Courier New'); size-adjust: 100%; ascent-override: 102%; descent-override: 30%; line-gap-override: 0%; }
@font-face { font-family: 'Orbitron Fallback'; src: local('Arial'), local('Liberation Sans'), local('Helvetica'); size-adjust: 112%; ascent-override: 90%; descent-override: 22%; line-gap-override: 0%; }
`;

const social = site.url
  ? [
      { tag: 'meta', attrs: { property: 'og:image', content: `${site.url}/og.png` } },
      { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
      { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
      { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      { tag: 'meta', attrs: { name: 'twitter:image', content: `${site.url}/og.png` } },
    ] as const
  : [];

export default defineConfig({
  site: site.url || undefined,
  base: site.base || undefined,
  // pages are fetched as links scroll into view, so a click lands on a page that is already in the cache
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  markdown: { remarkPlugins: [remarkTokens] },
  integrations: [
    starlight({
      plugins: [// gallery cards are found by id, which the validator does not see; the reference links to them
      starlightLinksValidator({ errorOnRelativeLinks: false, exclude: ['/gallery/*/#*', `${site.base}/gallery/*/#*`] })],
      title: site.name,
      description: site.tagline,
      // Starlight's light/dark switch is replaced by the theme editor, which sets the same data-theme attribute
      components: { Header: './src/components/Header.astro', MobileTableOfContents: './src/components/OnThisPage.astro', Footer: './src/components/Footer.astro', ThemeSelect: './src/components/ThemeEditor.astro', PageTitle: './src/components/PageTitle.astro' },
      favicon: '/favicon.svg',
      head: [
        { tag: 'style', content: fontFaces },
        ...social,
        // the three faces load before first paint, so there is no swap from a fallback font
        ...['instrument-sans-latin-wght-normal', 'orbitron-latin-700-normal', 'jetbrains-mono-latin-wght-normal'].map((f) => ({ tag: 'link' as const, attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${site.base}/fonts/${f}.woff2`, crossorigin: '' } })),
        // restore a saved theme before first paint, so there is no flash
        { tag: 'script', content: "try{var t=JSON.parse(localStorage.getItem('cseen-theme')||'null');if(t){var r=document.documentElement;r.dataset.theme=t.dark?'dark':'light';r.style.setProperty('--cn-ink',t.ink);r.style.setProperty('--cn-bg',t.bg);r.style.setProperty('--cn-accent',t.accent);if(t.lg){r.style.setProperty('--cn-logo-a',t.lg.a);r.style.setProperty('--cn-logo-b',t.lg.b);if(t.lg.mono)r.dataset.logo='mono'}}else{var m=localStorage.getItem('starlight-theme');r=document.documentElement;r.dataset.theme=m||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}}catch(e){}" },
      ],
      customCss: ['./src/styles/custom.css', './src/styles/demo.css'],
      social: site.repo ? [{ icon: 'github', label: 'Source', href: site.repo }] : [],
      sidebar: [
        { slug: 'docs', label: 'Overview' },
        { label: 'Get started', collapsed: false, items: [{ autogenerate: { directory: 'start' } }] },
        { label: 'Concepts', collapsed: true, items: [{ autogenerate: { directory: 'concepts' } }, { slug: 'glossary' }] },
        { label: 'Guides', collapsed: true, items: [{ autogenerate: { directory: 'guides' } }, { slug: 'troubleshooting' }] },
        { label: 'Try it', collapsed: true, items: [{ slug: 'playground' }, { slug: 'examples' }] },
        { label: 'Gallery', collapsed: true, items: ['core', 'shapes', 'objects', 'devices', 'ui', 'charts', 'waves', 'optics', 'math', 'flow'].map((p) => ({ slug: `gallery/${p}` })) },
        // the pages carry their own labels and order, so a page that is briefly missing cannot break the sidebar
        { label: 'Reference', collapsed: true, items: [{ autogenerate: { directory: 'reference' } }, { slug: 'cheat-sheet', label: 'Cheat sheet' }] },
      ],
    }),
    mdx(),
  ],
  vite: {
    // the docs always run against the current library source: no build step to see a change
    resolve: {
      alias: [
        { find: /^cseen\/cseen\.css$/, replacement: src('theme/cseen.css') },
        { find: /^cseen\/(devices|ui|charts|waves|optics|math|flow)$/, replacement: src("$1/index.ts") },
        { find: /^cseen$/, replacement: src('index.ts') },
        { find: /^cseen\/all$/, replacement: src('all.ts') },
      ],
    },
    server: { fs: { allow: ['..'] } },
  },
});
