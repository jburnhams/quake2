/**
 * Shared lighting utilities for both WebGL and WebGPU renderers
 */

// Re-export existing utilities
export { cullLights } from '../lightCulling.js';

/**
 * Evaluate a Quake light style pattern at a given time
 * @param pattern Light style pattern string (e.g., "abcdefghijk")
 * @param time Time in seconds
 * @returns Light intensity multiplier (0.0-1.0)
 */
export function evaluateLightStyle(pattern: string, time: number): number {
  if (!pattern) return 1.0;
  const frame = Math.floor(time * 10) % pattern.length;
  const charCode = pattern.charCodeAt(frame);
  return (charCode - 97) / 12.0;
}

/**
 * Prepare light styles with pattern overrides applied
 * @param baseLightStyles Base light style intensities
 * @param overrides Map of style index to pattern string
 * @param timeSeconds Current time in seconds
 * @returns Array of effective light style intensities
 */
export function prepareLightStyles(
  baseLightStyles: ReadonlyArray<number>,
  overrides?: Map<number, string>,
  timeSeconds: number = 0
): ReadonlyArray<number> {
  if (!overrides || overrides.size === 0) {
    return baseLightStyles;
  }

  const styles = [...baseLightStyles];
  for (const [index, pattern] of overrides) {
    while (styles.length <= index) styles.push(1.0);
    styles[index] = evaluateLightStyle(pattern, timeSeconds);
  }
  return styles;
}
