/*
 * Reads the public exports of a module with the TypeScript compiler API and describes them:
 * kind, signature, description from TSDoc, and a property table for every option interface.
 * No dependency beyond `typescript`, which the repository already has.
 */
import ts from 'typescript';

export type Kind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';
export interface Prop { name: string; type: string; optional: boolean; doc: string; default?: string; inherited?: string }
export interface Param { name: string; type: string; optional: boolean; doc: string; default?: string }
export interface Member { name: string; kind: 'method' | 'property' | 'accessor'; signature: string; doc: string; static?: boolean }
export interface Entry {
  name: string;
  kind: Kind;
  doc: string;
  /** TypeScript signatures, one per overload; a type alias's definition; a const's type */
  signatures: string[];
  /** every `@param name text` */
  params: Record<string, string>;
  returns?: string;
  /** the parameters of the first signature, with types, for the parameter table */
  paramList: Param[];
  returnType?: string;
  examples: string[];
  props: Prop[];
  /** interfaces and classes: what it extends */
  extends: string[];
  members: Member[];
  /** names of exported interfaces used as the options of a function or class constructor */
  options: string[];
  file: string;
}

const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope | ts.TypeFormatFlags.WriteArrowStyleSignature | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;

/** A TypeScript program over the given entry files, using the repository's tsconfig. */
export function createProgram(root: string, entries: string[]): ts.Program {
  const cfgPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')!;
  const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, root);
  return ts.createProgram(entries, { ...cfg.options, noEmit: true, types: [] });
}

const text = (parts: ts.SymbolDisplayPart[] | undefined) => (parts ?? []).map((p) => p.text).join('').trim();
const tagText = (t: ts.JSDocTagInfo) => text(t.text);

/** the description and tags of a symbol's doc comment */
function docOf(sym: ts.Symbol, checker: ts.TypeChecker): { doc: string; tags: ts.JSDocTagInfo[] } {
  return { doc: text(sym.getDocumentationComment(checker)), tags: sym.getJsDocTags(checker) };
}

/** the kind of declaration an export is, or null for anything the reference does not list */
function kindOf(sym: ts.Symbol): Kind | null {
  const f = sym.flags;
  if (f & ts.SymbolFlags.Class) return 'class';
  if (f & ts.SymbolFlags.Function) return 'function';
  if (f & ts.SymbolFlags.Enum) return 'enum';
  if (f & ts.SymbolFlags.Interface) return 'interface';
  if (f & ts.SymbolFlags.TypeAlias) return 'type';
  if (f & ts.SymbolFlags.Variable) return 'const';
  return null;
}

