import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SV_NewChaseDir } from '../../src/ai/movement.js';
import type { Entity } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';

describe('SV_NewChaseDir', () => {
  let entity: Entity;
  let context: EntitySystem;
  let traceMock: any;
  let pointContentsMock: any;
  let enemy: Entity;

  beforeEach(() => {
    entity = {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: { index: 1 } as Entity,
      waterlevel: 0,
      monsterinfo: {
          aiflags: 0
      },
      ideal_yaw: 0,
      angles: { x: 0, y: 0, z: 0 },
      enemy: null
    } as unknown as Entity;

    enemy = {
        origin: { x: 100, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
    } as unknown as Entity;

    traceMock = vi.fn();
    pointContentsMock = vi.fn();

    context = {
      trace: traceMock,
      pointcontents: pointContentsMock,
      random: {
          value: () => 0.5
      }
    } as unknown as EntitySystem;
  });

  it('should not move if enemy is not set', () => {
    entity.enemy = null;
    SV_NewChaseDir(entity, null, 10, context);
    expect(traceMock).not.toHaveBeenCalled();
  });

  it('should set ideal_yaw towards enemy and try to move', () => {
    // Enemy is at (100, 0, 0) relative to (0,0,0). ideal_yaw should be 0.

    // Mock trace success
    traceMock.mockImplementation((start, mins, maxs, end) => {
         // If checking bottom (downwards trace)
        if (end.z < start.z - 10) return { fraction: 0.5 };
        // If moving (horizontal)
        return { fraction: 1.0 };
    });
    pointContentsMock.mockReturnValue(0);

    SV_NewChaseDir(entity, enemy, 10, context);

    expect(entity.ideal_yaw).toBe(0);
    // Entity should have moved
    expect(entity.origin.x).toBeGreaterThan(0);
  });

  it('should try 45 degrees if direct path is blocked', () => {
    // Enemy at (100, 0, 0).

     // Mock trace failure for straight move
    traceMock.mockImplementation((start, mins, maxs, end) => {
        // Checking bottom always succeeds
        if (end.z < start.z - 10) return { fraction: 0.5 };

        // Horizontal move
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // 0 degrees is blocked (positive x)
        if (dx > 0 && Math.abs(dy) < 0.1) return { fraction: 0.5 };

        // 45 degrees is clear
        return { fraction: 1.0 };
    });
    pointContentsMock.mockReturnValue(0);

    SV_NewChaseDir(entity, enemy, 10, context);

    // It should have moved (via step direction trying other angles)
    expect(entity.origin.x).toBeGreaterThan(0);
  });
});
