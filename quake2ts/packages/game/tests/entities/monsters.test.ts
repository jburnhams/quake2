import { describe, it, expect, vi } from 'vitest';
import { createGame } from '../../src/index.js';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Solid } from '../../src/entities/entity.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Monster Spawning', () => {
  const { imports, engine } = createGameImportsAndEngine();

  const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
  const entities = new EntitySystem(engine, imports);
  const registry = createDefaultSpawnRegistry(game);

  const monsters = [
    { classname: 'monster_soldier', expectedHealth: 20 },
    { classname: 'monster_gunner', expectedHealth: 175 },
    { classname: 'monster_berserk', expectedHealth: 240 },
    { classname: 'monster_gladiator', expectedHealth: 400 },
    { classname: 'monster_medic', expectedHealth: 300 },
    { classname: 'monster_mutant', expectedHealth: 300 },
    { classname: 'monster_parasite', expectedHealth: 175 },
    { classname: 'monster_tank', expectedHealth: 750 },
    { classname: 'monster_tank_commander', expectedHealth: 1000 },
    { classname: 'monster_brain', expectedHealth: 300 },
    { classname: 'monster_flipper', expectedHealth: 50 },
    { classname: 'monster_chick', expectedHealth: 175 },
    { classname: 'monster_icarus', expectedHealth: 240 },
    { classname: 'monster_flyer', expectedHealth: 50 },
    { classname: 'monster_floater', expectedHealth: 200 },
    { classname: 'monster_hover', expectedHealth: 240 },
    { classname: 'monster_infantry', expectedHealth: 100 },
    { classname: 'monster_supertank', expectedHealth: 1500 },
    { classname: 'monster_boss2', expectedHealth: 3000 },
    { classname: 'monster_jorg', expectedHealth: 3000 },
    { classname: 'monster_makron', expectedHealth: 3000 },
  ];

  monsters.forEach(({ classname, expectedHealth }) => {
    it(`spawns ${classname} with correct health`, () => {
      // Note: spawnEntityFromDictionary handles entity creation internally using the entity pool.
      // We are verifying the result, not the creation process itself in this integration-like test.
      // However, we can assert that the result conforms to what we expect from our factories if we were to use them.

      const entity = spawnEntityFromDictionary(
        { classname, origin: '100 100 100', angle: '90' },
        { registry, entities }
      );

      expect(entity).not.toBeNull();
      expect(entity!.classname).toBe(classname);
      expect(entity!.health).toBe(expectedHealth);
      expect(entity!.max_health).toBe(expectedHealth);
      expect(entity!.takedamage).toBe(true);
      expect(entity!.movetype).toBeDefined();
      expect(entity!.solid).toBe(Solid.BoundingBox);

      // Should have a think function (for monster AI)
      expect(entity!.think).toBeDefined();
    });
  });
});
