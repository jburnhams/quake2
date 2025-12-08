import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic } from '../../../src/entities/monsters/medic.js';
import { Entity, DeadFlag, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';

describe('monster_medic', () => {
  let context: any;
  let medic: Entity;
  let deadMonster: Entity;
  let spawnFunction: any;

  beforeEach(() => {
    spawnFunction = vi.fn();
    context = {
      engine: {
        sound: vi.fn(),
      },
      timeSeconds: 10,
      trace: vi.fn().mockReturnValue({
        fraction: 1,
        ent: null
      }),
      multicast: vi.fn(),
      linkentity: vi.fn(),
      finalizeSpawn: vi.fn(),
      free: vi.fn(),
      getSpawnFunction: vi.fn().mockReturnValue(spawnFunction),
      forEachEntity: vi.fn(),
    };

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

    // Check if run/stand calls find_dead logic?
    // We want to test the attack_cable_move sequence triggers.

    // But direct testing of state transitions is hard without simulating full frames.
    // Let's test the functions directly if exported or accessible via frames.

    // Access frames via monsterinfo.attack
    // medic.monsterinfo.attack(medic);
    // If enemy is dead, it should switch to cable move.

    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }

    // Verify current_move is correct (we can't easily check the exact object identity without export, but we can check properties)
    expect(medic.monsterinfo?.current_move?.firstframe).toBe(106); // attack_cable_move firstframe
  });

  it('should emit MEDIC_CABLE_ATTACK temp entity during cable attack frames', () => {
    // Setup medic
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    // Find the think function for cable attack (it is medic_cable_attack)
    // We know it is in the frames of attack_cable_move.
    // Let's force the move.
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

    expect(context.multicast).toHaveBeenCalledWith(
        medic.origin,
        MulticastType.Pvs,
        ServerCommand.temp_entity,
        expect.objectContaining({
            te: TempEntity.MEDIC_CABLE_ATTACK,
            entId: medic.index,
            targetId: deadMonster.index
        })
    );
  });

  it('should respawn the monster at the end of the sequence', () => {
    // Setup medic
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    // Force move
    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }
    const move = medic.monsterinfo?.current_move;

    // Last frame has medic_hook_retract
    const lastFrameIndex = move?.frames.length ? move.frames.length - 1 : 0;
    const frame = move?.frames[lastFrameIndex];

    // Call think
    frame?.think?.(medic, context);

    // Verify spawn function called
    expect(context.getSpawnFunction).toHaveBeenCalledWith('monster_infantry');
    expect(spawnFunction).toHaveBeenCalled();
    expect(context.finalizeSpawn).toHaveBeenCalledWith(deadMonster);
    expect(deadMonster.deadflag).toBe(DeadFlag.Alive);
    expect(medic.enemy).toBeNull();
  });

  it('should stop healing if distance is too great', () => {
    // Setup medic
    const spawnContext = { entities: context } as any;
    SP_monster_medic(medic, spawnContext);
    medic.enemy = deadMonster;

    // Move dead monster far away
    deadMonster.origin.x = 1000;

    // Get frame
    if (medic.monsterinfo?.attack) {
        medic.monsterinfo.attack(medic);
    }
    const move = medic.monsterinfo?.current_move;
    const frame = move?.frames[1]; // medic_cable_attack

    // Call think
    frame?.think?.(medic, context);

    // Should NOT multicast
    expect(context.multicast).not.toHaveBeenCalled();
    // Should switch to run
    expect(medic.monsterinfo.current_move?.firstframe).toBe(70); // run_move
  });

  it('should not target bad_medic marked entities', () => {
      // Setup medic
      const spawnContext = { entities: context } as any;
      SP_monster_medic(medic, spawnContext);

      // Mark as bad
      (deadMonster as any).bad_medic = medic;

      // Simulate iteration
      // We need to mock forEachEntity to call with deadMonster
      context.forEachEntity.mockImplementation((cb: any) => cb(deadMonster));

      // Trigger run which calls medic_find_dead
      medic.monsterinfo.run!(medic, 12, context);

      // Should not set enemy
      expect(medic.enemy).toBeNull();
  });
});
