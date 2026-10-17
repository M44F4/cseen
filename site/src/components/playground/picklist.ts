/*
 * A list of choices that opens inside the page. The native <select> popup is drawn by the browser and can run past the
 * bottom of the window; this one is sized to the room there is. The <select> stays as the source of truth (it is hidden,
 * still holds the value and still fires "change"), so the page works the same and without script keeps the native control.
 */
export function pickList(host: HTMLElement, select: HTMLSelectElement) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pg-pick-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const list = document.createElement('div');
  list.className = 'pg-pick-list';
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  list.hidden = true;

  const items: HTMLElement[] = [];
  const add = (o: HTMLOptionElement) => {
    const li = document.createElement('div');
    li.setAttribute('role', 'option');
    li.id = `pg-opt-${items.length}`;
    li.dataset.value = o.value;
    li.textContent = o.textContent;
    items.push(li);
    list.append(li);
  };
  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptGroupElement) {
      const g = document.createElement('div');
      g.className = 'pg-pick-group';
      g.setAttribute('role', 'presentation');
      g.textContent = child.label;
      list.append(g);
      Array.from(child.children).forEach((o) => add(o as HTMLOptionElement));
    } else add(child as HTMLOptionElement);
  }

  select.classList.add('pg-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(btn, list);

  let active = -1, typed = '', typedAt = 0;
  const selected = () => items.findIndex((i) => i.dataset.value === select.value);
  const sync = () => {
    const i = selected();
    btn.textContent = i >= 0 ? items[i].textContent : 'Your code';
    items.forEach((it, n) => it.setAttribute('aria-selected', String(n === i)));
  };
  const mark = (i: number) => {
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((it, n) => it.classList.toggle('active', n === active));
    btn.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  };
  /** sizes the list to the room below the button, or above it when that is larger */
  const place = () => {
    const r = btn.getBoundingClientRect(), below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 240 && above > below;
    list.style.left = `${Math.max(8, r.left)}px`;
    list.style.minWidth = `${r.width}px`;
    list.style.top = up ? 'auto' : `${r.bottom + 4}px`;
    list.style.bottom = up ? `${innerHeight - r.top + 4}px` : 'auto';
    list.style.maxHeight = `${Math.max(120, Math.min(28 * 16, up ? above : below))}px`;
  };
  const isOpen = () => !list.hidden;
  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    place();
    mark(Math.max(0, selected()));
  };
  const close = (focus = true) => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-activedescendant');
    if (focus) btn.focus();
  };
  const choose = (i: number) => {
    const v = items[i].dataset.value ?? '';
    close();
    if (select.value !== v) { select.value = v; select.dispatchEvent(new Event('change', { bubbles: true })); }
    sync();
  };

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => { const i = items.indexOf((e.target as HTMLElement).closest('[role=option]') as HTMLElement); if (i >= 0) choose(i); });
  list.addEventListener('mousemove', (e) => { const i = items.indexOf((e.target as HTMLElement).closest('[role=option]') as HTMLElement); if (i >= 0 && i !== active) mark(i); });
  btn.addEventListener('keydown', (e) => {
    if (!isOpen()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': mark(active + 1); break;
      case 'ArrowUp': mark(active - 1); break;
      case 'Home': mark(0); break;
      case 'End': mark(items.length - 1); break;
      case 'PageDown': mark(active + 8); break;
      case 'PageUp': mark(active - 8); break;
      case 'Enter': case ' ': choose(active); break;
      case 'Escape': e.stopPropagation(); close(); break;
      case 'Tab': close(false); return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          typed = (Date.now() - typedAt > 700 ? '' : typed) + e.key.toLowerCase();
          typedAt = Date.now();
          const n = items.findIndex((it, k) => k >= (typed.length > 1 ? active : active + 1) && it.textContent!.toLowerCase().replace(/^an? /, '').startsWith(typed));
          const m = n >= 0 ? n : items.findIndex((it) => it.textContent!.toLowerCase().replace(/^an? /, '').startsWith(typed));
          if (m >= 0) mark(m);
          break;
        }
        return;
    }
    e.preventDefault();
  });
  const outside = (e: Event) => { if (isOpen() && !host.contains(e.target as Node)) close(false); };
  document.addEventListener('pointerdown', outside);
  const onResize = (e?: Event) => { if (e?.target !== list && isOpen()) place(); };
  addEventListener('resize', onResize);
  addEventListener('scroll', onResize, true);
  sync();

  return {
    sync,
    destroy() { document.removeEventListener('pointerdown', outside); removeEventListener('resize', onResize); removeEventListener('scroll', onResize, true); btn.remove(); list.remove(); select.classList.remove('pg-native'); },
  };
}
