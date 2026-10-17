import { site } from '../config.ts';

const ident = /^[A-Za-z_$][\w$]*$/;
/** escapes text for use inside a RegExp source */
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A single-quoted string literal. */
const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`;

/** A JavaScript literal for a value, wrapped to stay readable. Undefined entries are left out. */
export function lit(v: unknown, indent = 0, width = 76): string {
  if (typeof v === 'string') return q(v);
  if (typeof v === 'number') return Object.is(v, -0) ? '0' : String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'boolean' || v === null) return String(v);
  const pad = '  '.repeat(indent + 1), end = '  '.repeat(indent);
  if (Array.isArray(v)) {
    const flat = `[${v.map((x) => lit(x, indent + 1, width)).join(', ')}]`;
    if (flat.length + indent * 2 <= width && !flat.includes('\n')) return flat;
    if (v.every((x) => typeof x === 'number')) {
      const rows: string[] = [];
      let row = '';
      for (const x of v) { const t = lit(x) + ','; if ((row + ' ' + t).length > width - indent * 2 - 2 && row) { rows.push(row); row = t; } else row = row ? row + ' ' + t : t; }
      rows.push(row);
      return `[\n${rows.map((r) => pad + r).join('\n')}\n${end}]`;
    }
    return `[\n${v.map((x) => pad + lit(x, indent + 1, width) + ',').join('\n')}\n${end}]`;
  }
  if (v && typeof v === 'object') {
    const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (!e.length) return '{}';
    const part = ([k, x]: [string, unknown]) => `${ident.test(k) || /^(?:0|[1-9]\d*)$/.test(k) ? k : q(k)}: ${lit(x, indent + 1, width)}`;
    const flat = `{ ${e.map(part).join(', ')} }`;
    if (flat.length + indent * 2 <= width && !flat.includes('\n')) return flat;
    return `{\n${e.map((p) => pad + part(p) + ',').join('\n')}\n${end}}`;
  }
  return 'undefined';
}

/** `name({ ...opts })`, or `name()` when there are no options. */
export const call = (name: string, o: Record<string, unknown> = {}, indent = 0) => {
  const e = Object.entries(o).filter(([, x]) => x !== undefined);
  return e.length ? `${name}(${lit(Object.fromEntries(e), indent)})` : `${name}()`;
};

/**
 * Adds the import lines a snippet needs: every exported name used in the code is imported from the
 * pack that exports it. `packs` maps an import path suffix ('' is the core) to the names it exports.
 */
export function withImports(body: string, packs: Record<string, string[]>): string {
  const lines: string[] = [];
  // a word inside a string or a comment is not a use: `fit: 'sphere'` does not need the sphere function
  const code = body.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''").replace(/\/\/.*$/gm, '');
  // a name the snippet declares itself (`const path = ...`) is its own, not the library's, so importing it too would clash
  const own = new Set([...code.matchAll(/\b(?:const|let|var|function|class)\s+([\w$]+)/g)].map((m) => m[1]));
  // `obj.name` is a property, not a use, but `...name` is a spread of the function
  for (const [sub, names] of Object.entries(packs)) {
    // sorted: the order an export list comes in differs between the build and the browser, and the same example must give the same text in both
    const used = names.filter((n) => !own.has(n) && new RegExp(`(^|[^\\w$.]|\\.\\.\\.)${escRe(n)}(?![\\w$])(?!\\s*:)`).test(code)).sort();
    if (used.length) lines.push(`import { ${used.join(', ')} } from '${site.pkg}${sub ? `/${sub}` : ''}';`);
  }
  return `${lines.join('\n')}${lines.length ? '\n\n' : ''}${body}`;
}

/** The code between `// #region name` and `// #endregion`, with the common indent removed. */
export function region(source: string, name: string): string {
  const m = new RegExp(`// #region ${escRe(name)}\\n([\\s\\S]*?)// #endregion`).exec(source);
  if (!m) throw new Error(`no region ${name}`);
  const lines = m[1].replace(/\s+$/, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return lines.map((l) => l.slice(indent)).join('\n');
}
