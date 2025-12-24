import { describe, it, expect, vi } from 'vitest';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { runGravity, runBouncing, runProjectileMovement } from '../../src/physics/movement.js';
import { GameImports, GameTraceResult } from '../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';
import { EntitySystem } from '../../src/entities/system.js';
import { createGameImportsAndEngine, createEntityFactory, createTraceMock } from '@quake2ts/test-utils';

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

// We will keep this local mock helper but implement it using default structures from test-utils where possible if needed.
// However, here it wraps trace result dynamically.
const mockImports = (result: GameTraceResult): GameImports => ({
  trace: mockTraceFn(result),
  pointcontents: () => 0,
  linkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
} as any);

const createMockSystem = (): EntitySystem => {
    return {
        world: new Entity(0),
    } as unknown as EntitySystem;
};


describe('runGravity', () => {
  it('should apply gravity to an entity with MOVETYPE_TOSS', () => {
    const ent = createEntityFactory({
        index: 0,
        movetype: MoveType.Toss,
        velocity: { x: 0, y: 0, z: 0 }
    }) as Entity;

    // Mock world constants
    const gravity = { x: 0, y: 0, z: -800 };
    const frametime = 0.1; // 100ms

    runGravity(ent, gravity, frametime);

    // From Quake C code: ent->velocity[2] -= ent->gravity * sv_gravity * frametime;
    // Assuming ent.gravity is 1.0 (default in createEntityFactory unless overriden? No, usually 1.0)
    // Actually default Entity gravity is 1.0.
    const expectedZVelocity = 0 + 1.0 * gravity.z * frametime;
    expect(ent.velocity.z).toBe(expectedZVelocity);
  });
});

describe('runProjectileMovement', () => {
  it('should move the entity to the destination if there is no collision', () => {
    const ent = createEntityFactory({
        index: 0,
        movetype: MoveType.FlyMissile,
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 1000, y: 0, z: 0 }
    }) as Entity;

    const mockTrace = createTraceMock({
      fraction: 1.0,
      endpos: { x: 100, y: 0, z: 0 },
    });

    const frametime = 0.1;

    runProjectileMovement(ent, mockImports(mockTrace), frametime);

    expect(ent.origin.x).toBe(100); // 1000 * 0.1
    expect(ent.origin.y).toBe(0);
    expect(ent.origin.z).toBe(0);
  });

  it('should pass the entity clipmask to the trace function', () => {
    const ent = createEntityFactory({
        index: 0,
        movetype: MoveType.FlyMissile,
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 1000, y: 0, z: 0 },
        clipmask: 42
    }) as Entity;

    let passedClipmask = -1;

    const mockTrace = createTraceMock({
      fraction: 1.0,
      endpos: { x: 100, y: 0, z: 0 },
    });

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
    const { imports } = createGameImportsAndEngine({ imports: { trace: trace as any } });

    runProjectileMovement(ent, imports, frametime);

    expect(passedClipmask).toBe(42);
  });
});

describe('runBouncing', () => {
  it('should reflect velocity when a bouncing entity collides with a surface', () => {
    const ent = createEntityFactory({
        index: 0,
        movetype: MoveType.Bounce,
        velocity: { x: 100, y: 0, z: -100 },
        origin: { x: 0, y: 0, z: 10 },
        bounce: 1.5 // This property is now ignored in favor of Q2 standard behavior (1.6 backoff)
    }) as Entity;
    ent.touch = vi.fn(); // Mock touch callback

    const mockTrace = createTraceMock({
      fraction: 0.5,
      plane: {
        normal: { x: 0, y: 0, z: 1 }, // Hit the floor
        dist: 0,
        type: 0,
        signbits: 0,
      },
      endpos: { x: 50, y: 0, z: 5 },
    });

    const system = createMockSystem();
    runBouncing(ent, system, mockImports(mockTrace), 0.1);

    // Q2 Logic: ClipVelocity with backoff 1.6
    // v = (100, 0, -100)
    // n = (0, 0, 1)
    // backoff = 1.6
    // v_new = v - backoff * dot(v, n) * n
    // dot = -100
    // v_new = (100, 0, -100) - 1.6 * (-100) * (0, 0, 1)
    // v_new = (100, 0, -100) + 160 * (0, 0, 1)
    // v_new = (100, 0, 60)

    expect(ent.velocity.x).toBeCloseTo(100);
    expect(ent.velocity.y).toBeCloseTo(0);
    expect(ent.velocity.z).toBeCloseTo(60);
    expect(ent.origin.x).toBe(50);
    expect(ent.origin.y).toBe(0);
    expect(ent.origin.z).toBe(5);

    // Verify touch was called
    expect(ent.touch).toHaveBeenCalled();
  });

  it('should reflect velocity perfectly with WallBounce', () => {
    const ent = createEntityFactory({
        index: 0,
        movetype: MoveType.WallBounce,
        velocity: { x: 100, y: 0, z: -100 },
        origin: { x: 0, y: 0, z: 10 }
    }) as Entity;
    ent.touch = vi.fn();

    const mockTrace = createTraceMock({
      fraction: 0.5,
      plane: {
        normal: { x: 0, y: 0, z: 1 }, // Hit the floor
        dist: 0,
        type: 0,
        signbits: 0,
      },
      endpos: { x: 50, y: 0, z: 5 },
    });

    const system = createMockSystem();
    runBouncing(ent, system, mockImports(mockTrace), 0.1);

    // Q2 Logic: ClipVelocity with backoff 2.0 (Elastic)
    // v_new = (100, 0, -100) - 2.0 * (-100) * (0, 0, 1)
    // v_new = (100, 0, -100) + 200 * (0, 0, 1)
    // v_new = (100, 0, 100)

    expect(ent.velocity.x).toBeCloseTo(100);
    expect(ent.velocity.y).toBeCloseTo(0);
    expect(ent.velocity.z).toBeCloseTo(100);

    expect(ent.touch).toHaveBeenCalled();
  });
});
