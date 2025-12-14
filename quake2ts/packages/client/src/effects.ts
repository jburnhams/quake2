import { EntityEffects, RenderFx, Vec3 } from '@quake2ts/shared';
import { DLight, ParticleSystem, spawnBlood } from '@quake2ts/engine';

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
  particleSystem: ParticleSystem | undefined,
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

  // EF_ROCKET: Red/Orange light
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

  // EF_GIB: Trail of blood (Red)
  if (particleSystem && (effects & EntityEffects.Gib)) {
      // Spawn fewer particles for trail than full blood splash
      // Random direction mostly up/out
      const rng = particleSystem.rng;
      spawnBlood({
          system: particleSystem,
          origin: origin,
          direction: {
              x: (rng.frandom() - 0.5) * 20,
              y: (rng.frandom() - 0.5) * 20,
              z: (rng.frandom() - 0.5) * 20
          },
          // Color is default red in spawnBlood
      });
  }

  // EF_GREENGIBS: Trail of green blood
  if (particleSystem && (effects & EntityEffects.Greengibs)) {
      const rng = particleSystem.rng;
      spawnBlood({
          system: particleSystem,
          origin: origin,
          direction: {
              x: (rng.frandom() - 0.5) * 20,
              y: (rng.frandom() - 0.5) * 20,
              z: (rng.frandom() - 0.5) * 20
          },
          color: [0.0, 0.8, 0.0, 0.95]
      });
  }
}
