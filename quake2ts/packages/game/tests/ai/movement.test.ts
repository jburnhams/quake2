import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  Entity,
  ai_face,
  ai_charge,
  ai_move,
  facingIdeal,
  ai_run,
  ai_stand,
  ai_turn,
  ai_walk,
  AIFlags,
  changeYaw,
  walkMove,
  M_MoveStep,
  M_MoveToGoal,
  M_MoveToPath,
  SV_StepDirection,
  M_CheckBottom,
  CheckGround,
  M_walkmove
} from '../../src/index.js';
// Import EntityFlags directly to avoid potential circular dependency issues or undefined exports
import { EntityFlags, MoveType } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';

function createEntity(): Entity {
  const ent = new Entity(0);
  ent.inUse = true;
  ent.origin = { x: 0, y: 0, z: 0 };
  // Set FLY flag to bypass ground checks in M_walkmove during these pure math/logic tests unless specified
  ent.flags |= EntityFlags.Fly;
  ent.movetype = MoveType.Step;
  return ent;
}

// Mock context for M_walkmove
const mockTraceFn = vi.fn();
const mockPointcontentsFn = vi.fn();
const mockPickTargetFn = vi.fn();
const mockTargetAwareness = {
  frameNumber: 0,
  sightEntity: null,
  sightEntityFrame: 0,
  soundEntity: null,
  soundEntityFrame: 0,
  sound2Entity: null,
  sound2EntityFrame: 0,
  sightClient: null,
};

const mockContext = {
  trace: mockTraceFn,
  pointcontents: mockPointcontentsFn,
  pickTarget: mockPickTargetFn,
  targetAwareness: mockTargetAwareness,
  timeSeconds: 100, // Fixed time
} as unknown as EntitySystem;

beforeEach(() => {
  // Reset and reconfigure mocks before each test
  mockTraceFn.mockReset();
  mockTraceFn.mockReturnValue({
    fraction: 1.0,
    allsolid: false,
    startsolid: false,
    ent: null,
    endpos: { x: 0, y: 0, z: 0 } // default
  });
  mockPointcontentsFn.mockReset();
  mockPointcontentsFn.mockReturnValue(0);
  mockPickTargetFn.mockReset();
  mockPickTargetFn.mockReturnValue(undefined);
  mockTargetAwareness.frameNumber = 0;
  mockTargetAwareness.sightEntity = null;
});

describe('walkMove', () => {
  it('translates along the yaw plane matching M_walkmove math', () => {
    const ent = createEntity();
    ent.origin = { x: 0, y: 0, z: 0 };
    const originRef = ent.origin;

    walkMove(ent, 90, 10);
    expect(ent.origin.x).toBeCloseTo(0, 6);
    expect(ent.origin.y).toBeCloseTo(10, 6);
    expect(ent.origin.z).toBe(0);

    walkMove(ent, 180, 5);
    expect(ent.origin.x).toBeCloseTo(-5, 6);
    expect(ent.origin.y).toBeCloseTo(10, 6);
    expect(ent.origin).toBe(originRef);
  });
});

describe('changeYaw', () => {
  it('clamps yaw changes based on yaw_speed and frame rate', () => {
    const ent = createEntity();
    ent.angles.y = 0;
    ent.ideal_yaw = 90;
    ent.yaw_speed = 20;

    changeYaw(ent, 0.025);
    expect(ent.angles.y).toBeCloseTo(5, 6);
  });

  it('wraps to the shortest direction across the 0/360 seam', () => {
    const ent = createEntity();
    ent.angles.y = 10;
    ent.ideal_yaw = 350;
    ent.yaw_speed = 90;

    changeYaw(ent, 0.025);
    expect(ent.angles.y).toBeCloseTo(350, 6);
  });

  it('preserves yaw when no time elapses or yaw_speed is zero', () => {
    const ent = createEntity();
    ent.angles.y = 45;
    ent.ideal_yaw = 90;
    const anglesRef = ent.angles;

    changeYaw(ent, 0);
    expect(ent.angles.y).toBe(45);

    ent.yaw_speed = 0;
    changeYaw(ent, 0.025);
    expect(ent.angles.y).toBe(45);
    expect(ent.angles).toBe(anglesRef);
  });
});

describe('facingIdeal', () => {
  it('uses a 45 degree tolerance by default', () => {
    const ent = createEntity();
    ent.angles.y = 0;
    ent.ideal_yaw = 46;

    expect(facingIdeal(ent)).toBe(false);

    ent.ideal_yaw = 45;
    expect(facingIdeal(ent)).toBe(true);

    ent.ideal_yaw = 314;
    ent.angles.y = 0;
    expect(facingIdeal(ent)).toBe(false);
  });

  it('tightens tolerance when pathing to match rerelease steering', () => {
    const ent = createEntity();
    ent.monsterinfo.aiflags |= AIFlags.Pathing;
    ent.angles.y = 0;

    ent.ideal_yaw = 6;
    expect(facingIdeal(ent)).toBe(false);

    ent.ideal_yaw = 355;
    expect(facingIdeal(ent)).toBe(true);
  });
});

