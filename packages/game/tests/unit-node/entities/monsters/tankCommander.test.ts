import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank_commander } from '../../../../src/entities/monsters/tankCommander.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('monster_tank_commander', () => {
  let system: EntitySystem;
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    system = context.entities;
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_tank_commander(ent, context);

    expect(ent.classname).toBe('monster_tank_commander');
    expect(ent.health).toBe(1000); // Commander is tougher
    expect(ent.skin).toBe(2);
    expect(ent.monsterinfo.stand).toBeDefined(); // Inherits AI
  });
});
