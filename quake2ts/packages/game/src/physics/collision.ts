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
  // Since EntitySystem doesn't expose a spatial query for entities directly (other than trace),
  // we iterate. In a real engine this uses the area node links (sv.areanodes).
  // Optimization TODO: Add spatial hash/tree to EntitySystem for fast box queries.

  // Note: triggers are usually Solid.Trigger

  system.forEachEntity((other) => {
    if (other === ent) return;
    if (other.solid !== Solid.Trigger) return;
    if (!other.touch) return;

    // AABB intersection test
    if (ent.absmax.x < other.absmin.x || ent.absmin.x > other.absmax.x) return;
    if (ent.absmax.y < other.absmin.y || ent.absmin.y > other.absmax.y) return;
    if (ent.absmax.z < other.absmin.z || ent.absmin.z > other.absmax.z) return;

    // Check strict intersection?
    // Quake 2 assumes AABB intersection is enough for triggers (since they are usually boxes).
    // If the trigger is a BSP model, we might want exact check, but G_TouchTriggers uses box intersection
    // against the head node of the trigger model.
    // Usually triggers are simple boxes or brush models.
    // For brush models, Q2 G_TouchTriggers does:
    // if (hit->solid == SOLID_BSP) { ... trap with box ... }
    // We'll stick to AABB for now as it covers 99% of cases.

    other.touch(other, ent);
  });
}
