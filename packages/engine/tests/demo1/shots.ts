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
import type { SceneEntitySource } from '../../src/render/sceneEntities.js';
import { ParticleSystem, spawnExplosion, spawnRailTrail, type ParticleSpawnOptions } from '../../src/render/particleSystem.js';
import { RandomGenerator } from '@quake2ts/shared';

type Point = readonly [number, number, number];
const vec = (p: Point) => ({ x: p[0], y: p[1], z: p[2] });

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
  /** Draw the monsters and items of the entity lump where the map places them. */
  readonly entities?: boolean;
  /** Draw this first-person weapon at a frame (the blaster's idle frames are 9 to 52; 0 to 4 raise it from below the view). */
  readonly viewWeapon?: { readonly model: string; readonly frame: number; readonly oldFrame?: number; readonly frameLerp?: number };
  /** Effects spawned with a seeded generator and run for `age` seconds before the shot. */
  readonly particles?: {
    readonly seed: number;
    readonly age: number;
    readonly explosions?: readonly Point[];
    readonly railTrails?: readonly (readonly [Point, Point])[];
  };
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
  // MD2s: soldiers and the jacket armour in the courtyard, and the blaster in first person.
  { name: 'models-courtyard', origin: [480, 272, -40 + EYE], angles: [0, 200, 0], entities: true },
  { name: 'view-blaster', origin: [128, -320, 32 + EYE], angles: [0, 135, 0], viewWeapon: { model: 'models/weapons/v_blast/tris.md2', frame: 10 } },
  // Halfway between two firing frames, so both backends blend MD2 frames the same way.
  // Particles: an explosion and a rail trail in the courtyard, a tenth of a second in.
  {
    name: 'effects-courtyard', origin: [480, 272, -40 + EYE], angles: [0, 200, 0],
    particles: { seed: 1234, age: 0.1, explosions: [[340, 220, -20]], railTrails: [[[460, 300, -10], [200, 150, -10]]] },
  },
  { name: 'view-blaster-blend', origin: [128, -320, 32 + EYE], angles: [0, 135, 0], viewWeapon: { model: 'models/weapons/v_blast/tris.md2', oldFrame: 5, frame: 6, frameLerp: 0.5 } },
];

/**
 * A shot's particles as they stand at its age, frozen into spawn options (no velocity, the fade
 * folded into alpha) so a page can draw them without the simulation or the generator.
 */
export function shotParticles(shot: Demo1Shot): ParticleSpawnOptions[] {
  const spec = shot.particles;
  if (!spec) return [];
  const system = new ParticleSystem(4096, new RandomGenerator({ seed: spec.seed }));
  for (const origin of spec.explosions ?? []) spawnExplosion({ system, origin: vec(origin) });
  for (const [start, end] of spec.railTrails ?? []) spawnRailTrail({ system, start: vec(start), end: vec(end) });
  system.update(spec.age);
  const frozen: ParticleSpawnOptions[] = [];
  for (let i = 0; i < system.maxParticles; i++) {
    const p = system.getState(i);
    if (!p.alive) continue;
    const fade = p.fade ? Math.max(p.remaining / p.lifetime, 0) : 1;
    frozen.push({
      position: p.position,
      color: [p.color[0], p.color[1], p.color[2], p.color[3] * fade],
      size: p.size,
      lifetime: 1000,
      blendMode: p.blendMode,
    });
  }
  return frozen;
}

/** The model each spawned class shows, for the classes demo1's lump has near the shots (the game sets these in SP_*). */
const CLASS_MODELS: Readonly<Record<string, { readonly model: string; readonly skin?: number }>> = {
  monster_soldier_light: { model: 'models/monsters/soldier/tris.md2', skin: 0 },
  monster_soldier: { model: 'models/monsters/soldier/tris.md2', skin: 2 },
  monster_soldier_ss: { model: 'models/monsters/soldier/tris.md2', skin: 4 },
  item_armor_jacket: { model: 'models/items/armor/jacket/tris.md2' },
  item_armor_shard: { model: 'models/items/armor/shard/tris.md2' },
  item_health: { model: 'models/items/healing/medium/tris.md2' },
  item_health_small: { model: 'models/items/healing/stimpack/tris.md2' },
  weapon_supershotgun: { model: 'models/weapons/g_shotg2/tris.md2' },
};

/**
 * The lump's monsters and items as the entity sources the renderer reads, with `names[i]` the
 * model at index i, as the server's model configstrings would give them.
 */
export function shotModelEntities(map: BspMap, shot: Demo1Shot): { names: string[]; entities: SceneEntitySource[] } {
  const names = ['', 'maps/demo1.bsp'];
  const entities: SceneEntitySource[] = [];
  if (!shot.entities) return { names, entities };
  for (const entity of map.entities.entities) {
    const spawn = entity.classname ? CLASS_MODELS[entity.classname] : undefined;
    if (!spawn) continue;
    let modelindex = names.indexOf(spawn.model);
    if (modelindex < 0) modelindex = names.push(spawn.model) - 1;
    const [x, y, z] = (entity.properties.origin ?? '0 0 0').split(/\s+/).map(Number);
    const yaw = Number(entity.properties.angle ?? 0);
    const item = !entity.classname!.startsWith('monster_');
    entities.push({
      modelindex,
      origin: { x, y, z },
      angles: { x: 0, y: yaw, z: 0 },
      skin: spawn.skin ?? 0,
      frame: 0,
      effects: item ? 1 : 0, // items spin (EF_ROTATE)
    });
  }
  return { names, entities };
}

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
