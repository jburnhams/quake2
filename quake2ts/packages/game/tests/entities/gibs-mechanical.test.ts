
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '../test-helpers';
import { EntitySystem } from '../../src/entities/system';
import { Entity, MoveType, Solid, DeadFlag } from '../../src/entities/entity';
import { throwGibs, GIB_METALLIC, GIB_ORGANIC } from '../../src/entities/gibs';
import { SP_monster_tank } from '../../src/entities/monsters/tank';
import { registerGunnerSpawns } from '../../src/entities/monsters/gunner';

// SP_monster_gunner is not exported directly, but registerGunnerSpawns is.
// We need to extract it or export it. For now, let's look at how other tests do it.
// Actually, I can just modify gunner.ts to export SP_monster_gunner.
// But first, let's fix the test to use the registry if I can't access it.
// However, the cleanest way is to export SP_monster_gunner.

// Since I cannot modify gunner.ts just for the test without doing it in the tool calls,
// I will just use the registry to get the spawn function.
import { SpawnRegistry } from '../../src/entities/spawn';

describe('Mechanical Gibs', () => {
  let context: ReturnType<typeof createTestContext>;
  let sys: EntitySystem;
  let spawnedEntities: Entity[];
  let SP_monster_gunner: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createTestContext();
    sys = context.entities;

    spawnedEntities = [];
    sys.spawn = vi.fn(() => {
        const ent = new Entity(spawnedEntities.length + 1);
        spawnedEntities.push(ent);
        return ent;
    });

    sys.modelIndex = vi.fn(() => 1);

    // Get SP_monster_gunner from registry
    const registry = {
        register: (name: string, func: any) => {
            if (name === 'monster_gunner') SP_monster_gunner = func;
        }
    } as unknown as SpawnRegistry;
    registerGunnerSpawns(registry);
  });

  it('throwGibs spawns organic gibs by default', () => {
    const origin = { x: 0, y: 0, z: 0 };
    throwGibs(sys, origin, 100);

    let meatCount = 0;
    spawnedEntities.forEach(ent => {
        if (ent.classname === 'gib') {
             if (ent.movetype === MoveType.Toss) {
                 meatCount++;
             }
        }
    });

    expect(meatCount).toBeGreaterThan(0);
  });

  it('throwGibs spawns metallic gibs when type is GIB_METALLIC', () => {
      const origin = { x: 0, y: 0, z: 0 };

      // @ts-ignore
      throwGibs(sys, origin, 100, GIB_METALLIC);

      let metalCount = 0;
      let organicCount = 0;

      spawnedEntities.forEach(ent => {
          if (ent.classname === 'gib') {
              if (ent.movetype === MoveType.Bounce) {
                  metalCount++;
              } else if (ent.movetype === MoveType.Toss) {
                  organicCount++;
              }
          }
      });

      expect(metalCount).toBeGreaterThan(0);
      expect(organicCount).toBe(0);
  });

  it('monster_tank throws metallic gibs on death', () => {
      const tank = sys.spawn();
      SP_monster_tank(tank, context);

      tank.health = -50;
      tank.die!(tank, tank, tank, 100, { x: 0, y: 0, z: 0 });

      let metalCount = 0;
      let organicCount = 0;

      spawnedEntities.forEach(ent => {
          if (ent.classname === 'gib') {
              if (ent.movetype === MoveType.Bounce) {
                  metalCount++;
              } else if (ent.movetype === MoveType.Toss) {
                  organicCount++;
              }
          }
      });

      expect(metalCount).toBeGreaterThan(0);
      expect(organicCount).toBe(0);
  });

  it('monster_gunner throws metallic gibs on death', () => {
    const gunner = sys.spawn();
    SP_monster_gunner(gunner, context);

    gunner.health = -50;
    gunner.die!(gunner, gunner, gunner, 100, { x: 0, y: 0, z: 0 });

    let metalCount = 0;
    let organicCount = 0;

    spawnedEntities.forEach(ent => {
        if (ent.classname === 'gib') {
            if (ent.movetype === MoveType.Bounce) {
                metalCount++;
            } else if (ent.movetype === MoveType.Toss) {
                organicCount++;
            }
        }
    });

    expect(metalCount).toBeGreaterThan(0);
    expect(organicCount).toBe(0);
});
});
