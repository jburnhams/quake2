import { EntityEffects, RenderFx, Vec3 } from '@quake2ts/shared';
import { DLight } from '@quake2ts/engine';

// Helper to add dlight
function addDLight(
  dlights: DLight[],
  origin: Vec3,
  color: [number, number, number],
  intensity: number,
  minLight: number = 0,
  die: number = 0
) {
  dlights.push({
    origin,
    color: { x: color[0], y: color[1], z: color[2] },
    intensity,
    minLight,
    die,
  });
}

export function processEntityEffects(
  entity: {
    effects: number;
    renderfx: number;
    origin: Vec3;
    alpha?: number;
  },
  dlights: DLight[],
  time: number
) {
  const { effects, origin } = entity;

  // EF_BLASTER: Yellow light
  if (effects & EntityEffects.Blaster) {
    addDLight(dlights, origin, [1.0, 1.0, 0.0], 200, 0, time + 0.1);
  }

  // EF_HYPERBLASTER: Yellow light (same as blaster?)
  // Quake 2 source usually treats them similarly or slightly different.
  // cl_fx.c: CL_BlasterTrail uses yellow/orange.
  if (effects & EntityEffects.HyperBlaster) {
    addDLight(dlights, origin, [1.0, 1.0, 0.0], 200, 0, time + 0.1);
  }

  // EF_ROCKET: Red light
  if (effects & EntityEffects.Rocket) {
    addDLight(dlights, origin, [1.0, 0.5, 0.2], 200, 0, time + 0.1);
  }

  // EF_GRENADE: Orange light? (Usually no light on grenade flight in vanilla Q2, but sometimes mods add it)
  // Standard Q2 cl_fx.c doesn't add light for grenade flight, only trails.
  // However, we can add a faint one if desired.
  // Let's stick to vanilla behavior for now: NO light for grenade unless desired.
  if (effects & EntityEffects.Grenade) {
    // Optional: addDLight(dlights, origin, [1.0, 0.5, 0.0], 100);
  }

  // EF_BFG: Green light
  if (effects & EntityEffects.Bfg) {
    addDLight(dlights, origin, [0.0, 1.0, 0.0], 300, 0, time + 0.1);
  }

  // EF_BLUEHYPERBLASTER: Blue light
  if (effects & EntityEffects.Bluehyperblaster) {
    addDLight(dlights, origin, [0.0, 0.0, 1.0], 200, 0, time + 0.1);
  }

  // EF_PLASMA: Blue light
  if (effects & EntityEffects.Plasma) {
    addDLight(dlights, origin, [0.2, 0.5, 1.0], 200, 0, time + 0.1);
  }

  // EF_TRACKER: Green light?
  if (effects & EntityEffects.Tracker) {
    // Tracker usually has a distinctive look.
    addDLight(dlights, origin, [0.0, 1.0, 0.0], 200, 0, time + 0.1);
  }

  // EF_TRAP: Green light?
  if (effects & EntityEffects.Trap) {
    addDLight(dlights, origin, [0.0, 1.0, 0.0], 200, 0, time + 0.1);
  }

  // EF_DOUBLE: Yellow/Orange shell light? (Usually handled by RenderFx tint, but maybe light too)
  // Not strictly a dlight in vanilla, usually shell effect.

  // EF_POWERSCREEN: Green shell effect.

  // Muzzle flashes are usually handled via events or distinct flags if persistent.
  // EF_ANIM_ALL / EF_ANIM_ALLFAST are animation flags.
}
