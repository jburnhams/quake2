import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { huntTarget, TargetAwarenessState } from '../../src/ai/targeting.js';
import { createMonsterEntityFactory, createPlayerEntityFactory, createTestContext, spawnEntity } from '@quake2ts/test-utils';

describe('AI Tracking (Lost Sight)', () => {
  let system: EntitySystem;
  let monster: Entity;
  let player: Entity;
  let awareness: any; // TargetAwarenessState

  beforeEach(() => {
    const testContext = createTestContext();
    system = testContext.entities;

    awareness = {
        timeSeconds: 0,
        frameNumber: 0,
        sightEntity: null,
        sightEntityFrame: 0,
        soundEntity: null,
        soundEntityFrame: 0,
        sound2Entity: null,
        sound2EntityFrame: 0,
        sightClient: null,
        activePlayers: [],
        monsterAlertedByPlayers: vi.fn(),
        soundClient: vi.fn(),
    };

    // Override the getter or property if not present or just set it
    if (system.targetAwareness) {
        Object.assign(system.targetAwareness, awareness);
    } else {
        // Since we are mocking, we can just attach it.
        (system as any).targetAwareness = awareness;
    }

    monster = spawnEntity(system, createMonsterEntityFactory('monster_test', {
        origin: { x: 0, y: 0, z: 0 },
        angles: { x: 0, y: 0, z: 0 },
        ideal_yaw: 0,
        monsterinfo: {
            stand: vi.fn(),
            run: vi.fn(),
            sight: vi.fn(),
            aiflags: 0,
            last_sighting: { x: 100, y: 0, z: 0 }, // Last seen location
            search_time: 0
        } as any
    }));

    player = spawnEntity(system, createPlayerEntityFactory({
        origin: { x: 200, y: 0, z: 0 } // Current location
    }));

    monster.enemy = player;
  });

  it('monster moves towards enemy current position if enemy is set', () => {
    huntTarget(monster, awareness, system);

    // It sets goalentity to enemy
    expect(monster.goalentity).toBe(player);
    expect(monster.ideal_yaw).toBe(0); // Face player at 200,0,0
  });
});
