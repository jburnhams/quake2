import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../src/entities/system.js';
import { Entity, MoveType, Solid, ServerFlags } from '../src/entities/entity.js';
import { monster_fire_bullet_v2, monster_fire_rocket } from '../src/entities/monsters/attack.js';
import { DamageMod } from '../src/combat/damageMods.js';
import { Vec3, ZERO_VEC3, lengthVec3, subtractVec3 } from '@quake2ts/shared';

// Mock dependencies
vi.mock('../src/combat/damage.js', () => ({
  T_Damage: vi.fn(),
  T_RadiusDamage: vi.fn(),
}));

vi.mock('../src/entities/projectiles.js', () => ({
  createRocket: vi.fn(),
  createGrenade: vi.fn(),
  createBlasterBolt: vi.fn(),
  createBfgBall: vi.fn(),
  createIonRipper: vi.fn(),
  createBlueBlaster: vi.fn(),
  createFlechette: vi.fn(),
}));

import { T_Damage } from '../src/combat/damage.js';
import { createRocket } from '../src/entities/projectiles.js';

describe('Difficulty Scaling', () => {
  let sys: EntitySystem;
  let monster: Entity;
  let target: Entity;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createSystem = (skill: number) => {
    // Mock engine and imports
    const mockEngine = {
        sound: vi.fn(),
        modelIndex: vi.fn().mockReturnValue(1),
    };

    // Mock trace to always hit target
    const mockTrace = vi.fn().mockImplementation((start, end, mins, maxs, passEnt) => {
        return {
            fraction: 0.5,
            endpos: { x: (start.x + end.x) * 0.5, y: (start.y + end.y) * 0.5, z: (start.z + end.z) * 0.5 },
            ent: target,
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 }
        };
    });

    sys = new EntitySystem(mockEngine as any, { trace: mockTrace } as any, undefined, undefined, undefined, undefined, skill);
    // Add game property for access if needed (though we access sys directly)
    (sys as any)._game = { deathmatch: false };
    sys.beginFrame(1);

    monster = sys.spawn();
    monster.classname = 'monster_soldier';
    monster.svflags |= ServerFlags.Monster;
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };

    target = sys.spawn();
    target.classname = 'player';
    target.takedamage = true;
    target.health = 100;
    target.origin = { x: 100, y: 0, z: 0 };

    return sys;
  };

  it('should scale bullet damage based on skill', () => {
    // Easy (0) -> 10 * 0.75 = 7.5 -> 7
    createSystem(0);
    monster_fire_bullet_v2(monster, monster.origin, { x: 1, y: 0, z: 0 }, 10, 0, 0, 0, 0, sys, DamageMod.MACHINEGUN);
    expect(T_Damage).toHaveBeenCalled();
    const damageEasy = (T_Damage as any).mock.calls[0][6];
    expect(damageEasy).toBe(7);

    vi.clearAllMocks();

    // Medium (1) -> 10 * 1.0 = 10
    createSystem(1);
    monster_fire_bullet_v2(monster, monster.origin, { x: 1, y: 0, z: 0 }, 10, 0, 0, 0, 0, sys, DamageMod.MACHINEGUN);
    const damageMedium = (T_Damage as any).mock.calls[0][6];
    expect(damageMedium).toBe(10);

    vi.clearAllMocks();

    // Hard (2) -> 10 * 1.25 = 12.5 -> 12
    createSystem(2);
    monster_fire_bullet_v2(monster, monster.origin, { x: 1, y: 0, z: 0 }, 10, 0, 0, 0, 0, sys, DamageMod.MACHINEGUN);
    const damageHard = (T_Damage as any).mock.calls[0][6];
    expect(damageHard).toBe(12);

    vi.clearAllMocks();

    // Nightmare (3) -> 10 * 1.5 = 15
    createSystem(3);
    monster_fire_bullet_v2(monster, monster.origin, { x: 1, y: 0, z: 0 }, 10, 0, 0, 0, 0, sys, DamageMod.MACHINEGUN);
    const damageNightmare = (T_Damage as any).mock.calls[0][6];
    expect(damageNightmare).toBe(15);
  });

  it('should scale projectile damage based on skill', () => {
    // Easy (0) -> 50 * 0.75 = 37.5 -> 37
    createSystem(0);
    monster_fire_rocket(monster, monster.origin, { x: 1, y: 0, z: 0 }, 50, 500, 0, sys);
    expect(createRocket).toHaveBeenCalled();
    const damageEasy = (createRocket as any).mock.calls[0][4];
    expect(damageEasy).toBe(37);

    vi.clearAllMocks();

    // Nightmare (3) -> 50 * 1.5 = 75
    createSystem(3);
    monster_fire_rocket(monster, monster.origin, { x: 1, y: 0, z: 0 }, 50, 500, 0, sys);
    const damageNightmare = (createRocket as any).mock.calls[0][4];
    expect(damageNightmare).toBe(75);
  });

  it('should not scale damage for non-monster attackers', () => {
      // Player
      createSystem(2); // Hard
      const player = sys.spawn();
      player.classname = 'player';
      // No monster flag

      monster_fire_bullet_v2(player, player.origin, { x: 1, y: 0, z: 0 }, 10, 0, 0, 0, 0, sys, DamageMod.MACHINEGUN);
      const damage = (T_Damage as any).mock.calls[0][6];
      expect(damage).toBe(10); // Should remain 10, not 12
  });

  it('should scale accuracy (spread) based on skill', () => {
      // Mock Math.random to return 1.0 (so crandom = 1.0)
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1.0);

      const dir: Vec3 = { x: 1, y: 0, z: 0 };
      const spread = 0.1;

      // Easy (0) -> Scale 1.5
      createSystem(0);
      monster_fire_bullet_v2(monster, monster.origin, dir, 10, 0, spread, 0, 0, sys, DamageMod.MACHINEGUN);
      const dirEasy = (T_Damage as any).mock.calls[0][3] as Vec3;
      // direction calculated with spread * 1.5
      // With crandom=1 (from random=1), spread adds to direction.
      // Larger spread = larger deviation.
      const deviationEasy = lengthVec3(subtractVec3(dirEasy, dir));

      vi.clearAllMocks();
      vi.spyOn(Math, 'random').mockReturnValue(1.0); // Restore mock

      // Nightmare (3) -> Scale 0.5
      createSystem(3);
      monster_fire_bullet_v2(monster, monster.origin, dir, 10, 0, spread, 0, 0, sys, DamageMod.MACHINEGUN);
      const dirNightmare = (T_Damage as any).mock.calls[0][3] as Vec3;
      const deviationNightmare = lengthVec3(subtractVec3(dirNightmare, dir));

      console.log(`Deviation - Easy: ${deviationEasy}, Nightmare: ${deviationNightmare}`);

      expect(deviationEasy).toBeGreaterThan(deviationNightmare);

      randomSpy.mockRestore();
  });
});
