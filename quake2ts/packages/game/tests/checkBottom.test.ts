import { describe, it, expect, vi, beforeEach } from 'vitest';
import { M_CheckBottom } from '../src/ai/movement.js';
import type { Entity } from '../src/entities/entity.js';
import type { EntitySystem } from '../src/entities/system.js';
import { MoveType, Solid } from '../src/entities/entity.js';
import { CONTENTS_SOLID } from '@quake2ts/shared';

describe('M_CheckBottom', () => {
  let entity: Entity;
  let context: EntitySystem;
  let traceMock: any;
  let pointContentsMock: any;

  beforeEach(() => {
    entity = {
      origin: { x: 0, y: 0, z: 100 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: null,
      waterlevel: 0,
    } as unknown as Entity;

    traceMock = vi.fn();
    pointContentsMock = vi.fn();

    context = {
      trace: traceMock,
      pointcontents: pointContentsMock,
    } as unknown as EntitySystem;
  });

  it('should return true if point content is solid (lava/slime/water)', () => {
    pointContentsMock.mockReturnValue(1); // Non-zero content
    const result = M_CheckBottom(entity, context);
    expect(result).toBe(true);
  });

  it('should return false if trace does not hit anything (stepping off into void)', () => {
    pointContentsMock.mockReturnValue(0);
    traceMock.mockReturnValue({ fraction: 1.0 }); // Did not hit anything

    const result = M_CheckBottom(entity, context);
    expect(result).toBe(false);
  });

  it('should return true if trace hits something (solid ground)', () => {
    pointContentsMock.mockReturnValue(0);
    traceMock.mockReturnValue({ fraction: 0.5 }); // Hit something

    const result = M_CheckBottom(entity, context);
    expect(result).toBe(true);
  });
});
