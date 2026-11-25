/**
 * The demo1 render gate: fixed camera spots in the real demo1.bsp (from the demo pak0, fetched by
 * scripts/fetch-paks.sh), rendered by both the WebGL and the WebGPU backend through the same
 * prepareWorld data. Synthetic one-quad scenes passed while the real map rendered untextured and
 * with every face sharing one face's uniforms; these shots are what caught that.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BspMap } from '../../src/assets/bsp.js';
import type { BrushModelInstance } from '../../src/render/worldDrawList.js';

export interface Demo1Shot {
  readonly name: string;
  /** Eye position (Quake units) and view angles in degrees: pitch, yaw, roll. */
  readonly origin: readonly [number, number, number];
  readonly angles: readonly [number, number, number];
  /**
   * Share of the frame that is sky. Sky faces are not drawn until the skybox is wired into
   * prepareWorld, so they show the clear colour and count against coverage.
   */
  readonly sky?: number;
  /** Brush models moved from where the map puts them (submodel number to offset), as an open door is. */
  readonly moved?: Readonly<Record<number, readonly [number, number, number]>>;
}

const EYE = 22; // viewheight above a spawn point's origin

/** Spawn points from demo1's entity lump, each looking along its spawn angle. */
export const DEMO1_SHOTS: readonly Demo1Shot[] = [
  { name: 'player-start', origin: [128, -320, 32 + EYE], angles: [0, 135, 0] },
  { name: 'dm-courtyard', origin: [480, 272, -40 + EYE], angles: [0, 180, 0] },
  { name: 'dm-lower-hall', origin: [608, -224, -168 + EYE], angles: [0, 45, 0] },
  { name: 'dm-west', origin: [-392, 840, -104 + EYE], angles: [0, 0, 0], sky: 0.15 },
  { name: 'coop-far-start', origin: [-1592, 1528, 128 + EYE], angles: [10, 0, 0], sky: 0.02 },
  // Brush models: the func_explosive wall (*20) by the super shotgun, and the func_door (*19)
  // shut and then raised 120 units, which only draws right if the door's transform is applied.
  { name: 'brush-wall', origin: [28, 24, 64], angles: [0, 90, 0] },
  { name: 'door-shut', origin: [-1000, 1632, 0], angles: [0, 180, 0] },
  { name: 'door-raised', origin: [-1000, 1632, 0], angles: [0, 180, 0], moved: { 19: [0, 0, 120] } },
];

/**
 * The brush models the game would draw at the map's start: every entity with a submodel except
 * triggers, which the game hides (SVF_NOCLIENT). A shot's `moved` offsets them.
 */
export function shotBrushModels(map: BspMap, shot: Demo1Shot): BrushModelInstance[] {
  const instances: BrushModelInstance[] = [];
  for (const entity of map.entities.entities) {
    const model = entity.properties.model;
    if (!model?.startsWith('*') || entity.classname?.startsWith('trigger_')) continue;
    const index = Number(model.slice(1));
    const [x, y, z] = (entity.properties.origin ?? '0 0 0').split(/\s+/).map(Number);
    const [dx, dy, dz] = shot.moved?.[index] ?? [0, 0, 0];
    instances.push({ model: index, origin: { x: x + dx, y: y + dy, z: z + dz } });
  }
  return instances;
}

export const SHOT_WIDTH = 320;
export const SHOT_HEIGHT = 240;
/** A clear colour no Quake 2 palette entry produces, so uncovered pixels are countable. */
export const CLEAR_COLOR: readonly [number, number, number, number] = [1, 0, 1, 1];

const here = path.dirname(fileURLToPath(import.meta.url));
export const QUAKE2TS_ROOT = path.resolve(here, '../../../..');
export const DEMO_PAK = path.join(QUAKE2TS_ROOT, '.paks', 'baseq2', 'pak0.pak');
export const SNAPSHOT_DIR = path.join(here, '__snapshots__');

export function demoPakAvailable(): boolean {
  return fs.existsSync(DEMO_PAK);
}

export interface ShotStats {
  /** Share of pixels that are not the clear colour. */
  readonly coverage: number;
  /** Distinct colours after quantising to 5 bits a channel: a flat-shaded or untextured frame has few. */
  readonly distinctColors: number;
  /** Mean luminance of covered pixels, 0..255. */
  readonly meanLuminance: number;
  /** Mean absolute difference between horizontal neighbours: texture detail, near zero when flat. */
  readonly detail: number;
}

export function analyseShot(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): ShotStats {
  let covered = 0;
  let luminance = 0;
  let detail = 0;
  const colors = new Set<number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (r === 255 && g === 0 && b === 255) continue;
      covered++;
      luminance += 0.299 * r + 0.587 * g + 0.114 * b;
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
      if (x > 0) {
        detail += (Math.abs(r - rgba[i - 4]) + Math.abs(g - rgba[i - 3]) + Math.abs(b - rgba[i - 2])) / 3;
      }
    }
  }
  return {
    coverage: covered / (width * height),
    distinctColors: colors.size,
    meanLuminance: covered ? luminance / covered : 0,
    detail: covered ? detail / covered : 0,
  };
}

/** What every shot must meet in both backends. */
export const SHOT_EXPECTATIONS = {
  minCoverage: 0.97,
  minDistinctColors: 60,
  minLuminance: 8,
  maxLuminance: 200,
  minDetail: 0.8,
};

/**
 * Compares a shot with its committed baseline (writing the baseline when there is none or
 * UPDATE_VISUAL=1). Strict on purpose: the shared expectSnapshot passes up to 75% difference.
 */
export async function expectShotBaseline(
  backend: 'webgl' | 'webgpu',
  name: string,
  rgba: Uint8ClampedArray,
  width = SHOT_WIDTH,
  height = SHOT_HEIGHT,
): Promise<void> {
  const { savePNG, loadPNG, compareSnapshots } = await import('@quake2ts/test-utils');
  const baselinePath = path.join(SNAPSHOT_DIR, 'baselines', `${backend}-${name}.png`);
  const actualPath = path.join(SNAPSHOT_DIR, 'actual', `${backend}-${name}.png`);
  if (process.env.UPDATE_VISUAL === '1' || !fs.existsSync(baselinePath)) {
    await savePNG(rgba, width, height, baselinePath);
    return;
  }
  const baseline = await loadPNG(baselinePath);
  const result = await compareSnapshots(rgba, baseline.data, width, height, { threshold: 0.1, maxDifferencePercent: 0.5 });
  if (!result.passed) {
    await savePNG(rgba, width, height, actualPath);
    throw new Error(`${backend} ${name}: ${result.percentDifferent.toFixed(2)}% of pixels differ from ${baselinePath} (actual in ${actualPath})`);
  }
}
