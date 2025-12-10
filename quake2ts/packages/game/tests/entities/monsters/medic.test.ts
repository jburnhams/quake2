import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic } from '../../../src/entities/monsters/medic.js';
import { Entity, DeadFlag, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';
import { createTestContext } from '../../test-helpers.js';

describe('monster_medic', () => {
  let context: any;
  let medic: Entity;
  let deadMonster: Entity;
  let spawnFunction: any;

  beforeEach(() => {
    spawnFunction = vi.fn();
    const testCtx = createTestContext();
    // createTestContext returns a SpawnContext { entities, keyValues, etc }
    // We want the EntitySystem mock which is testCtx.entities
    context = testCtx.entities;

    // Add specific mocks to the EntitySystem
    context.getSpawnFunction = vi.fn().mockReturnValue(spawnFunction);

    // Setup entities
    medic = {
      index: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -24, y: -24, z: -24 },
      maxs: { x: 24, y: 24, z: 32 },
      viewheight: 32,
      classname: 'monster_medic',
      health: 300,
      max_health: 300,
      monsterinfo: {
        current_move: null,
      },
      enemy: null,
    } as any;

    deadMonster = {
      index: 2,
      origin: { x: 50, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      classname: 'monster_infantry',
      deadflag: DeadFlag.Dead,
      health: 0,
      max_health: 100,
      solid: Solid.Not,
      monsterinfo: {
        stand: vi.fn(),
      },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
    } as any;
  });

  it('should start cable attack sequence when close to dead monster', () => {
    // Setup medic with SP_monster_medic to get methods
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);

    // Assign enemy
    medic.enemy = deadMonster;

    // Trigger attack logic
    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }

    // Verify current_move is correct
    // attack_cable_move firstframe is 106
    expect(medic.monsterinfo?.current_move?.firstframe).toBe(106);
  });

  it('should emit MEDIC_CABLE_ATTACK temp entity during cable attack frames', () => {
    // Setup medic
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }
    const move = medic.monsterinfo?.current_move;
    expect(move).toBeDefined();

    // Frame 1 (index 1 in frames array) has medic_cable_attack
    const frame = move?.frames[1];
    expect(frame?.think).toBeDefined();

    // Call the think function
    frame?.think?.(medic, context);

    // The medic_cable_attack function calls multicast.
    expect(context.multicast).toHaveBeenCalledWith(
        medic.origin,
        MulticastType.Pvs,
        ServerCommand.temp_entity,
        TempEntity.MEDIC_CABLE_ATTACK,
        medic.index,
        deadMonster.index,
        24, 0, 6, // Start coordinates (calculated from offset and 0 angles)
        50, 0, 0  // End coordinates
    );
  });

  it('should resurrect the monster using 9-frame cable animation', () => {
      const spawnContext = { entities: context } as any;
      SP_monster_medic(medic, spawnContext);

      medic.enemy = deadMonster;
      if (medic.monsterinfo?.attack) {
          medic.monsterinfo.attack(medic);
      }

      const move = medic.monsterinfo?.current_move;
      // attack_cable_move frames: 106 to 114 inclusive.
      expect(move?.frames.length).toBe(9);

      const lastFrame = move?.frames[move.frames.length - 1];
      expect(lastFrame?.think?.name).toBe('medic_hook_retract');

      // Execute the resurrection
      lastFrame?.think?.(medic, context);

      // Verify resurrection happened
      expect(context.getSpawnFunction).toHaveBeenCalledWith('monster_infantry');
      expect(spawnFunction).toHaveBeenCalled();
      expect(context.finalizeSpawn).toHaveBeenCalledWith(deadMonster);
      expect(deadMonster.deadflag).toBe(DeadFlag.Alive);
  });

  it('should respawn the monster at the end of the sequence', () => {
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }
    const move = medic.monsterinfo?.current_move;

    const lastFrameIndex = move?.frames.length ? move.frames.length - 1 : 0;
    const frame = move?.frames[lastFrameIndex];

    frame?.think?.(medic, context);

    expect(context.getSpawnFunction).toHaveBeenCalledWith('monster_infantry');
    expect(spawnFunction).toHaveBeenCalled();
    expect(context.finalizeSpawn).toHaveBeenCalledWith(deadMonster);
    expect(deadMonster.deadflag).toBe(DeadFlag.Alive);
    expect(medic.enemy).toBeNull();
  });

  it('should stop healing if distance is too great', () => {
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    deadMonster.origin.x = 1000;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }
    const move = medic.monsterinfo?.current_move;
    const frame = move?.frames[1];

    frame?.think?.(medic, context);

    expect(context.multicast).not.toHaveBeenCalled();
    expect(medic.monsterinfo.current_move?.firstframe).toBe(70);
  });
});
