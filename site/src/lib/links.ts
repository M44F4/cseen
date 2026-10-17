import { playgroundHref } from './share.ts';

/** the site is served from a base path on some hosts (GitHub Pages), so links are built from it */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const toPlayground = (code: string) => playgroundHref(code, BASE);
