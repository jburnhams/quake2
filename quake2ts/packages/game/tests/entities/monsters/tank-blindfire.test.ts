import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank } from '../../../src/entities/monsters/tank.js';
import { Entity } from '../../../src/entities/entity.js';
import { AIFlags, AttackState } from '../../../src/ai/constants.js';
import { MASK_SHOT } from '@quake2ts/shared';
import { createTestContext, createEntityFactory } from '@quake2ts/test-utils';

describe('monster_tank blindfire', () => {
  let tank: Entity;
  let enemy: Entity;
  let mockSys: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createTestContext();
    mockSys = mockContext.entities;

    // Customize mocks
    mockSys.spawn.mockImplementation(() => createEntityFactory({ origin: { x: 0, y: 0, z: 0 } }));
    mockSys.trace.mockReturnValue({ fraction: 1.0, ent: null, startsolid: false, allsolid: false });
    mockSys.timeSeconds = 100;

    tank = mockSys.spawn();
    Object.assign(tank, { index: 1, timestamp: 100 });
    SP_monster_tank(tank, mockContext);

    enemy = mockSys.spawn();
    Object.assign(enemy, { index: 2, origin: { x: 200, y: 0, z: 0 }, health: 100 });
    tank.enemy = enemy;
  });

  it('initializes with blindfire enabled', () => {
    expect(tank.monsterinfo.blindfire).toBe(true);
    expect(tank.monsterinfo.checkattack).toBeDefined();
  });

  it('tank_checkattack enters blind state when enemy hidden but blind target valid', () => {
    // 1. Setup hidden enemy (trace blocked)
    mockSys.trace = vi.fn((start: any, mins: any, maxs: any, end: any) => {
        // Trace to enemy is blocked
        if (end.x === enemy.origin.x && end.y === enemy.origin.y) {
            return { fraction: 0.5, ent: null, startsolid: false, allsolid: false }; // Hit wall
        }
        // Trace to blind target is clear
        return { fraction: 1.0, ent: null, startsolid: false, allsolid: false };
    });

    tank.monsterinfo.blind_fire_target = { x: 200, y: 50, z: 0 }; // Offset
    tank.monsterinfo.trail_time = 90; // Recently seen
    tank.monsterinfo.blind_fire_delay = 5.0; // Ready to fire
    tank.attack_finished_time = 0;

    const result = tank.monsterinfo.checkattack!(tank, mockSys);

    expect(result).toBe(true);
    expect(tank.monsterinfo.attack_state).toBe(AttackState.Blind);
  });

  it('tank_attack sets ManualSteering when in blind state', () => {
    tank.monsterinfo.attack_state = AttackState.Blind;
    tank.monsterinfo.blind_fire_delay = 0.5; // High chance
    tank.monsterinfo.blind_fire_target = { x: 200, y: 50, z: 0 };

    // Mock random to ensure fire
    vi.spyOn(mockSys.rng, 'frandom').mockReturnValue(0.01);

    tank.monsterinfo.attack!(tank);

    // ManualSteering is 1 << 11 (2048)
    expect(tank.monsterinfo.aiflags & AIFlags.ManualSteering).toBeTruthy();
    expect(tank.monsterinfo.blind_fire_delay).toBeGreaterThan(5.0); // Should be increased
  });

  it('M_AdjustBlindfireTarget is used in blaster fire', () => {
     // Since we can't easily spy on internal functions, we verify side effects or mock context.trace
     // tank_fire_blaster is internal to tank.ts but assigned to frames.
     // We can invoke it via frame logic if we set it up.

     // Set manual steering to trigger blindfire logic
     tank.monsterinfo.aiflags |= AIFlags.ManualSteering; // ManualSteering
     tank.monsterinfo.blind_fire_target = { x: 200, y: 50, z: 0 };

     // We want to verify that context.trace is called with MASK_SHOT to verify target
     // M_AdjustBlindfireTarget calls context.trace(start, target, ...)

     // Setup move
     // Trigger attack to set move
     tank.monsterinfo.attack_state = AttackState.Blind; // To force blaster/rocket

     // Mock random:
     // frandom < 0.5 -> rocket
     // frandom >= 0.5 -> blaster
     vi.spyOn(mockSys.rng, 'frandom').mockReturnValue(0.6); // > 0.5 -> blaster

     tank.monsterinfo.attack!(tank);

     const move = tank.monsterinfo.current_move!;
     expect(move).toBeDefined();
     // Check if it is blaster move (frames length 16)
     expect(move.frames.length).toBe(16);

     // Get a frame that fires
     const fireFrame = move.frames[6]; // Index 6 is think=tank_fire_blaster (indices 6-11)
     expect(fireFrame.think).toBeDefined();

     // Call it
     mockSys.trace = vi.fn().mockReturnValue({ fraction: 1.0, ent: null, startsolid: false, allsolid: false });
     fireFrame.think!(tank, mockSys);

     // Expect trace to be called with blind_fire_target
     // M_AdjustBlindfireTarget calls trace(start, target, ...)
     // Start is roughly tank origin. Target is blind_fire_target.
     expect(mockSys.trace).toHaveBeenCalledWith(
         expect.objectContaining({ x: 0, y: 0, z: 64 }), // Start
         expect.objectContaining({ x: 200, y: 50, z: 0 }), // End (blind target)
         expect.anything(),
         expect.anything(),
         expect.anything(),
         MASK_SHOT
     );
  });

  it('tank_checkattack updates blind_fire_target when enemy is visible', () => {
    // Setup visible enemy
    mockSys.trace = vi.fn().mockReturnValue({ fraction: 1.0, ent: enemy, startsolid: false, allsolid: false });
    tank.enemy!.velocity = { x: 100, y: 0, z: 0 };
    tank.monsterinfo.blind_fire_target = undefined;

    // Mock random: chance for normal attack (missile)
    // We want to verify visibility update part, not enter attack state necessarily,
    // but checkattack does both.
    // If enemy is visible, it updates blind_fire_target.

    // frandom < chance (chance is 0.4 for melee/near, etc)
    vi.spyOn(mockSys.rng, 'frandom').mockReturnValue(0.9); // Don't trigger missile attack immediately

    tank.monsterinfo.checkattack!(tank, mockSys);

    expect(tank.monsterinfo.blind_fire_target).toBeDefined();
    // Verify target prediction (enemy.origin + velocity * -0.1)
    // 200 + 100 * -0.1 = 190
    expect(tank.monsterinfo.blind_fire_target!.x).toBeCloseTo(190);
  });
});
