/*
 * Compiles and runs playground code. TypeScript is stripped with sucrase, and imports of the
 * library are rewritten to the namespaces the page has already loaded, so the visitor's code runs
 * against the same library the docs use. Lines are preserved, so an error points at the right line.
 */
import { transform } from 'sucrase';

export type Namespaces = Record<string, Record<string, unknown>>;
export interface Ran { scene?: unknown; timeline?: unknown }
/** An error in the visitor's code, with the 1-based line it points at when that is known. */
export class RunError extends Error {
  line?: number;
  constructor(message: string, line?: number) { super(message); this.line = line; }
}

const SUB = /^cseen(?:\/(devices|ui|charts|waves|optics|math|flow))?$/;

/** import { a, b as c } from 'cseen/charts'  ->  const { a, b: c } = __ns["charts"];  (same number of lines). Type-only and .css imports vanish. */
export function rewriteImports(code: string, known: string[]): string {
  // the part before `from` cannot hold a quote or a semicolon, so a side-effect import above cannot be swallowed into the next statement
  return code.replace(/^[ \t]*import\s+([^'"`;]*?)\s*from\s*(['"])([^'"\n]+)\2[ \t]*;?|^[ \t]*import\s*(['"])([^'"\n]+)\4[ \t]*;?/gm, (m, what: string | undefined, _q, spec: string | undefined, _q2, bare: string | undefined) => {
    const lines = '\n'.repeat((m.match(/\n/g) ?? []).length);
    const path = spec ?? bare ?? '';
    if (bare !== undefined) return /\.css$/.test(path) ? lines : (() => { throw new RunError(`Cannot import "${path}" here. Only the library can be imported in the playground.`); })();
    const sm = SUB.exec(path);
    if (!sm) throw new RunError(`Cannot import "${path}" here. Only 'cseen' and its packs (${known.filter((k) => k).map((k) => `'cseen/${k}'`).join(', ')}) can be imported in the playground.`);
    const key = JSON.stringify(sm[1] ?? '');
    const w = (what ?? '').trim();
    // `import type { X } from 'cseen'` has no runtime part
    if (/^type\s*\{/.test(w)) return lines;
    const ns = /^\*\s+as\s+([\w$]+)$/.exec(w);
    if (ns) return `const ${ns[1]} = __ns[${key}];${lines}`;
    const named = /^\{([\s\S]*)\}$/.exec(w);
    if (named) {
      const parts = named[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/^type\s+/, '')).map((x) => x.replace(/\s+as\s+/, ': '));
      return `const { ${parts.join(', ')} } = __ns[${key}];${lines}`;
    }
    throw new RunError(`Unsupported import form: ${w}. Use import { name } from '${path}'.`);
  });
}

/** TypeScript to JavaScript, with imports rewritten. */
export function compile(code: string, known: string[]): string {
  let js: string;
  try {
    js = transform(rewriteImports(code, known), { transforms: ['typescript'], disableESTransforms: true }).code;
  } catch (e) {
    if (e instanceof RunError) throw e;
    const m = /^(.*?)(?: \((\d+):(\d+)\))?$/s.exec((e as Error).message);
    throw new RunError(m?.[1] ?? String(e), m?.[2] ? Number(m[2]) : undefined);
  }
  return js;
}

/** How long visitor code may run before it is stopped, in milliseconds. */
const RUN_LIMIT_MS = 3000;
/** keywords that start a statement, so a loop body that begins with one cannot take a `__tick(),` prefix */
const STATEMENT_WORDS = /^(?:if|for|while|do|switch|try|throw|return|const|let|var|function|class|break|continue|else|with|import|export)$/;

/**
 * Puts a `__tick()` call at the top of every loop body, so a loop that never ends is stopped with a message instead of
 * freezing the page. Everything goes on the loop's own line, so error lines stay right. It reads the code only far enough
 * to skip strings, comments, template text and regular expressions. A `do ... while` is guarded at its `do`, and a loop
 * whose body is a single statement that starts with a keyword (`while (x) if (y) z();`) is left as it is.
 */
export function guardLoops(js: string): string {
  const at: [number, string][] = [], doEnds = new Set<number>();
  const word = /[\w$]/;
  /** the index after the string, template, comment or regex that starts at `i`, or `i` itself if none does; `prev` is the last code character before it */
  const skip = (i: number, prev: string): number => {
    const c = js[i];
    if (c === '"' || c === "'") { for (let j = i + 1; j < js.length; j++) { if (js[j] === '\\') j++; else if (js[j] === c || js[j] === '\n') return j + 1; } return js.length; }
    if (c === '`') {
      let depth = 0;
      for (let j = i + 1; j < js.length; j++) {
        if (js[j] === '\\') j++;
        else if (!depth && js[j] === '`') return j + 1;
        else if (js[j] === '$' && js[j + 1] === '{') { depth++; j++; }
        else if (depth && js[j] === '{') depth++;
        else if (depth && js[j] === '}') depth--;
      }
      return js.length;
    }
    if (c === '/' && js[i + 1] === '/') { const e = js.indexOf('\n', i); return e < 0 ? js.length : e; }
    if (c === '/' && js[i + 1] === '*') { const e = js.indexOf('*/', i + 2); return e < 0 ? js.length : e + 2; }
    if (c === '/' && (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev))) {
      let cls = false;
      for (let j = i + 1; j < js.length && js[j] !== '\n'; j++) { if (js[j] === '\\') j++; else if (js[j] === '[') cls = true; else if (js[j] === ']') cls = false; else if (js[j] === '/' && !cls) return j + 1; }
    }
    return i;
  };
  const comment = (i: number) => js[i] === '/' && (js[i + 1] === '/' || js[i + 1] === '*');
  /** the index of the bracket that closes the one at `i` */
  const close = (i: number): number => {
    const open = js[i], end = open === '(' ? ')' : '}';
    let depth = 0, prev = open;
    for (let j = i; j < js.length; j++) {
      const k = skip(j, prev);
      if (k !== j) { if (!comment(j)) prev = 'x'; j = k - 1; continue; }
      if (js[j] === open) depth++;
      else if (js[j] === end && --depth === 0) return j;
      if (!/\s/.test(js[j])) prev = js[j];
    }
    return -1;
  };
  let prev = '';
  for (let i = 0; i < js.length; i++) {
    const k = skip(i, prev);
    if (k !== i) { if (!comment(i)) prev = 'x'; i = k - 1; continue; } // a string or a regex is a value: a `/` after it divides
    const c = js[i];
    if (/\s/.test(c)) continue;
    const m = !word.test(prev) && prev !== '.' && word.test(c) ? /^(for|while|do)(?![\w$])/.exec(js.slice(i, i + 6)) : null;
    if (m) {
      let j = i + m[1].length;
      const next = () => { while (j < js.length) { const s2 = skip(j, ')'); if (s2 !== j && js[j] === '/') j = s2; else if (/\s/.test(js[j])) j++; else break; } };
      if (m[1] === 'do') {
        next();
        if (js[j] === '{') { at.push([j + 1, '__tick();']); const e = close(j); if (e > 0) doEnds.add(e); }
      } else if (!(m[1] === 'while' && doEnds.has(prevIndex(js, i)))) {
        next();
        if (js[j] === '(') {
          const e = close(j);
          if (e > 0) {
            j = e + 1;
            next();
            if (js[j] === '{') at.push([j + 1, '__tick();']);
            else if (js[j] === ';') { at.push([j, '{__tick()}']); at.push([j + 1, '']); }
            else if (j < js.length) { const w = /^[\w$]+/.exec(js.slice(j, j + 20)); if (!w || !STATEMENT_WORDS.test(w[0])) at.push([j, '__tick(),']); }
          }
        }
      }
      prev = m[1][m[1].length - 1];
      i += m[1].length - 1;
      continue;
    }
    prev = c;
  }
  if (!at.length) return js;
  // an empty body `;` is replaced, not added to: its insert carries the `{...}` and the `;` is dropped
  let out = '', last = 0;
  const cuts = at.filter(([, t]) => t !== '').map(([i, t]) => [i, t] as [number, string]);
  const drop = new Set(at.filter(([, t]) => t === '').map(([i]) => i - 1));
  for (const [i, t] of cuts.sort((a, b) => a[0] - b[0])) {
    out += js.slice(last, i) + t;
    last = drop.has(i) ? i + 1 : i;
  }
  return out + js.slice(last);
}

