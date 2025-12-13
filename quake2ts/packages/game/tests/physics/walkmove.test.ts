import { describe, it, expect, vi, beforeEach } from 'vitest';
import { M_walkmove } from '../../src/ai/movement.js';
import type { Entity } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';
import { AIFlags } from '../../src/ai/constants.js';

describe('M_walkmove', () => {
  let entity: Entity;
  let context: EntitySystem;
  let traceMock: any;
  let pointContentsMock: any;

  beforeEach(() => {
    entity = {
      origin: { x: 0, y: 0, z: 100 },
      old_origin: { x: 0, y: 0, z: 100 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: { index: 1 } as Entity,
      waterlevel: 0,
      monsterinfo: {
          aiflags: 0
      },
      gravityVector: { x: 0, y: 0, z: -1 },
    } as unknown as Entity;

    traceMock = vi.fn();
    pointContentsMock = vi.fn();

    context = {
      trace: traceMock,
      pointcontents: pointContentsMock,
      timeSeconds: 0,
      linkentity: vi.fn(),
    } as unknown as EntitySystem;
  });

  it('should return false if checkBottom fails (step off ledge)', () => {
    // 1. Trace up (step prep): Succeeds (no wall above head)
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 118.75 } });

    // 2. Trace up-forward (step move): Succeeds
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 118.75 } });

    // 3. Trace forward (direct): Succeeds
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } });

    // 4. Trace down (step down): Succeeds (hits ground at target z)
    traceMock.mockReturnValueOnce({ fraction: 0.5, endpos: { x: 10, y: 0, z: 100 }, ent: { solid: 1 } });

    // 5. M_CheckBottom traces: fail (no ground found under corners)
    // It does a check for "all solid" first (fail), then traces down for corners
    pointContentsMock.mockReturnValue(0); // corner checks return empty

    // Slow check trace in M_CheckBottom
    traceMock.mockReturnValue({ fraction: 1.0, endpos: { x: 10, y: 0, z: -100 } }); // Traces into void

    const result = M_walkmove(entity, 0, 10, context);
    expect(result).toBe(false);
  });

  it('should return true and update origin if move is valid', () => {
    // 1. Trace up (step prep)
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 118.75 } });

    // 2. Trace up-forward
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 118.75 } });

    // 3. Trace forward (direct)
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } });

    // 4. Trace down (step down)
    traceMock.mockReturnValueOnce({ fraction: 0.5, endpos: { x: 10, y: 0, z: 100 }, ent: { solid: 1 } });

    // 5. M_CheckBottom traces: succeed (hit ground)
    pointContentsMock.mockReturnValue(0); // Not all solid

    // Slow check trace in M_CheckBottom - hit ground
    traceMock.mockReturnValue({ fraction: 0.5, endpos: { x: 10, y: 0, z: 100 }, ent: { solid: 1 } });

    // Restore trace for CheckGround at end of move
    // traceMock.mockReturnValue({ fraction: 0.5, endpos: { x: 10, y: 0, z: 100 }, ent: { solid: 1 } });

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(true);
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should return false if move hits a wall (and stepping fails)', () => {
    // 1. Trace up (step prep)
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 118.75 } });

    // 2. Trace up-forward: Hit wall
    traceMock.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 5, y: 0, z: 118.75 } });

    // 3. Trace forward (direct): Hit wall
    traceMock.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 5, y: 0, z: 100 } });

    // 4. Trace down (step down) from the BLOCKED position (x=5)
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 5, y: 0, z: 81.25 }, ent: null });

    // M_CheckBottom will likely fail or pass depending on mocking, but the key is we barely moved (5 vs 10)
    // If we return false because "barely moved" (fraction 0.5 < 1.0) and "stuck" logic triggers or returns false.

    // Let's ensure M_CheckBottom passes so we reach the "barely moved" check
    pointContentsMock.mockReturnValue(0);
    traceMock.mockReturnValue({ fraction: 0.5, endpos: { x: 5, y: 0, z: 100 }, ent: { solid: 1 } });

    const result = M_walkmove(entity, 0, 10, context);

    // It should return false because we hit a wall (traces returned 0.5 fraction)
    // and the "stuck" logic (slide) might kick in but returns false unless we rotate?
    // In M_walkmove wrapper, it just returns the result.
    // SV_movestep returns false if barely moved and stuck logic doesn't succeed in rotating.
    // Here we didn't mock angleVectors so slide logic might fail or not run if we don't set bump_time.

    expect(result).toBe(false);
  });
});
