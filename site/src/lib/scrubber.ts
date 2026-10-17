/*
 * Keeps a time slider and its clock in step with a player. Writing to either one makes the browser redo
 * style and layout work, so a write happens only when something visible would change: the clock shows tenths
 * of a second, and the slider moves a pixel or so at most. Doing it on every frame cost about as much
 * as drawing the figure.
 */
const STEPS = 400;   // positions the slider is moved between; plenty for a slider a few hundred pixels wide

/** Returns the function to call each frame with the player; it writes to the slider and the clock only when they would show something new. */
export function scrubberSync(range: HTMLInputElement, clock?: Element | null) {
  let text = '', step = -1;
  return (player: { time: number; duration: number }, skipRange = false) => {
    const t = `${player.time.toFixed(1)} / ${player.duration.toFixed(1)} s`;
    if (clock && t !== text) { text = t; clock.textContent = t; }
    const s = Math.round((player.time / (player.duration || 1)) * STEPS);
    if (!skipRange && s !== step) { step = s; range.value = String(player.time); }
  };
}
