import { describe, it, expect } from 'vitest';
import { Entity, MoveType } from '../src/entities/entity.js';
import { runGravity, runBouncing, runProjectileMovement } from '../src/physics/movement.js';
import { GameImports, GameTraceResult } from '../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

const mockTraceFn = (result: GameTraceResult) => {
  return (
    start: Vec3,
    mins: Vec3 | null,
    maxs: Vec3 | null,
    end: Vec3,
    passent: Entity | null,
    contentmask: number
  ) => result;
};

const mockImports = (result: GameTraceResult): GameImports => ({
  trace: mockTraceFn(result),
  pointcontents: () => 0,
});


describe('runGravity', () => {
  it('should apply gravity to an entity with MOVETYPE_TOSS', () => {
    const ent = new Entity(0);
    ent.movetype = MoveType.Toss;
    ent.velocity = { x: 0, y: 0, z: 0 };

    // Mock world constants
    const sv_gravity = 800;
    const frametime = 0.1; // 100ms

    runGravity(ent, sv_gravity, frametime);

    // From Quake C code: ent->velocity[2] -= ent->gravity * sv_gravity * frametime;
    // Assuming ent.gravity is 1.0
    const expectedZVelocity = 0 - 1.0 * sv_gravity * frametime;
    expect(ent.velocity.z).toBe(expectedZVelocity);
  });
});

describe('runProjectileMovement', () => {
  it('should move the entity to the destination if there is no collision', () => {
    const ent = new Entity(0);
    ent.movetype = MoveType.FlyMissile;
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.velocity = { x: 1000, y: 0, z: 0 };

    const mockTrace: GameTraceResult = {
      fraction: 1.0,
      plane: null,
      contents: 0,
      surfaceFlags: 0,
      startsolid: false,
      allsolid: false,
      endpos: { x: 100, y: 0, z: 0 },
      ent: null,
    };

    const frametime = 0.1;

    runProjectileMovement(ent, mockImports(mockTrace), frametime);

    expect(ent.origin.x).toBe(100); // 1000 * 0.1
    expect(ent.origin.y).toBe(0);
    expect(ent.origin.z).toBe(0);
  });

  it('should pass the entity clipmask to the trace function', () => {
    const ent = new Entity(0);
    ent.movetype = MoveType.FlyMissile;
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.velocity = { x: 1000, y: 0, z: 0 };
    ent.clipmask = 42;

    let passedClipmask = -1;

    const mockTrace: GameTraceResult = {
      fraction: 1.0,
      plane: null,
      contents: 0,
      surfaceFlags: 0,
      startsolid: false,
      allsolid: false,
      endpos: { x: 100, y: 0, z: 0 },
      ent: null,
    };

    const trace = (
      start: Vec3,
      mins: Vec3 | null,
      maxs: Vec3 | null,
      end: Vec3,
      passent: Entity | null,
      contentmask: number
    ) => {
      passedClipmask = contentmask;
      return mockTrace;
    };

    const frametime = 0.1;

    runProjectileMovement(ent, { trace, pointcontents: () => 0 }, frametime);

    expect(passedClipmask).toBe(42);
  });
});

describe('runBouncing', () => {
  it('should reflect velocity when a bouncing entity collides with a surface', () => {
    const ent = new Entity(0);
    ent.movetype = MoveType.Bounce;
    ent.velocity = { x: 100, y: 0, z: -100 };
    ent.origin = { x: 0, y: 0, z: 10 };
    ent.bounce = 1.5;

    const mockTrace: GameTraceResult = {
      fraction: 0.5,
      plane: {
        normal: { x: 0, y: 0, z: 1 }, // Hit the floor
        dist: 0,
        type: 0,
        signbits: 0,
      },
      contents: 0,
      surfaceFlags: 0,
      startsolid: false,
      allsolid: false,
      endpos: { x: 50, y: 0, z: 5 },
      ent: null,
    };

    runBouncing(ent, mockImports(mockTrace), 0.1);

    // See derivation in thought block.
    expect(ent.velocity.x).toBeCloseTo(150);
    expect(ent.velocity.y).toBeCloseTo(0);
    expect(ent.velocity.z).toBeCloseTo(1.5);
    expect(ent.origin.x).toBe(50);
    expect(ent.origin.y).toBe(0);
    expect(ent.origin.z).toBe(5);
  });
});