const simplify = (s: string) => s.replace(/import\("[^"]+"\)\./g, '');

/** the option table of an interface or object type; `own` is where inherited ones are told apart */
function propsOf(type: ts.Type, own: ts.Node | undefined, checker: ts.TypeChecker, at: ts.Node): Prop[] {
  const out: Prop[] = [];
  for (const p of checker.getPropertiesOfType(type)) {
    const decl = p.valueDeclaration ?? p.declarations?.[0];
    const t = checker.getTypeOfSymbolAtLocation(p, decl ?? at);
    const { doc, tags } = docOf(p, checker);
    const def = tags.find((x) => x.name === 'default');
    const parent = decl && ts.isPropertySignature(decl) ? decl.parent : undefined;
    const from = parent && own && parent !== own && (ts.isInterfaceDeclaration(parent) || ts.isTypeLiteralNode(parent)) ? (ts.isInterfaceDeclaration(parent) ? parent.name.text : undefined) : undefined;
    const optional = !!(p.flags & ts.SymbolFlags.Optional);
    let ty = simplify(checker.typeToString(t, at, FLAGS));
    if (optional) ty = ty.replace(/ \| undefined$/, '');
    out.push({ name: p.name, type: ty, optional, doc, default: def ? tagText(def) : undefined, inherited: from });
  }
  return out;
}

/** everything the reference says about one export */
function describe(name: string, sym: ts.Symbol, checker: ts.TypeChecker, exported: Set<string>, root: string): Entry | null {
  let kind = kindOf(sym);
  if (!kind) return null;
  const decls = sym.declarations ?? [];
  const decl = decls.find((d) => ts.isFunctionDeclaration(d) || ts.isClassDeclaration(d) || ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d) || ts.isVariableDeclaration(d) || ts.isEnumDeclaration(d)) ?? decls[0];
  // `export const box = (o) => new Box(o)` is a function to anyone reading the docs
  if (kind === 'const' && decl && checker.getTypeOfSymbolAtLocation(sym, decl).getCallSignatures().length) kind = 'function';
  const { doc, tags } = docOf(sym, checker);
  const e: Entry = {
    name, kind, doc, signatures: [], params: {}, paramList: [], examples: tags.filter((t) => t.name === 'example').map(tagText), props: [], extends: [], members: [], options: [],
    file: decl ? decl.getSourceFile().fileName.replace(root, '').replace(/^\/+/, '') : '',
  };
  for (const t of tags) {
    if (t.name === 'param') { const m = /^([\w$]+)\s*-?\s*([\s\S]*)$/.exec(tagText(t)); if (m) e.params[m[1]] = m[2]; }
    else if (t.name === 'returns' || t.name === 'return') e.returns = tagText(t);
  }
  const usedOptions = (sigs: readonly ts.Signature[]) => {
    for (const s of sigs) for (const p of s.getParameters()) {
      const t = checker.getTypeOfSymbolAtLocation(p, decl!);
      const n = (t.aliasSymbol ?? t.getSymbol())?.name;
      if (n && exported.has(n) && !e.options.includes(n) && /Opts$|Options$/.test(n)) e.options.push(n);
    }
  };

  if (kind === 'function') {
    const t = checker.getTypeOfSymbolAtLocation(sym, decl!);
    const sigs = t.getCallSignatures();
    e.signatures = sigs.map((s) => `function ${name}${simplify(checker.signatureToString(s, decl, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType)).replace(/ => /, ': ')}`);
    usedOptions(sigs);
    if (sigs[0]) {
      e.paramList = sigs[0].getParameters().map((p) => {
        const pd = p.valueDeclaration as ts.ParameterDeclaration | undefined;
        const pt = checker.getTypeOfSymbolAtLocation(p, decl!);
        return { name: p.name, type: simplify(checker.typeToString(pt, decl, FLAGS)).replace(/ \| undefined$/, ''), optional: !!(pd && (pd.questionToken || pd.initializer)), doc: e.params[p.name] ?? '', default: pd?.initializer?.getText() };
      });
      e.returnType = simplify(checker.typeToString(sigs[0].getReturnType(), decl, FLAGS));
    }
  } else if (kind === 'class') {
    const t = checker.getDeclaredTypeOfSymbol(sym);
    const ctor = checker.getTypeOfSymbolAtLocation(sym, decl!).getConstructSignatures();
    e.signatures = ctor.map((s) => `new ${name}${simplify(checker.signatureToString(s, decl, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType)).replace(/ => .*$/, '')}`);
    usedOptions(ctor);
    for (const b of checker.getBaseTypes(t as ts.InterfaceType)) e.extends.push(b.symbol?.name ?? checker.typeToString(b));
    const cd = decl as ts.ClassDeclaration;
    for (const m of cd.members) {
      const flags = ts.getCombinedModifierFlags(m as ts.Declaration);
      if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
      const msym = (m as ts.Declaration & { name?: ts.Node }).name && checker.getSymbolAtLocation((m as ts.Declaration & { name: ts.Node }).name);
      if (!msym || (m.name && ts.isPrivateIdentifier(m.name))) continue;
      const d = docOf(msym, checker).doc;
      const mt = checker.getTypeOfSymbolAtLocation(msym, m);
      const isStatic = !!(flags & ts.ModifierFlags.Static);
      if (ts.isMethodDeclaration(m)) e.members.push({ name: msym.name, kind: 'method', signature: `${msym.name}${simplify(checker.signatureToString(mt.getCallSignatures()[0], m, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType)).replace(/ => /, ': ')}`, doc: d, static: isStatic });
      else if (ts.isPropertyDeclaration(m)) e.members.push({ name: msym.name, kind: 'property', signature: `${msym.name}${m.questionToken ? '?' : ''}: ${simplify(checker.typeToString(mt, m, FLAGS))}`, doc: d, static: isStatic });
      else if (ts.isGetAccessor(m)) e.members.push({ name: msym.name, kind: 'accessor', signature: `${msym.name}: ${simplify(checker.typeToString(mt, m, FLAGS))}`, doc: d, static: isStatic });
    }
  } else if (kind === 'interface') {
    const t = checker.getDeclaredTypeOfSymbol(sym);
    e.props = propsOf(t, decl, checker, decl!);
    for (const b of checker.getBaseTypes(t as ts.InterfaceType)) e.extends.push(b.symbol?.name ?? checker.typeToString(b));
  } else if (kind === 'type') {
    const ta = decl as ts.TypeAliasDeclaration;
    e.signatures = [`type ${name} = ${simplify(ta.type.getText())}`];
    const t = checker.getDeclaredTypeOfSymbol(sym);
    if (ts.isTypeLiteralNode(ta.type)) e.props = propsOf(t, ta.type, checker, ta);
  } else if (kind === 'const') {
    e.signatures = [`const ${name}: ${simplify(checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, decl!), decl, FLAGS))}`];
  } else if (kind === 'enum') {
    e.signatures = [`enum ${name}`];
  }
  return e;
}

