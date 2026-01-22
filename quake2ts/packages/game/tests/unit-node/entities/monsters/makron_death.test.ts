import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_makron } from '../../../../src/entities/monsters/makron.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('monster_makron death', () => {
  let context: any;
  let makron: Entity;

  beforeEach(() => {
    context = createTestContext();
    makron = context.entities.spawn();
    makron.origin = { x: 100, y: 100, z: 0 };
    makron.angles = { x: 0, y: 90, z: 0 };
    SP_monster_makron(makron, context);
  });

  it('spawns torso on death', () => {
    // Capture spawned entities
    const spawnedEntities: Entity[] = [];
    const originalSpawn = context.entities.spawn;
    context.entities.spawn = () => {
        const e = originalSpawn();
        spawnedEntities.push(e);
        return e;
    };

    // Trigger death
    makron.die!(makron, null, null, 1000, { x: 0, y: 0, z: 0 }, 0);

    expect(makron.deadflag).toBe(DeadFlag.Dead);

    // Check if torso was spawned
    // We expect at least one new entity which is the torso
    // It might be difficult to identify if classname isn't set, but we can check model/properties
    const torso = spawnedEntities.find(e => e.model === 'models/monsters/boss3/rider/tris.md2' && e !== makron);

    expect(torso).toBeDefined();
    if (torso) {
        expect(torso.movetype).toBe(MoveType.Toss);
        expect(torso.think).toBeDefined(); // makron_torso_think
        // frame 346 check?
        expect(torso.frame).toBe(346);
    }
  });
});
