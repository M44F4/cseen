/**
 * Turns an SVG document (a logo, an icon, a screenshot) into something that can be laid on a plane.
 * Pure string work, so it runs at build time on a server as well as in the browser.
 */
export interface ParsedSvg {
  /** viewBox of the source: x, y, width, height */
  box: [number, number, number, number];
  /** sanitised inner markup, with ids made unique */
  inner: string;
}

/** Counter that gives each parsed file its own id prefix. */
let uid = 0;

/** Reads an SVG document into a size and inner markup that `plane` can place. Scripts, event handlers and external references are removed and ids are made unique. */
export function parseSvg(source: string, o: { recolor?: Record<string, string> } = {}): ParsedSvg {
  let src = source.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const open = /<svg\b([^>]*)>/i.exec(src);
  if (!open) throw new Error('cseen: the string does not contain an <svg> element');
  const end = src.lastIndexOf('</svg>');
  const attrs = open[1];
  let inner = src.slice(open.index + open[0].length, end < 0 ? undefined : end);

  const num = (name: string) => { const m = new RegExp(`(?<![\\w-])${name}\\s*=\\s*["']([\\d.]+)`, 'i').exec(attrs); return m ? parseFloat(m[1]) : NaN; };
  const vb = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(attrs);
  let box: [number, number, number, number];
  if (vb) {
    const n = vb[1].trim().split(/[\s,]+/).map(Number);
    // a malformed or empty viewBox would give NaN sizes downstream: fall back to width and height
    box = n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0 ? [n[0], n[1], n[2], n[3]] : [0, 0, num('width') || 100, num('height') || 100];
  } else {
    box = [0, 0, num('width') || 100, num('height') || 100];
  }

  // Safety: an imported file must never run code or reach the network.
  inner = inner
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("|')(?!\s*(?:#|data:image\/))[^"']*\1/gi, ''); // a leading space inside the quotes is ignored by browsers, so it is by this too

  // Several imported files can share one page, so their ids must not collide.
  const prefix = `sz${++uid}-`;
  const ids = new Set<string>();
  inner.replace(/(?<![\w:-])id\s*=\s*["']([^"']+)["']/g, (_m, id) => { ids.add(id); return _m; });
  if (ids.size) {
    inner = inner
      .replace(/(?<![\w:-])id\s*=\s*(["'])([^"']+)\1/g, (_m, q, id) => `id=${q}${prefix}${id}${q}`)
      .replace(/url\(\s*(["']?)#([^)"']+)\1\s*\)/g, (_m, q, id) => (ids.has(id) ? `url(${q}#${prefix}${id}${q})` : _m))
      .replace(/\b((?:xlink:)?href)\s*=\s*(["'])\s*#([^"']+)\2/g, (_m, a, q, id) => (ids.has(id) ? `${a}=${q}#${prefix}${id}${q}` : _m));
  }

  // Let a logo follow the theme: swap fixed colours for CSS variables.
  if (o.recolor) {
    for (const [from, to] of Object.entries(o.recolor)) {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      inner = inner.replace(re, () => to); // a function, so `$` in the replacement stays literal
    }
  }
  return { box, inner };
}

/** Places an SVG document inside a rectangle of another SVG, scaled to fill it (like `object-fit: cover`). */
export function nestSvg(source: string, x: number, y: number, w: number, h: number): string {
  const p = parseSvg(source);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${p.box.join(' ')}" preserveAspectRatio="xMidYMid slice" overflow="hidden">${p.inner}</svg>`;
}
