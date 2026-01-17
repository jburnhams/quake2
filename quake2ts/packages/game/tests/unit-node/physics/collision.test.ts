import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveImpact, checkTriggers } from '../../../src/physics/collision.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameTraceResult } from '../../../src/imports.js';
import { GameEngine } from '../../../src/index.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('Collision Physics', () => {
  let system: EntitySystem;
  let ent: Entity;
  let other: Entity;
  let engine: GameEngine;

  beforeEach(() => {
    const context = createTestContext();
    engine = context.engine;
    system = context.entities;

    // Spy on findInBox to control what checkTriggers sees
    vi.spyOn(system, 'findInBox').mockImplementation(() => []);

    ent = system.spawn();
    ent.inUse = true;
    other = system.spawn();
    other.inUse = true;
  });

  describe('resolveImpact', () => {
    it('should call touch on both entities', () => {
      ent.touch = vi.fn();
      other.touch = vi.fn();

      const trace: GameTraceResult = {
        fraction: 0.5,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0 },
        surfaceFlags: 0,
        contents: 0,
        allsolid: false,
        startsolid: false,
        ent: other
      };

      resolveImpact(ent, trace, system);

      // The implementation now passes null for surface if flags are 0 or constructed object if flags exist
      // Since surfaceFlags is 0, it passes null
      expect(ent.touch).toHaveBeenCalledWith(ent, other, trace.plane, null);
      expect(other.touch).toHaveBeenCalledWith(other, ent, trace.plane, null);
    });

    it('should pass surface flags if present', () => {
      ent.touch = vi.fn();
      other.touch = vi.fn();

      const trace: GameTraceResult = {
        fraction: 0.5,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0 },
        surfaceFlags: 123,
        contents: 0,
        allsolid: false,
        startsolid: false,
        ent: other
      };

      resolveImpact(ent, trace, system);

      expect(ent.touch).toHaveBeenCalledWith(ent, other, trace.plane, { name: '', flags: 123, value: 0 });
      expect(other.touch).toHaveBeenCalledWith(other, ent, trace.plane, { name: '', flags: 123, value: 0 });
    });

    it('should do nothing if no entity hit', () => {
      ent.touch = vi.fn();
      const trace: GameTraceResult = {
        fraction: 0.5,
        endpos: { x: 0, y: 0, z: 0 },
        plane: null,
        surfaceFlags: 0,
        contents: 0,
        allsolid: false,
        startsolid: false,
        ent: null
      };

      resolveImpact(ent, trace, system);

      expect(ent.touch).not.toHaveBeenCalled();
    });
  });

  describe('checkTriggers', () => {
    it('should detect intersecting triggers', () => {
      ent.movetype = MoveType.Step;
      ent.absmin = { x: 0, y: 0, z: 0 };
      ent.absmax = { x: 10, y: 10, z: 10 };

      const trigger = system.spawn();
      trigger.inUse = true;
      trigger.solid = Solid.Trigger;
      trigger.absmin = { x: 5, y: 5, z: 5 };
      trigger.absmax = { x: 15, y: 15, z: 15 };
      trigger.touch = vi.fn();

      // Mock findInBox to return the trigger
      vi.mocked(system.findInBox).mockReturnValue([trigger]);

      checkTriggers(ent, system);

      expect(trigger.touch).toHaveBeenCalledWith(trigger, ent);
    });

    it('should ignore non-triggers', () => {
      ent.movetype = MoveType.Step;
      ent.absmin = { x: 0, y: 0, z: 0 };
      ent.absmax = { x: 10, y: 10, z: 10 };

      const solid = system.spawn();
      solid.inUse = true;
      solid.solid = Solid.Bsp;
      solid.absmin = { x: 5, y: 5, z: 5 };
      solid.absmax = { x: 15, y: 15, z: 15 };
      solid.touch = vi.fn();

      // Mock findInBox to return the solid
      vi.mocked(system.findInBox).mockReturnValue([solid]);

      checkTriggers(ent, system);

      expect(solid.touch).not.toHaveBeenCalled();
    });

    it('should ignore non-intersecting triggers', () => {
      ent.movetype = MoveType.Step;
      ent.absmin = { x: 0, y: 0, z: 0 };
      ent.absmax = { x: 10, y: 10, z: 10 };

      const trigger = system.spawn();
      trigger.inUse = true;
      trigger.solid = Solid.Trigger;
      trigger.absmin = { x: 20, y: 20, z: 20 };
      trigger.absmax = { x: 30, y: 30, z: 30 };
      trigger.touch = vi.fn();

      // Mock findInBox to return the trigger even if not intersecting (as findInBox is broad phase)
      // checkTriggers should filter it out
      vi.mocked(system.findInBox).mockReturnValue([trigger]);

      checkTriggers(ent, system);

      expect(trigger.touch).not.toHaveBeenCalled();
    });
  });
});
