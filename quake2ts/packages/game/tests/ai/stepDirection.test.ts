import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SV_StepDirection } from '../../src/ai/movement.js';
import type { Entity } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { MoveType } from '../../src/entities/entity.js';
import { createMonsterEntityFactory, createEntity } from '@quake2ts/test-utils';

describe('SV_StepDirection', () => {
  let entity: Entity;
  let context: EntitySystem;
  let traceMock: any;
  let pointContentsMock: any;

  beforeEach(() => {
    // We can't easily use createTestContext().entities because SV_StepDirection takes an entity and context directly,
    // and we want to mock trace on the context heavily.
    // Although createTestContext returns a context with mocked trace, we might want manual control.
    // Let's stick to a simple object for entity but use the factory data.

    const entData = createMonsterEntityFactory('monster_test', {
      origin: { x: 0, y: 0, z: 100 },
      old_origin: { x: 0, y: 0, z: 100 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: createEntity({ index: 1 }),
      waterlevel: 0,
      monsterinfo: {
          aiflags: 0
      } as any,
      angles: { x: 0, y: 0, z: 0 }
    });

    // Create a real entity and assign data, so prototype methods (if any) are present, though logic mainly uses properties.
    entity = createEntity(entData);

    traceMock = vi.fn();
    pointContentsMock = vi.fn();

    context = {
      trace: traceMock,
      pointcontents: pointContentsMock,
    } as unknown as EntitySystem;
  });

  it('should return true if straight forward move succeeds', () => {
    // Mock trace success for straight move
    traceMock.mockReturnValue({ fraction: 1.0 });
    pointContentsMock.mockReturnValue(0);

    // M_walkmove checkBottom also needs to pass
    // First trace in walkMove (move) -> success
    // Second/Third trace in checkBottom -> success (fraction < 1.0 means ground hit)
    traceMock.mockImplementation((start: any, mins: any, maxs: any, end: any) => {
        // If checking bottom (downwards trace)
        if (end.z < start.z - 10) return { fraction: 0.5, endpos: end, allsolid: false, startsolid: false };
        // If moving (horizontal)
        return { fraction: 1.0, endpos: end, allsolid: false, startsolid: false };
    });

    const result = SV_StepDirection(entity, 0, 10, context);
    expect(result).toBe(true);
  });

  it('should try alternate angles if straight move fails', () => {
     // Mock trace failure for straight move
    traceMock.mockImplementation((start: any, mins: any, maxs: any, end: any) => {
        const result = { fraction: 1.0, endpos: end, allsolid: false, startsolid: false };
        // Checking bottom always succeeds
        if (end.z < start.z - 10) {
            result.fraction = 0.5;
            return result;
        }

        // Horizontal move
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // 0 degrees is blocked (positive x)
        if (dx > 0 && Math.abs(dy) < 0.1) {
             result.fraction = 0.5;
             result.endpos = start; // Blocked at start
             return result;
        }

        // 45 degrees is clear
        return result;
    });

    pointContentsMock.mockReturnValue(0);

    // 0 is straight forward
    const result = SV_StepDirection(entity, 0, 10, context);
    expect(result).toBe(true);

    // Ideally it changed the angle
    // Wait, M_walkmove updates origin, but SV_StepDirection doesn't change angle.
    // The original SV_StepDirection only returns true if a move was successful.
    // The caller is responsible for updating ideal_yaw or similar if they want to persist the turn,
    // but M_walkmove moves the entity.
    // Ah, wait. M_walkmove doesn't change entity angles. It just moves the entity.
    // So checking entity.angles.y is wrong unless M_walkmove changed it (it doesn't).

    // So we just expect true.
    expect(result).toBe(true);

    // And origin changed
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should return false if all directions are blocked', () => {
    // All blocked
     traceMock.mockImplementation((start: any, mins: any, maxs: any, end: any) => {
        // Checking bottom always succeeds
        if (end.z < start.z - 10) return { fraction: 0.5, endpos: end, allsolid: false, startsolid: false };
        // Move always fails
        return { fraction: 0.5, endpos: start, allsolid: false, startsolid: false };
    });
    pointContentsMock.mockReturnValue(0);

    const result = SV_StepDirection(entity, 0, 10, context);
    expect(result).toBe(false);
  });
});