describe('ai_move', () => {
  it('walks forward along the current yaw without turning', () => {
    const ent = createEntity();
    ent.angles.y = 45;

    ai_move(ent, Math.SQRT2);

    expect(ent.origin.x).toBeCloseTo(1, 6);
    expect(ent.origin.y).toBeCloseTo(1, 6);
    expect(ent.angles.y).toBeCloseTo(45, 6);
  });
});

describe('ai_turn', () => {
  it('moves first, then turns toward ideal yaw', () => {
    const ent = createEntity();
    ent.angles.y = 0;
    ent.ideal_yaw = 90;
    ent.yaw_speed = 40;

    ai_turn(ent, 8, 0.1);

    expect(ent.origin.x).toBeCloseTo(8, 6);
    expect(ent.origin.y).toBeCloseTo(0, 6);
    expect(ent.angles.y).toBeCloseTo(40, 6);
  });
});

describe('ai_stand', () => {
  it('only rotates toward ideal yaw without translation', () => {
    const ent = createEntity();
    ent.angles.y = 350;
    ent.ideal_yaw = 10;
    ent.yaw_speed = 90;

    ai_stand(ent, 0.1, mockContext);

    expect(ent.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(ent.angles.y).toBeCloseTo(10, 6);
  });
});

describe('ai_walk', () => {
  it('faces the goal entity before stepping forward', () => {
    const ent = createEntity();
    ent.yaw_speed = 90;
    const goal = createEntity();
    goal.origin = { x: 0, y: 10, z: 0 };
    ent.goalentity = goal;

    // Must mock M_walkmove success
    mockTraceFn.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 4, z: 0 }, allsolid: false, startsolid: false });

    ai_walk(ent, 4, 0.1, mockContext);

    expect(ent.ideal_yaw).toBeCloseTo(90, 6);
    expect(ent.angles.y).toBeCloseTo(90, 6);
    expect(ent.origin.y).toBeCloseTo(4, 6);
  });
});

describe('ai_run', () => {
  it('prioritizes the enemy for turning and movement', () => {
    const ent = createEntity();
    ent.yaw_speed = 60;
    const enemy = createEntity();
    enemy.origin = { x: -10, y: 0, z: 0 };
    ent.enemy = enemy;

    // Explicitly disable attack logic to test movement only
    ent.monsterinfo.checkattack = () => false;

    ai_run(ent, 6, 0.1, mockContext);

    expect(ent.ideal_yaw).toBeCloseTo(180, 6);
    expect(ent.angles.y).toBeCloseTo(300, 6);
    expect(ent.origin.x).toBeCloseTo(3, 6);
    expect(ent.origin.y).toBeCloseTo(-5.1961524, 5);
  });
});

describe('ai_face', () => {
  it('computes ideal yaw toward the enemy and rotates before moving', () => {
    const ent = createEntity();
    const enemy = createEntity();
    enemy.origin = { x: 0, y: 10, z: 0 };

    ent.angles.y = 0;
    ent.yaw_speed = 90;

    ai_face(ent, enemy, 4, 0.1);

    expect(ent.ideal_yaw).toBeCloseTo(90, 6);
    expect(ent.angles.y).toBeCloseTo(90, 6);
    expect(ent.origin.x).toBeCloseTo(0, 6);
    expect(ent.origin.y).toBeCloseTo(4, 6);
  });
});

describe('ai_charge', () => {
  it('matches ai_run behavior while always honoring the enemy yaw', () => {
    const ent = createEntity();
    ent.yaw_speed = 120;
    const enemy = createEntity();
    enemy.origin = { x: 0, y: -8, z: 0 };
    ent.enemy = enemy;

    // Explicitly disable attack logic to test movement only
    ent.monsterinfo.checkattack = () => false;

    ai_charge(ent, 8, 0.1, mockContext);

    expect(ent.ideal_yaw).toBeCloseTo(270, 6);
    expect(ent.angles.y).toBeCloseTo(270, 6);
    expect(ent.origin.x).toBeCloseTo(0, 6);
    expect(ent.origin.y).toBeCloseTo(-8, 6);
  });
});

