import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic } from '../../../../src/entities/monsters/medic.js';
import { Entity, DeadFlag, Solid } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../../../src/imports.js';
import { createTestContext, createMonsterEntityFactory, createEntityFactory, TestContext } from '@quake2ts/test-utils';

describe('monster_medic', () => {
  let context: EntitySystem;
  let testCtx: TestContext;
  let medic: Entity;
  let deadMonster: Entity;
  let spawnFunction: any;

  beforeEach(() => {
    spawnFunction = vi.fn();
    testCtx = createTestContext();
    context = testCtx.entities;

    // Add specific mocks to the EntitySystem
    context.getSpawnFunction = vi.fn().mockReturnValue(spawnFunction);

    // Setup entities
    medic = context.spawn();
    Object.assign(medic, createMonsterEntityFactory('monster_medic', {
        origin: { x: 0, y: 0, z: 0 },
        health: 300,
        max_health: 300,
        viewheight: 32,
        spawnflags: 0,
        velocity: { x: 0, y: 0, z: 0 },
        enemy: null,
    }));

    deadMonster = context.spawn();
    Object.assign(deadMonster, createEntityFactory({
      origin: { x: 50, y: 0, z: 0 },
      classname: 'monster_infantry',
      deadflag: DeadFlag.Dead,
      health: 0,
      max_health: 100,
      solid: Solid.Not,
      monsterinfo: {
        stand: vi.fn(),
      } as any,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
    }));
  });

  it('should start cable attack sequence when close to dead monster', () => {
    SP_monster_medic(medic, testCtx);

    medic.enemy = deadMonster;

    // Trigger attack logic
    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic, context);
    }

    expect(medic.monsterinfo?.current_move?.firstframe).toBe(106);
  });

  it('should emit MEDIC_CABLE_ATTACK temp entity during cable attack frames', () => {
    SP_monster_medic(medic, testCtx);
    medic.enemy = deadMonster;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic, context);
    }
    const move = medic.monsterinfo?.current_move;
    expect(move).toBeDefined();

    // Frame 1 (index 1 in frames array) has medic_cable_attack
    const frame = move?.frames[1];
    expect(frame?.think).toBeDefined();

    frame?.think?.(medic, context);

    expect(context.multicast).toHaveBeenCalledWith(
        medic.origin,
        MulticastType.Pvs,
        ServerCommand.temp_entity,
        TempEntity.MEDIC_CABLE_ATTACK,
        medic.index,
        deadMonster.index,
        24, 0, 6, // Start coordinates
        50, 0, 0  // End coordinates
    );
  });

  it('should resurrect the monster using 9-frame cable animation', () => {
      SP_monster_medic(medic, testCtx);

      medic.enemy = deadMonster;
      if (medic.monsterinfo?.attack) {
          medic.monsterinfo.attack(medic, context);
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
    SP_monster_medic(medic, testCtx);
    medic.enemy = deadMonster;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic, context);
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
    SP_monster_medic(medic, testCtx);
    medic.enemy = deadMonster;

    deadMonster.origin.x = 1000;

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic, context);
    }
    const move = medic.monsterinfo?.current_move;
    const frame = move?.frames[1];

    frame?.think?.(medic, context);

    expect(context.multicast).not.toHaveBeenCalled();
    expect(medic.monsterinfo.current_move?.firstframe).toBe(70);
  });
});
