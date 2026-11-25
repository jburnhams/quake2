/**
 * Turns the game's entities into what the renderer draws, with no GPU calls, so the client, the
 * explorer's /play page and tests share one reading of an entity: brush models (doors, lifts,
 * buttons, trains), MD2 models (monsters, items, gibs) and the first-person weapon.
 *
 * It takes the fields every entity source has (a game entity in single player, an entity_state_t
 * from a demo or server), and a function from model index to model name, because the index only
 * means something through the server's model configstrings.
 */
import type { Md2Model } from '../assets/md2.js';
import type { RenderableMd2 } from './scene.js';
import { brushModelTransform, type BrushModelInstance } from './worldDrawList.js';

type Vec = { readonly x: number; readonly y: number; readonly z: number };

/** The entity fields the renderer reads. */
export interface SceneEntitySource {
  readonly modelindex: number;
  readonly origin: Vec;
  readonly angles: Vec;
  /** SVF_ flags; an entity with SVF_NOCLIENT (1) is never sent to clients, so it is not drawn. */
  readonly svflags?: number;
  /** False for a free entity slot. */
  readonly inUse?: boolean;
  /** Animation frame and skin number of an MD2. */
  readonly frame?: number;
  readonly skin?: number;
  /** EF_ flags; EF_ROTATE (1) spins items in place. */
  readonly effects?: number;
}

const SVF_NOCLIENT = 1;

/**
 * The brush models to draw: every entity in use whose model is a BSP submodel ("*3"), at its
 * origin and angles, as CL_AddPacketEntities hands them to R_DrawBrushModel.
 */
export function brushModelsFromEntities(
  entities: Iterable<SceneEntitySource>,
  modelName: (index: number) => string | undefined
): BrushModelInstance[] {
  const instances: BrushModelInstance[] = [];
  for (const entity of entities) {
    if (entity.inUse === false || !entity.modelindex) continue;
    if ((entity.svflags ?? 0) & SVF_NOCLIENT) continue;
    const name = modelName(entity.modelindex);
    if (!name?.startsWith('*')) continue;
    const model = Number(name.slice(1));
    if (!Number.isInteger(model) || model <= 0) continue;
    instances.push({ model, origin: entity.origin, angles: entity.angles });
  }
  return instances;
}

const EF_ROTATE = 1;

/**
 * An alias model's matrix, as R_DrawAliasModel builds it: R_RotateForEntity with the pitch
 * negated, because MD2s are modelled with pitch the other way round.
 */
export function aliasModelTransform(
  origin: Vec,
  angles: Vec
): Float32Array {
  return brushModelTransform({ model: 0, origin, angles: { x: -angles.x, y: angles.y, z: angles.z } });
}

export interface ModelEntitiesOptions {
  /** Loaded models by name, from prepareModels. */
  readonly models: ReadonlyMap<string, Md2Model>;
  /** Seconds, for items that spin (EF_ROTATE turns them 100 degrees a second). */
  readonly timeSeconds?: number;
  /** The entity the view is from: the player is not drawn in first person. */
  readonly viewer?: SceneEntitySource;
}

/**
 * The MD2 models to draw: monsters, items, weapons on the floor, gibs. Each is an entity in use
 * with an `.md2` model that has been loaded, at its frame, with the skin its number picks.
 * Frames are not blended yet; the entity's current frame is drawn.
 */
export function modelEntitiesFromEntities(
  entities: Iterable<SceneEntitySource>,
  modelName: (index: number) => string | undefined,
  options: ModelEntitiesOptions
): RenderableMd2[] {
  const drawn: RenderableMd2[] = [];
  let id = 0;
  for (const entity of entities) {
    id++;
    if (entity === options.viewer || entity.inUse === false || !entity.modelindex) continue;
    if ((entity.svflags ?? 0) & SVF_NOCLIENT) continue;
    const name = modelName(entity.modelindex);
    const model = name ? options.models.get(name) : undefined;
    if (!model) continue;
    const frame = Math.max(0, Math.min(model.frames.length - 1, entity.frame ?? 0));
    const angles = (entity.effects ?? 0) & EF_ROTATE
      ? { x: 0, y: ((options.timeSeconds ?? 0) * 100) % 360, z: 0 }
      : entity.angles;
    const skin = model.skins[entity.skin ?? 0] ?? model.skins[0];
    drawn.push({
      type: 'md2',
      model,
      blend: { frame0: frame, frame1: frame, lerp: 0 },
      transform: aliasModelTransform(entity.origin, angles),
      skin: skin?.name,
      id,
    });
  }
  return drawn;
}

export interface ViewWeaponOptions {
  /** The eye position and view angles the frame is drawn from. */
  readonly origin: Vec;
  readonly angles: Vec;
  /** The weapon's model name ("models/weapons/v_blast/tris.md2") and its frame. */
  readonly model: string | undefined;
  readonly frame: number;
  readonly models: ReadonlyMap<string, Md2Model>;
}

/** The first-person weapon, as CL_AddViewWeapon places it: at the eye, turned with the view. */
export function viewWeaponEntity(options: ViewWeaponOptions): RenderableMd2 | undefined {
  const model = options.model ? options.models.get(options.model) : undefined;
  if (!model) return undefined;
  const frame = Math.max(0, Math.min(model.frames.length - 1, options.frame));
  return {
    type: 'md2',
    model,
    blend: { frame0: frame, frame1: frame, lerp: 0 },
    transform: aliasModelTransform(options.origin, options.angles),
    skin: model.skins[0]?.name,
    isViewModel: true,
  };
}
