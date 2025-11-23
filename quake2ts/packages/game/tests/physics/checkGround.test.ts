import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckGround } from '../../src/ai/movement.js';
import type { Entity } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { MoveType } from '../../src/entities/entity.js';

describe('CheckGround', () => {
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

  it('should find ground when trace hits something', () => {
    traceMock.mockReturnValue({
      fraction: 0.5,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0, pad: [0,0] },
      ent: { index: 1 } as Entity
    });

    CheckGround(entity, context);

    expect(entity.groundentity).toBeDefined();
    expect(entity.groundentity?.index).toBe(1);
    expect(traceMock).toHaveBeenCalled();
  });

  it('should set groundentity to null when trace hits nothing', () => {
    traceMock.mockReturnValue({
      fraction: 1.0,
      plane: null,
      ent: null
    });

    CheckGround(entity, context);

    expect(entity.groundentity).toBeNull();
  });

  it('should not check ground for Noclip move type', () => {
    entity.movetype = MoveType.Noclip;
    CheckGround(entity, context);
    expect(traceMock).not.toHaveBeenCalled();
  });
});
