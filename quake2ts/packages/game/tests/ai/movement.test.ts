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
} from '../../src/index.js';
// Import EntityFlags directly to avoid potential circular dependency issues or undefined exports
import { EntityFlags } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';

function createEntity(): Entity {
  const ent = new Entity(0);
  ent.inUse = true;
  // Set FLY flag to bypass ground checks in M_walkmove during these pure math/logic tests
  ent.flags |= EntityFlags.Fly;
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
  mockTraceFn.mockReturnValue({
    fraction: 1.0,
    allsolid: false,
    startsolid: false,
    ent: null
  });
  mockPointcontentsFn.mockReturnValue(0);
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

// Added tests for M_walkmove stepping logic
import { M_walkmove, M_CheckBottom, CheckGround } from '../../src/ai/movement.js';
import { MoveType } from '../../src/entities/entity.js';

describe('M_walkmove stepping', () => {
  let mockEntity: Entity;
  // We reuse mockContext from above but need to adjust trace behavior

  beforeEach(() => {
    // Reset Entity
    mockEntity = createEntity();
    mockEntity.origin = { x: 0, y: 0, z: 0 };
    mockEntity.movetype = MoveType.Step;
    mockEntity.flags = 0; // Not flying/swimming
    mockEntity.groundentity = {} as any;

    // Reset mocks
    mockTraceFn.mockReset();
    mockTraceFn.mockReturnValue({ fraction: 1.0, startsolid: false, allsolid: false });
    mockPointcontentsFn.mockReturnValue(0);
  });

  it('should move successfully on flat ground', () => {
    // First trace: clear path
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, endpos: { x: 10, y: 0, z: 0 } });

    // M_CheckBottom mock: hit floor
    // This is called inside M_walkmove -> M_CheckBottom -> trace
    mockTraceFn.mockReturnValue({ fraction: 0.5 });

    const result = M_walkmove(mockEntity, 0, 10, mockContext);

    expect(result).toBe(true);
    expect(mockEntity.origin.x).toBe(10);
  });

  it('should step up if blocked', () => {
    // 1. Trace forward: Blocked (fraction < 1)
    mockTraceFn.mockReturnValueOnce({ fraction: 0.5, startsolid: false, allsolid: false });

    // 2. Trace UP: Clear
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, startsolid: false, allsolid: false });

    // 3. Trace Forward (at height): Clear
    mockTraceFn.mockReturnValueOnce({ fraction: 1.0, startsolid: false, allsolid: false });

    // 4. Trace Down: Hit ground at z=18 (step height)
    mockTraceFn.mockReturnValueOnce({
        fraction: 0.5,
        endpos: { x: 10, y: 0, z: 18 },
        startsolid: false,
        allsolid: false
    });

    // M_CheckBottom traces (mock success)
    mockTraceFn.mockReturnValue({ fraction: 0.5 });

    const result = M_walkmove(mockEntity, 0, 10, mockContext);

    expect(result).toBe(true);
    expect(mockEntity.origin.z).toBe(18);
    expect(mockEntity.origin.x).toBe(10);
  });
});