/** Everything a module exports, in source order of first declaration. */
export function extract(program: ts.Program, entry: string, root: string): Entry[] {
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry);
  if (!sf) throw new Error(`api: cannot read ${entry}`);
  const modSym = checker.getSymbolAtLocation(sf);
  if (!modSym) return [];
  const exports = checker.getExportsOfModule(modSym);
  const resolved = exports.map((s) => ({ name: s.name, sym: s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s }));
  const names = new Set(resolved.map((r) => r.name));
  const out: Entry[] = [];
  for (const r of resolved) {
    const e = describe(r.name, r.sym, checker, names, root);
    if (e) out.push(e);
  }
  return out;
}

/** What is missing a description: exported symbols, and the properties of exported interfaces. */
export function undocumented(entries: Entry[]): { symbol: string; prop?: string }[] {
  const out: { symbol: string; prop?: string }[] = [];
  for (const e of entries) {
    if (!e.doc) out.push({ symbol: e.name });
    for (const p of e.props) if (!p.doc && !p.inherited) out.push({ symbol: e.name, prop: p.name });
  }
  return out;
}

/* ------------------------------------------------------------------ MDX */

/** one table cell: pipes and line breaks would end it */
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const prose = (s: string) => s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/</g, '&lt;');
/** keep inline code but escape the braces and angle brackets elsewhere */
const para = (s: string) => s.split(/(`[^`]*`)/g).map((part, i) => (i % 2 ? part : prose(part))).join('');
/** the id Starlight gives a heading of this name */
const slug = (s: string) => s.toLowerCase();
const fence = (code: string) => `\`\`\`ts\n${code}\n\`\`\``;

export interface MdxOpts {
  title: string;
  importPath: string;
  description: string;
  entries: Entry[];
  /** every exported name and the pack page it lives on, so a type used in another pack still links */
  index?: Record<string, string>;
  pack?: string;
  /** the gallery card that shows each name, as a path with an anchor */
  gallery?: Record<string, string>;
}

/** the first sentence of a description, for lists and tables */
export const summaryOf = (doc: string) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(doc.replace(/\n+/g, ' '))?.[0] ?? doc).trim();

