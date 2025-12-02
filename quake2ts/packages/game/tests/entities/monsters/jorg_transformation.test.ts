import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_jorg } from '../../../src/entities/monsters/jorg.js';
import { SP_monster_makron } from '../../../src/entities/monsters/makron.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../src/entities/entity.js';
import { createSpawnContext, createEntity } from '../../test-helpers.js';

// Mock makron import if needed, but we want to test integration
// We need to access the private/internal 'makron_toss' or simulate the death frame sequence
// Since makron_toss is not exported, we can check if it's assigned to the death move's think function.

describe('monster_jorg transformation', () => {
  let context: any;
  let jorg: Entity;
  let player: Entity;

  beforeEach(() => {
    context = createSpawnContext();
    jorg = context.entities.spawn();
    jorg.origin = { x: 100, y: 100, z: 0 };
    jorg.angles = { x: 0, y: 90, z: 0 };

    player = createEntity();
    player.origin = { x: 200, y: 200, z: 0 };
    player.health = 100; // Player must be alive
    jorg.enemy = player;

    SP_monster_jorg(jorg, context);
  });

  it('spawns makron on death sequence end', () => {
    // Trigger death
    jorg.die!(jorg, null, null, 1000, { x: 0, y: 0, z: 0 }, 0);

    expect(jorg.deadflag).toBe(DeadFlag.Dead);
    const deathMove = jorg.monsterinfo.current_move;
    expect(deathMove).toBeDefined();

    // Find the frame that triggers makron_toss. In jorg.ts it's frame 48 (index 48 relative to firstframe?)
    // death_move start: 127. 48th frame is 127+48 = 175.
    // The frame definition in jorg.ts:
    // const death_frames = ...
    // think: ((i === 48) ? makron_toss : null)

    const tossFrameIndex = 48;
    const tossFrame = deathMove!.frames[tossFrameIndex];
    expect(tossFrame.think).toBeDefined();

    // Execute the toss logic
    // We need to spy on spawn to capture the new entity
    const spawnedEntities: Entity[] = [];
    const originalSpawn = context.entities.spawn;
    context.entities.spawn = () => {
        const e = originalSpawn();
        spawnedEntities.push(e);
        return e;
    };

    // Call the think function (makron_toss)
    tossFrame.think!(jorg, context.entities);

    expect(spawnedEntities.length).toBeGreaterThan(0);
    const makron = spawnedEntities[0];

    // Verify Makron properties
    expect(makron.classname).toBe('monster_makron');
    expect(makron.origin).toEqual(jorg.origin);

    // Verify it was initialized (health should be set by SP_monster_makron)
    // SP_monster_makron sets health to 3000
    expect(makron.health).toBe(3000);

    // Verify jump logic (velocity toward player)
    // This requires makron_toss to implement the jump logic which is currently missing/incomplete in jorg.ts
    // Current jorg.ts just sets origin/angles.
    // We expect velocity to be non-zero if it jumps.

    // With current implementation, this expectation might fail if velocity is 0
    // or if SP_monster_makron wasn't called (health would be 0).
    expect(makron.velocity.z).toBeGreaterThan(0);
    expect(makron.enemy).toBe(player);
  });
});
