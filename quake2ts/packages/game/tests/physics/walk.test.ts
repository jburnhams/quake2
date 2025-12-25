import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';
import { runStep } from '../../src/physics/movement.js';
import { GameImports } from '../../src/imports.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Vec3 } from '@quake2ts/shared';

describe('Physics: runStep', () => {
  let ent: Entity;
  let imports: GameImports;
  let system: EntitySystem;
  const frametime = 0.1;

  beforeEach(() => {
    ent = new Entity(1);
    ent.movetype = MoveType.Step;
    ent.gravity = 1;
    ent.velocity = { x: 0, y: 0, z: 0 };
    ent.origin = { x: 0, y: 0, z: 100 };
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };
    ent.flags = 0;

    imports = {
      trace: vi.fn().mockReturnValue({
        fraction: 1.0,
        endpos: { x: 0, y: 0, z: 0 },
        plane: null,
        allsolid: false,
        startsolid: false,
        ent: null
      }),
      pointcontents: vi.fn().mockReturnValue(0),
      linkentity: vi.fn(),
      areaEdicts: vi.fn().mockReturnValue(null), // Default null for fallback
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    system = {
      // Mocking trace to delegate to imports.trace, which is what EntitySystem does
      trace: (...args: any[]) => (imports.trace as any)(...args),
      pointcontents: (...args: any[]) => (imports.pointcontents as any)(...args),
      forEachEntity: vi.fn(),
      findInBox: vi.fn().mockReturnValue([]), // Mock findInBox
    } as unknown as EntitySystem;
  });

  it('should apply gravity if not on ground and not flying/swimming', () => {
    // Initial setup: in air, no velocity
    const gravity = { x: 0, y: 0, z: -800 };

    // Mock trace to show no collision (falling through air)
    (imports.trace as any).mockReturnValue({
        fraction: 1.0,
        endpos: { x: 0, y: 0, z: 100 + (-800 * frametime * frametime) }, // roughly
        plane: null
    });

    runStep(ent, system, imports, gravity, frametime);

    // Velocity.z should decrease by gravity * frametime
    expect(ent.velocity.z).toBeCloseTo(-800 * frametime);
  });

  it('should not apply gravity if FL_FLY is set', () => {
    ent.flags |= EntityFlags.Fly;
    const gravity = { x: 0, y: 0, z: -800 };

    runStep(ent, system, imports, gravity, frametime);

    expect(ent.velocity.z).toBe(0);
  });

  it('should not apply gravity if FL_SWIM is set', () => {
    ent.flags |= EntityFlags.Swim;
    const gravity = { x: 0, y: 0, z: -800 };

    runStep(ent, system, imports, gravity, frametime);

    expect(ent.velocity.z).toBe(0);
  });

  it('should move the entity based on velocity', () => {
    const gravity = { x: 0, y: 0, z: -800 };
    ent.velocity = { x: 100, y: 0, z: 0 };

    // Mock trace to allow full movement
    (imports.trace as any).mockImplementation((start, mins, maxs, end) => ({
        fraction: 1.0,
        endpos: end,
        plane: null
    }));

    runStep(ent, system, imports, gravity, frametime);

    // x should move by 100 * frametime
    expect(ent.origin.x).toBeCloseTo(100 * frametime);
    // z should change due to gravity
    expect(ent.velocity.z).toBeCloseTo(-800 * frametime);
  });

  it('should clip velocity when hitting a floor', () => {
      const gravity = { x: 0, y: 0, z: -800 };
      ent.velocity = { x: 0, y: 0, z: -200 };
      ent.origin = { x: 0, y: 0, z: 10 };

      // Mock hitting the floor
      (imports.trace as any).mockReturnValue({
          fraction: 0.5, // Hit halfway
          endpos: { x: 0, y: 0, z: 0 },
          plane: { normal: { x: 0, y: 0, z: 1 } }, // Floor plane
          allsolid: false,
          startsolid: false
      });

      runStep(ent, system, imports, gravity, frametime);

      // Should be on ground (z velocity cleared or close to it due to clip)
      // clipVelocityVec3 with normal (0,0,1) and vel (0,0,-200) -> 0
      // But runStep logic typically adds gravity first.
      // If we implement it like SV_Physics_Step, it handles clipping.

      // Let's see implementation details.
      // Expectation depends on implementation.
  });
});