/** the index of the last code character before `i`, skipping spaces and comments (-1 if none) */
function prevIndex(js: string, i: number): number {
  let j = i - 1;
  while (j >= 0 && /\s/.test(js[j])) j--;
  return j;
}

/** Runs the code. It should define `s` (a Scene), and may define `tl` (a Timeline). Code that runs longer than `limitMs` is stopped. */
export function run(code: string, ns: Namespaces, limitMs = RUN_LIMIT_MS): Ran {
  const js = guardLoops(compile(code, Object.keys(ns)));
  // the guard counts only while this code runs: callbacks it leaves behind (a function the scene calls every frame) are not timed
  let live = true, ticks = 0;
  const t0 = performance.now();
  const tick = () => {
    if (live && (++ticks & 1023) === 0 && performance.now() - t0 > limitMs) throw new RunError(`This code ran for more than ${limitMs / 1000} seconds, so it was stopped. Check its loops for one that never ends.`);
  };
  // new Function adds two lines before the body
  const body = `${js}\n;return { scene: typeof s !== 'undefined' ? s : typeof scene !== 'undefined' ? scene : undefined, timeline: typeof tl !== 'undefined' ? tl : typeof timeline !== 'undefined' ? timeline : undefined };`;
  try {
    return new Function('__ns', '__tick', body)(ns, tick) as Ran;
  } catch (e) {
    const err = e as Error;
    const at = /<anonymous>:(\d+):\d+/.exec(err.stack ?? '');
    const syntax = err instanceof SyntaxError;
    throw new RunError(`${err.message || String(e)}${hint(err, ns)}`, at && !syntax ? Number(at[1]) - 2 : undefined);
  } finally {
    live = false;
  }
}

/** for "X is not defined" where X is something the library exports: say which import to add */
function hint(err: Error, ns: Namespaces): string {
  const m = err instanceof ReferenceError ? /^([\w$]+) is not defined/.exec(err.message) : null;
  if (!m) return '';
  const pack = Object.keys(ns).find((k) => m[1] in ns[k]);
  return pack === undefined ? '' : `\nAdd: import { ${m[1]} } from 'cseen${pack ? `/${pack}` : ''}';`;
}
