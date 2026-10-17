/* A small message that appears at the bottom of the page and goes by itself. Used by every copy button. */
let el: HTMLElement | null = null;
let timer = 0;

/** the live region is added to the page empty, ahead of the first message: a region created with its text is not announced */
function region(): HTMLElement {
  if (!el) {
    el = document.createElement('div');
    el.className = 'cn-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  return el;
}

/** Shows `message` for a moment. */
export function toast(message: string) {
  const box = region();
  box.textContent = message;
  // restart the animation if one is already showing
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => box.classList.remove('show'), 1600);
}

let watching = false;

/**
 * Every copy on the site says how it went: the install line, code blocks, the demo windows and the playground link.
 * They all copy through `navigator.clipboard.writeText`, so that one call is wrapped: the message follows the real
 * outcome, and a refusal still reaches the code that asked, which shows its own fallback.
 */
export function watchCopyButtons() {
  region();
  const clip = navigator.clipboard;
  if (watching || !clip?.writeText) return;
  watching = true;
  const write = clip.writeText.bind(clip);
  clip.writeText = (text: string) => write(text).then(
    () => toast('Copied to the clipboard'),
    (e: unknown) => { toast('Could not copy'); throw e; },
  );
}