describe('M_MoveStep (Logic from M_walkmove)', () => {
  let mockEntity: Entity;

  beforeEach(() => {
    mockEntity = createEntity();
    mockEntity.origin = { x: 0, y: 0, z: 0 };
    mockEntity.movetype = MoveType.Step;
    mockEntity.flags = 0; // Not flying/swimming
    mockEntity.groundentity = {} as any;

    mockTraceFn.mockReset();
    mockTraceFn.mockReturnValue({ fraction: 1.0, startsolid: false, allsolid: false });
    mockPointcontentsFn.mockReturnValue(0);
  });

  it('should move successfully on flat ground', () => {
    // 1. Move
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 0 } });
    // 2. M_CheckBottom trace (success)
    mockTraceFn.mockReturnValue({ fraction: 0.5 }); // hit something

    const result = M_MoveStep(mockEntity, { x: 10, y: 0, z: 0 }, true, mockContext);

    expect(result).toBe(true);
    expect(mockEntity.origin.x).toBe(10);
  });

  it('should step up if blocked', () => {
    // 1. Trace forward: Blocked
    mockTraceFn.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 0, y: 0, z: 0 } });

    // 2. Trace UP: Clear
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, startsolid: false, allsolid: false, endpos: { x: 0, y: 0, z: 18 } });

    // 3. Trace Forward (at height): Clear
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, startsolid: false, allsolid: false, endpos: { x: 10, y: 0, z: 18 } });

    // 4. Trace Down: Hit ground at z=18
    mockTraceFn.mockReturnValueOnce({
        fraction: 0.5,
        endpos: { x: 10, y: 0, z: 18 },
        startsolid: false,
        allsolid: false
    });

    // M_CheckBottom traces (mock success)
    mockTraceFn.mockReturnValue({ fraction: 0.5 });

    const result = M_MoveStep(mockEntity, { x: 10, y: 0, z: 0 }, true, mockContext);

    expect(result).toBe(true);
    expect(mockEntity.origin.z).toBe(18);
    expect(mockEntity.origin.x).toBe(10);
  });

  it('should fail if blocked and cannot step up', () => {
    // 1. Trace forward: Blocked
    mockTraceFn.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false, endpos: { x: 0, y: 0, z: 0 } });

    // 2. Trace UP: Blocked (ceiling) but not allsolid, so it returns endpos
    mockTraceFn.mockReturnValueOnce({
        fraction: 0.5,
        startsolid: false,
        allsolid: false,
        endpos: { x: 0, y: 0, z: 9 } // Partial up
    });

    // 3. Trace Step (Forward): Blocked
    mockTraceFn.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false });

    const result = M_MoveStep(mockEntity, { x: 10, y: 0, z: 0 }, true, mockContext);

    expect(result).toBe(false);
    expect(mockEntity.origin.x).toBe(0);
  });
});

describe('M_MoveToGoal', () => {
  it('returns true if close enough to enemy', () => {
    const ent = createEntity();
    ent.enemy = createEntity();
    ent.enemy.origin = { x: 10, y: 0, z: 0 };
    ent.origin = { x: 0, y: 0, z: 0 };
    ent.groundentity = {} as any; // On ground

    const result = M_MoveToGoal(ent, 15, mockContext);
    expect(result).toBe(true);
  });

  it('moves towards goal using SV_StepDirection if not close enough', () => {
    const ent = createEntity();
    ent.ideal_yaw = 0;
    ent.groundentity = {} as any;

    // Mock M_walkmove success inside SV_StepDirection
    // 1. Trace forward success
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 0 } });
    // M_CheckBottom
    mockTraceFn.mockReturnValue({ fraction: 0.5 });

    const result = M_MoveToGoal(ent, 10, mockContext);
    expect(result).toBe(true);
    // Entity moved
    expect(ent.origin.x).toBe(10);
  });
});

describe('M_MoveToPath', () => {
  it('switches to next target when reached path_corner', () => {
    const ent = createEntity();
    const pathCorner = createEntity();
    pathCorner.classname = 'path_corner';
    pathCorner.target = 'next_path';
    pathCorner.origin = { x: 10, y: 0, z: 0 };

    ent.goalentity = pathCorner;
    ent.origin = { x: 10, y: 0, z: 0 }; // At goal
    ent.groundentity = {} as any;

    const nextPath = createEntity();
    nextPath.origin = { x: 20, y: 0, z: 0 };

    mockPickTargetFn.mockReturnValue(nextPath);

    // M_MoveToGoal calls M_MoveToPath internally
    const result = M_MoveToGoal(ent, 5, mockContext);

    expect(result).toBe(true);
    expect(mockPickTargetFn).toHaveBeenCalledWith('next_path');
    expect(ent.goalentity).toBe(nextPath);
    expect(ent.ideal_yaw).toBe(0); // Vector to next (20,0,0) from (10,0,0) is yaw 0
  });
});
