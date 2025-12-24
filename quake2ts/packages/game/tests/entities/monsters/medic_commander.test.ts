import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic_commander } from '../../../src/entities/monsters/medic.js';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('monster_medic_commander reinforcement', () => {
  let context: any;
  let commander: Entity;
  let spawnFunction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const testContext = createTestContext();
    spawnFunction = vi.fn();

    // Customize context for this test
    context = testContext.entities;
    context.getSpawnFunction = vi.fn().mockReturnValue(spawnFunction);
    context.spawn = vi.fn().mockReturnValue({
          index: 100,
          origin: { x: 0, y: 0, z: 0 },
          angles: { x: 0, y: 0, z: 0 },
          avelocity: { x: 0, y: 0, z: 0 },
          mins: { x: -16, y: -16, z: -24 },
          maxs: { x: 16, y: 16, z: 32 },
          monsterinfo: {},
          classname: 'monster_soldier',
    });

    // Provide keyValues via separate object mimicking SpawnContext
    context.keyValues = {};

    commander = {
      index: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -24, y: -24, z: -24 },
      maxs: { x: 24, y: 24, z: 32 },
      viewheight: 32,
      classname: 'monster_medic_commander',
      health: 600,
      max_health: 600,
      monsterinfo: {
        current_move: null,
      },
      enemy: null,
      skin: 0,
    } as any;
  });

  it('should have reinforcement parameters', () => {
      const spawnContext = {
          entities: context,
          health_multiplier: 1,
          keyValues: {
              reinforcements: 'monster_gunner 4',
              monster_slots: '5'
          }
      } as any;
      SP_monster_medic_commander(commander, spawnContext);

      // Verify defaults
      expect(commander.health).toBe(600);
      expect(commander.skin).toBe(1);

      expect(commander.monsterinfo.monster_slots).toBe(5);
      expect(commander.monsterinfo.reinforcements).toBeDefined();
      expect(commander.monsterinfo.reinforcements?.length).toBe(1);
      expect(commander.monsterinfo.reinforcements?.[0].classname).toBe('monster_gunner');
  });

  it('should spawn reinforcements using medic_call_reinforcements', () => {
    // We need to parse valid reinforcements first
    const spawnContext = {
        entities: context,
        health_multiplier: 1,
        keyValues: {
            reinforcements: 'monster_soldier 1', // Simple soldier
            monster_slots: '5'
        }
    } as any;
    SP_monster_medic_commander(commander, spawnContext);

    // Set enemy
    commander.enemy = {
        index: 2,
        health: 100,
        origin: { x: 100, y: 0, z: 0 }
    } as any;

    // Trigger attack - which has chance to spawn
    // Force spawn trigger: medic_attack random check (< 0.2)
    vi.spyOn(context.rng, 'frandom').mockReturnValue(0.1);

    // medic_pick_reinforcements log2 logic relies on Math.random/rng
    // We can let mockReturnValue stay 0.1, which should pick index 0 if array length > 0

    // We need to call medic_attack
    // medic_attack requires context
    if (commander.monsterinfo?.attack) {
        commander.monsterinfo.attack(commander, context);
    }

    // Verify state transition to spawn_move
    expect(commander.monsterinfo.current_move?.firstframe).toBe(122); // spawn_move start

    // determine_spawn is at frame 15 (index 15)
    // spawngrows is at frame 16 (index 16)
    // finish_spawn is at frame 19 (index 19)

    const move = commander.monsterinfo.current_move;

    // Call determine_spawn
    const determineFrame = move?.frames[15];
    expect(determineFrame?.think).toBeDefined();
    determineFrame?.think?.(commander, context);

    // Check if chosen_reinforcements is set
    expect(commander.monsterinfo.chosen_reinforcements).toBeDefined();

    // Call finish_spawn
    const finishFrame = move?.frames[19];
    expect(finishFrame?.think).toBeDefined();

    finishFrame?.think?.(commander, context);

    // Verify spawn
    expect(context.spawn).toHaveBeenCalled();
    // It should spawn monster_soldier
    // and setting up spawnContext
    expect(context.getSpawnFunction).toHaveBeenCalledWith('monster_soldier');
    expect(spawnFunction).toHaveBeenCalled();
  });
});
