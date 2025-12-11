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
  const lifetime = time + 0.1;

  // EF_BLASTER: Yellow light
  if (effects & EntityEffects.Blaster) {
    addDLight(dlights, origin, [1.0, 1.0, 0.0], 200, 0, lifetime);
  }

  // EF_HYPERBLASTER: Yellow light
  if (effects & EntityEffects.HyperBlaster) {
    addDLight(dlights, origin, [1.0, 1.0, 0.0], 200, 0, lifetime);
  }

  // EF_ROCKET: Red/Orange light + Trail? (Trails handled elsewhere usually)
  // Task 4.1.4: "Color based on projectile type", "Trail effect" (Trails are particles, here we do lights)
  if (effects & EntityEffects.Rocket) {
    addDLight(dlights, origin, [1.0, 0.5, 0.2], 200, 0, lifetime);
  }

  // EF_GRENADE: Orange light
  if (effects & EntityEffects.Grenade) {
    addDLight(dlights, origin, [1.0, 0.5, 0.0], 100, 0, lifetime);
  }

  // EF_BFG: Green light
  if (effects & EntityEffects.Bfg) {
    addDLight(dlights, origin, [0.1, 1.0, 0.1], 300, 0, lifetime);
  }

  // EF_BLUEHYPERBLASTER: Blue light
  if (effects & EntityEffects.Bluehyperblaster) {
    addDLight(dlights, origin, [0.2, 0.2, 1.0], 200, 0, lifetime);
  }

  // EF_PLASMA: Blue light
  if (effects & EntityEffects.Plasma) {
    addDLight(dlights, origin, [0.2, 0.5, 1.0], 200, 0, lifetime);
  }

  // EF_TRACKER: Green light
  if (effects & EntityEffects.Tracker) {
    addDLight(dlights, origin, [0.2, 1.0, 0.2], 200, 0, lifetime);
  }

  // EF_TRAP: Green light
  if (effects & EntityEffects.Trap) {
    addDLight(dlights, origin, [0.2, 1.0, 0.2], 200, 0, lifetime);
  }

  // EF_COLOR_SHELL (16) often implies power shield or specific coloring?
  // EF_POWERSCREEN (32)
}
