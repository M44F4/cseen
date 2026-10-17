/** Code travels to the playground in the URL hash, so a link is a complete, shareable example. */
const enc = new TextEncoder();
/** fatal: a hash that is not valid UTF-8 is rejected instead of loading replacement characters into the editor */
const dec = new TextDecoder('utf-8', { fatal: true });

/** Code to URL-safe base64 (no padding). */
export function encodeCode(code: string): string {
  let bin = '';
  for (const b of enc.encode(code)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The longest `code=` value a link may carry: about 150 KB of code, far more than any example. */
export const MAX_ENCODED = 200_000;

/** The code in a `#code=...` hash, or null when there is none or it is damaged. Extra `&key=value` parameters and padding are ignored. */
export function decodeCode(hash: string): string | null {
  try {
    const m = /^#?code=([^&]+)/.exec(hash);
    // a link is untrusted input: an oversized one is refused before it is decoded
    if (!m || m[1].length > MAX_ENCODED) return null;
    const b = m[1].replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
    return dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The element id a `#name` hash points at, or '' when the hash is empty or is not valid percent-encoding. */
export function idFromHash(hash: string): string {
  try { return decodeURIComponent(hash.replace(/^#/, '')); } catch { return ''; }
}

export const playgroundHref = (code: string, base = '') => `${base}/playground/#code=${encodeCode(code)}`;
