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
      }
    } as unknown as Entity;

    traceMock = vi.fn();
    pointContentsMock = vi.fn();

    context = {
      trace: traceMock,
      pointcontents: pointContentsMock,
    } as unknown as EntitySystem;
  });

  it('should return false if checkBottom fails (step off ledge)', () => {
    // 1. Move trace: succeeds
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } });

    // 2. M_CheckBottom traces: fail (no ground found)
    // It does two traces. Both return fraction 1.0 (no hit)
    traceMock.mockReturnValue({ fraction: 1.0 });
    pointContentsMock.mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);
    expect(result).toBe(false);
  });

  it('should return true and update origin if move is valid', () => {
    // 1. Move trace: succeeds
    traceMock.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 100 } });

    // 2. M_CheckBottom traces: succeed (hit ground)
    traceMock.mockReturnValue({ fraction: 0.5 });
    pointContentsMock.mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(true);
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should return false if move hits a wall (and stepping fails)', () => {
    // 1. Forward trace: Hit wall
    traceMock.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false });

    // 2. Step Up trace: Clear
    traceMock.mockReturnValueOnce({ fraction: 1.0, startsolid: false, allsolid: false });

    // 3. Step Forward (High) trace: Hit wall again (Too tall to step)
    traceMock.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false });

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(false);
  });
});
