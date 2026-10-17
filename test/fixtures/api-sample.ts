/** The options of `make`. */
export interface MakeOpts extends BaseOpts {
  /** how many to make */
  count?: number;
  /** which kind; one of a few
   * @default 'plain' */
  kind?: 'plain' | 'fancy';
  /** no description is the point of this one */
  secret?: boolean;
  undocumented?: string;
}

/** Options every call takes. */
export interface BaseOpts {
  /** where it goes */
  at?: [number, number, number];
}

/**
 * Makes things.
 * @param o - what to make
 * @returns the things
 */
export function make(o: MakeOpts = {}): string[] { return Array(o.count ?? 1).fill('x'); }

export function nodoc(a: number): number { return a; }

/** A counter. */
export class Counter {
  /** the current value */
  value = 0;
  private hidden = 1;
  /** adds one */
  inc(by = 1): number { this.value += by; return this.value; }
  static from(n: number): Counter { const c = new Counter(); c.value = n; return c; }
}

/** The ways to say hello. */
export type Greeting = 'hi' | 'hello';

/** The default greeting. */
export const greeting: Greeting = 'hi';
