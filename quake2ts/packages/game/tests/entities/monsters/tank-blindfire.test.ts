import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank } from '../../../src/entities/monsters/tank.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { GameEngine } from '../../../src/engine.js';
import { GameImports } from '../../../src/game.js';
import { AIFlags, AttackState } from '../../../src/ai/constants.js';
import { MASK_SHOT, Vec3 } from '@quake2ts/shared';

const mockEngine = {
  sound: vi.fn(),
} as unknown as GameEngine;

const mockImports = {
  trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
  pointcontents: vi.fn().mockReturnValue(0),
  linkentity: vi.fn(),
} as unknown as GameImports;

describe('monster_tank blindfire', () => {
  let tank: Entity;
  let enemy: Entity;
  let mockSys: EntitySystem;
  let mockContext: SpawnContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSys = {
      engine: mockEngine,
      free: vi.fn(),
      spawn: vi.fn().mockImplementation(() => ({ origin: { x: 0, y: 0, z: 0 } } as Entity)),
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null, startsolid: false, allsolid: false }),
      timeSeconds: 100,
      linkentity: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
      scheduleThink: vi.fn(),
      finalizeSpawn: vi.fn(),
    } as unknown as EntitySystem;

    mockContext = {
      timeSeconds: 100,
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
      entities: mockSys,
    } as unknown as SpawnContext;

    tank = new Entity(1);
    tank.timestamp = 100;
    tank.origin = { x: 0, y: 0, z: 0 };
    SP_monster_tank(tank, mockContext);

    enemy = new Entity(2);
    enemy.origin = { x: 200, y: 0, z: 0 };
    enemy.health = 100;
    tank.enemy = enemy;
  });

  it('initializes with blindfire enabled', () => {
    expect(tank.monsterinfo.blindfire).toBe(true);
    expect(tank.monsterinfo.checkattack).toBeDefined();
  });

  it('tank_checkattack enters blind state when enemy hidden but blind target valid', () => {
    // 1. Setup hidden enemy (trace blocked)
    mockSys.trace = vi.fn((start, mins, maxs, end) => {
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
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    tank.monsterinfo.attack!(tank);

    expect(tank.monsterinfo.aiflags & AIFlags.ManualSteering).toBeTruthy();
    expect(tank.monsterinfo.blind_fire_delay).toBeGreaterThan(5.0); // Should be increased
  });

  it('M_AdjustBlindfireTarget is used in blaster fire', () => {
     // Since we can't easily spy on internal functions, we verify side effects or mock context.trace
     // tank_fire_blaster is internal to tank.ts but assigned to frames.
     // We can invoke it via frame logic if we set it up.

     // Set manual steering to trigger blindfire logic
     tank.monsterinfo.aiflags |= AIFlags.ManualSteering;
     tank.monsterinfo.blind_fire_target = { x: 200, y: 50, z: 0 };

     // We want to verify that context.trace is called with MASK_SHOT to verify target
     // M_AdjustBlindfireTarget calls context.trace(start, target, ...)

     const fireBlasterFrame = tank.monsterinfo.attack_blaster_frames?.[6]; // Frame with think (approx)
     // Wait, TS implementation of frames assigns think to range.
     // Let's find a frame with think.
     // attack_blaster_frames: frames 5-11 have think.
     // Let's use `tank_fire_blaster` directly if we can export it? No it's not exported.
     // But we can trigger it via run_frame if we set correct frame.

     // Actually, we can just check if trace was called with blind_fire_target.
     // The blaster fire calls M_AdjustBlindfireTarget which calls trace.

     // But we need to call the think function.
     // We can access it via current_move.frames[index].think

     // Setup move
     tank.monsterinfo.current_move = tank.monsterinfo.attack_blaster_move; // Wait, this property is internal/local var?
     // SP_monster_tank assigns it to `attack`. No, `attack` assigns it.

     // Trigger attack to set move
     tank.monsterinfo.attack_state = AttackState.Blind; // To force blaster/rocket
     vi.spyOn(Math, 'random').mockReturnValue(0.6); // > 0.5 -> blaster
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

    tank.monsterinfo.checkattack!(tank, mockSys);

    expect(tank.monsterinfo.blind_fire_target).toBeDefined();
    // Verify target prediction (enemy.origin + velocity * -0.1)
    // 200 + 100 * -0.1 = 190
    expect(tank.monsterinfo.blind_fire_target!.x).toBeCloseTo(190);
  });
});
