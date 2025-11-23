import { describe, it, expect, vi, beforeEach } from 'vitest';
import { M_walkmove } from '../src/ai/movement.js';
import type { Entity } from '../src/entities/entity.js';
import type { EntitySystem } from '../src/entities/system.js';
import { MoveType, Solid, EntityFlags } from '../src/entities/entity.js';
import { AIFlags } from '../src/ai/constants.js';

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
    // Mock trace to not hit anything when checking bottom
    traceMock.mockReturnValue({ fraction: 1.0 });
    // And point contents empty
    pointContentsMock.mockReturnValue(0);

    // We need to make sure the initial move trace is successful so we get to checkBottom
    traceMock.mockImplementationOnce(() => ({
        fraction: 1.0,
        allsolid: false,
        startsolid: false
    }));

    // But checkBottom traces fail (this is tricky to mock with single mock function)
    // Actually M_CheckBottom calls trace multiple times.
    // Let's assume M_walkmove calls CheckBottom.

    // Simplest way: Make M_CheckBottom logic fail inside M_walkmove flow

    // First trace: move itself. Succeeds.
    traceMock.mockReturnValueOnce({ fraction: 1.0 });

    // Subsequent traces: check bottom. Fail (return fraction 1.0 meaning no hit = void)
    traceMock.mockReturnValue({ fraction: 1.0 });
    pointContentsMock.mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);
    expect(result).toBe(false);
  });

  it('should return true and update origin if move is valid', () => {
     // First trace: move itself. Succeeds.
    traceMock.mockReturnValueOnce({ fraction: 1.0 });

    // Subsequent traces: check bottom. Succeed (return fraction < 1.0 meaning hit ground)
    traceMock.mockReturnValue({ fraction: 0.5 });
    pointContentsMock.mockReturnValue(0);

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(true);
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should return false if move hits a wall', () => {
       // First trace: move itself. Fails (fraction < 1.0).
    traceMock.mockReturnValueOnce({ fraction: 0.5 });

    const result = M_walkmove(entity, 0, 10, context);

    expect(result).toBe(false);
  });
});
