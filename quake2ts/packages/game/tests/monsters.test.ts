import { describe, it, expect, vi } from 'vitest';
import { registerMonsterStubs } from '../src/entities/monsters/stubs.js';
import { SpawnRegistry } from '../src/entities/spawn.js';
import { Entity } from '../src/entities/entity.js';

describe('Monster Stubs', () => {
    it('should register stubs for all monsters', () => {
        const registry = new SpawnRegistry();
        registerMonsterStubs(registry);

        const stubs = [
          'monster_gunner',
          'monster_infantry',
          'monster_berserker',
          'monster_gladiator',
          'monster_medic',
          'monster_mutant',
          'monster_parasite',
          'monster_flyer',
          'monster_brain',
          'monster_floater',
          'monster_hover',
          'monster_tank',
          'monster_tank_commander',
          'monster_super_tank',
          'monster_boss2',
          'monster_boss3_stand',
          'monster_jorg',
          'monster_makron',
          'monster_chick',
          'monster_flipper',
          'monster_insane',
        ];

        stubs.forEach(monster => {
            const spawnFunc = registry.get(monster);
            expect(spawnFunc).toBeDefined();

            const entity = new Entity(1);
            entity.classname = monster;
            spawnFunc!(entity, {} as any);
            expect(entity.health).toBe(100); // Stub default
        });
    });
});