const sorted = (list: Entry[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

/** One reference page as MDX. */
export function toMdx(opts: MdxOpts): string {
  const { title, importPath, description, entries, index = {}, pack, gallery = {} } = opts;
  const by = (k: Kind[]) => sorted(entries.filter((e) => k.includes(e.kind)));
  const have = new Set(entries.filter((e) => e.kind === 'interface' || e.kind === 'type').map((e) => e.name));
  const typeLink = (n: string) => (have.has(n) ? `[\`${n}\`](#${slug(n)})` : index[n] && index[n] !== pack ? `[\`${n}\`](/reference/${index[n]}/#${slug(n)})` : `\`${n}\``);
  const out: string[] = [
    `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n`,
    `import RefFilter from '../../../components/RefFilter.astro';\nimport RunLink from '../../../components/RunLink.astro';\n`,
    `${para(description)}\n`, fence(`import { ... } from '${importPath}';`), '', '<RefFilter />\n',
  ];

  const section = (head: string, list: Entry[], body: (e: Entry) => string[]) => {
    if (!list.length) return;
    out.push(`## ${head}\n`);
    for (const e of list) out.push(`### ${e.name}\n`, ...body(e));
  };
  const optionsLine = (e: Entry) => (e.options.length ? [`Options: ${e.options.map(typeLink).join(', ')}\n`] : []);
  const paramTable = (e: Entry) => {
    if (!e.paramList.length) return [];
    const hasDoc = e.paramList.some((p) => p.doc);
    const row = (p: Param) => `| \`${p.name}${p.optional ? '?' : ''}\` | \`${cell(p.type)}\` |${hasDoc ? ` ${cell(para(p.doc))} |` : ''}`;
    return [`| Parameter | Type |${hasDoc ? ' Description |' : ''}\n| --- | --- |${hasDoc ? ' --- |' : ''}\n${e.paramList.map(row).join('\n')}\n`];
  };
  const returns = (e: Entry) => (e.returnType && e.returnType !== 'void' ? [`**Returns** \`${cell(e.returnType)}\`${e.returns ? `. ${para(e.returns)}` : ''}\n`] : e.returns ? [`**Returns** ${para(e.returns)}\n`] : []);
  // an example that builds a Scene and needs no page gets a link that runs it in the playground
  const example = (e: Entry) => e.examples.flatMap((x) => (x.includes('```') ? [`${x}\n`] : [`**Example**\n`, `${fence(x)}\n`, ...(/new Scene\(/.test(x) && !/document\.|mount\(|renderStill|orbit\(/.test(x) ? [`<RunLink code={${JSON.stringify(x)}} />\n`] : [])]));
  const see = (e: Entry) => (gallery[e.name] ? [`See it in the [gallery](${gallery[e.name]}).\n`] : []);
  const common = (e: Entry) => [
    e.doc ? `${para(e.doc)}\n` : '',
    ...(e.signatures.length ? [fence(e.signatures.join('\n'))] : []),
    ...paramTable(e), ...returns(e), ...optionsLine(e), ...example(e), ...see(e),
  ];

  section('Functions', by(['function']), common);
  section('Classes', by(['class']), (e) => [
    ...common(e),
    ...(e.extends.length ? [`Extends ${e.extends.map((x) => `\`${x}\``).join(', ')}.\n`] : []),
    ...(e.members.length ? [`| Member | Description |\n| --- | --- |\n${e.members.map((m) => `| \`${cell(m.signature)}\`${m.static ? ' (static)' : ''} | ${cell(para(m.doc))} |`).join('\n')}\n`] : []),
  ]);
  section('Options and types', by(['interface', 'type']), (e) => {
    const own = e.props.filter((p) => !p.inherited), inherited = e.props.filter((p) => p.inherited);
    const rows = own.map((p) => `| \`${p.name}${p.optional ? '?' : ''}\` | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ''} | ${cell(para(p.doc))} |`);
    return [
      e.doc ? `${para(e.doc)}\n` : '',
      ...(e.kind === 'type' ? [fence(e.signatures.join('\n'))] : []),
      ...(e.extends.length ? [`Extends ${e.extends.map(typeLink).join(', ')}.\n`] : []),
      ...(rows.length ? [`| Option | Type | Default | Description |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`] : []),
      ...(inherited.length && !e.extends.length ? [`Also accepts ${[...new Set(inherited.map((p) => p.inherited))].map((x) => typeLink(x!)).join(', ')}.\n`] : []),
    ];
  });
  section('Values', by(['const', 'enum']), common);
  return out.filter((x) => x !== '').join('\n') + '\n';
}
