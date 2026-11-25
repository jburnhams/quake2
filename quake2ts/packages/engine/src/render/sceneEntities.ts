/**
 * Turns the game's entities into what the renderer draws, with no GPU calls, so the client, the
 * explorer's /play page and tests share one reading of an entity. Today that is brush models
 * (doors, lifts, buttons, trains); MD2 models and the view weapon follow.
 *
 * It takes the fields every entity source has (a game entity in single player, an entity_state_t
 * from a demo or server), and a function from model index to model name, because the index only
 * means something through the server's model configstrings.
 */
import type { BrushModelInstance } from './worldDrawList.js';

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
