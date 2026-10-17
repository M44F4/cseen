import { tokenize } from '../../../src/index.ts';

/** HTML-escapes text for element content and for double-quoted attribute values. */
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML for a block of code, coloured with the library's own tokenizer. Colours come from CSS (.tk-*). */
export function highlight(src: string): string {
  return src.split('\n').map((line) => tokenize(line).map((t) => (t.kind === 'plain' ? esc(t.text) : `<span class="tk-${t.kind}">${esc(t.text)}</span>`)).join('')).join('\n');
}
export { esc };
