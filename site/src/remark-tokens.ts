/**
 * Replaces @@name@@ and @@pkg@@ in prose and code with the values in config.ts, so the working title
 * lives in exactly one place and a rename never touches the pages.
 */
import { site } from './config.ts';

const values: Record<string, string> = { name: site.name, pkg: site.pkg };
const swap = (s: string) => s.replace(/@@(\w+)@@/g, (m, k: string) => values[k] ?? m);

interface Node { type: string; value?: string; url?: string; children?: Node[]; attributes?: unknown }

/** The remark plugin: walks the whole tree once, swapping tokens and prefixing the base path on root-relative links. */
export function remarkTokens() {
  return (tree: Node) => {
    const walk = (n: Node) => {
      if (typeof n.value === 'string' && ['text', 'inlineCode', 'code', 'html'].includes(n.type)) n.value = swap(n.value);
      // internal links are written from the site root; under a base path they need it in front
      if (typeof n.url === 'string') { n.url = swap(n.url); if (site.base && /^\/(?!\/)/.test(n.url) && !n.url.startsWith(`${site.base}/`)) n.url = site.base + n.url; }
      // JSX attributes are a list; directive attributes (asides) are a plain object and are left alone
      if (Array.isArray(n.attributes)) for (const a of n.attributes as { value?: unknown }[]) if (typeof a.value === 'string') a.value = swap(a.value);
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}
