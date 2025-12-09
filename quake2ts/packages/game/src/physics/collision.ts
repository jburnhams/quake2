import { Entity, Solid, MoveType } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { GameTraceResult } from '../imports.js';

/**
 * Resolves collision impact between two entities.
 * Corresponds to SV_Impact in sv_phys.c.
 */
export function resolveImpact(ent: Entity, trace: GameTraceResult, system: EntitySystem): void {
  const other = trace.ent;

  // We only care if we hit an entity
  if (!other) {
    return;
  }

  // Call touch on the entity we hit
  if (other.touch) {
    // GameTraceResult doesn't have a 'surface' object, it has surfaceFlags.
    // However, touch callback expects a surface. In Q2 this is csurface_t.
    // We pass undefined or null if not available, or mock it.
    // Actually GameImports trace return GameTraceResult which only has surfaceFlags.
    // We can cast or change the type if needed, but for now passing undefined is safe as most logic uses plane/flags.
    other.touch(other, ent, trace.plane, undefined);
  }

  // Call touch on the moving entity
  if (ent.touch) {
    ent.touch(ent, other, trace.plane, undefined);
  }
}

/**
 * Checks for triggers that the entity is currently touching.
 * Corresponds to G_TouchTriggers in g_phys.c.
 */
export function checkTriggers(ent: Entity, system: EntitySystem): void {
  if (ent.movetype === MoveType.None) {
    return;
  }

  // We need to find all trigger entities that intersect with 'ent'
  // Use spatial query if available.
  const candidates = system.findInBox(ent.absmin, ent.absmax);

  for (const other of candidates) {
    if (other === ent) continue;
    if (other.solid !== Solid.Trigger) continue;
    if (!other.touch) continue;

    // AABB intersection test
    // Usually triggers are Solid.Trigger which are bounding boxes or brush models.
    // Assuming findInBox returns loose candidates, strict AABB check is needed.
    if (ent.absmax.x < other.absmin.x || ent.absmin.x > other.absmax.x) continue;
    if (ent.absmax.y < other.absmin.y || ent.absmin.y > other.absmax.y) continue;
    if (ent.absmax.z < other.absmin.z || ent.absmin.z > other.absmax.z) continue;

    other.touch(other, ent);
  }
}
