// The light styles lab's facts, pure: which of a map's faces each light style lights, the map's
// lights that have a style, and what a pattern of letters plays as. qrad3 bakes one lightmap for
// each style that reaches a face (up to four, listed in the face's `styles`, 255 for none), so a
// face by a flickering light has two: the steady light of style 0 and the flicker's own.
import type { BspMap } from '@quake2ts/formats/bsp';
import { evaluateLightStyle } from '@quake2ts/engine';
import type { Vec } from '../orbit';

/** CL_SetLightstyle refuses a pattern of MAX_QPATH (64) letters or more. */
export const MAX_PATTERN = 63;

export interface MapLight {
  readonly origin: Vec;
  readonly style: number;
  readonly targetname: string | null;
}

export interface MapStyles {
  /** World faces lit by each style, by style number, in style order. */
  readonly faces: ReadonlyMap<number, number>;
  /** World faces with more than one lightmap. */
  readonly layered: number;
  /** World faces with any lightmap. */
  readonly lit: number;
  /** The map's `light` entities with a style other than 0. */
  readonly lights: readonly MapLight[];
}

export function mapStyles(map: BspMap): MapStyles {
  const world = map.models[0];
  const faces = new Map<number, number>();
  let layered = 0;
  let lit = 0;
  if (world) {
    for (let f = world.firstFace; f < world.firstFace + world.numFaces; f++) {
      const face = map.faces[f]!;
      // A face qrad3 did not light (sky, water, glass) has no samples and styles of 0, 0, 0, 0.
      if (face.lightOffset < 0) continue;
      const styles = [...new Set(face.styles.filter((s) => s !== 255))];
      if (styles.length === 0) continue;
      lit++;
      if (styles.length > 1) layered++;
      for (const s of styles) faces.set(s, (faces.get(s) ?? 0) + 1);
    }
  }
  const lights = map.entities.entities
    .filter((e) => e.classname === 'light' && Number(e.properties.style ?? 0) > 0)
    .map((e) => {
      const [x, y, z] = (e.properties.origin ?? '0 0 0').split(/\s+/).map(Number);
      return { origin: { x: x ?? 0, y: y ?? 0, z: z ?? 0 }, style: Number(e.properties.style), targetname: e.properties.targetname ?? null };
    });
  return { faces: new Map([...faces].sort(([a], [b]) => a - b)), layered, lit, lights };
}

/** A pattern as typed, or why it is not one: letters a to z only, at most MAX_PATTERN of them. */
export function checkPattern(raw: string): { pattern: string } | { error: string } {
  const pattern = raw.trim().toLowerCase();
  if (!pattern) return { error: 'Type at least one letter, a (dark) to z (twice as bright as normal).' };
  if (!/^[a-z]+$/.test(pattern)) return { error: 'Use only the letters a to z: each is the brightness for a tenth of a second.' };
  if (pattern.length > MAX_PATTERN) return { error: `At most ${MAX_PATTERN} letters: the client refuses a longer style.` };
  return { pattern };
}

/** What `pattern` plays as, one value a tenth, through the renderer's own evaluateLightStyle. */
export function playPattern(pattern: string): number[] {
  return Array.from({ length: Math.max(pattern.length, 1) }, (_, tenth) => evaluateLightStyle(pattern, (tenth + 0.5) / 10));
}
