import { describe, expect, it } from 'vitest';
import {
  makeLeafModel,
  makeBrushFromMinsMaxs,
  createTraceRunner
} from '@quake2ts/test-utils';
import {
  applyPmoveAirMove,
  categorizePosition,
  runPmove,
  PmoveCmd,
  ZERO_VEC3,
  PmType, PmFlag, PlayerButton
} from '@quake2ts/shared';

// Integration test for Player Movement with actual BSP tracing
describe('Player Movement Integration', () => {
  // Construct a simple BSP map: A room with a floor, walls, and a step/box
  // World bounds: -256 to 256
  // Floor: z=0
  // Step: at x=100, height 16 (typical Quake step)

  const floorBrush = makeBrushFromMinsMaxs({ x: -256, y: -256, z: -32 }, { x: 256, y: 256, z: 0 });
  const wallBrush = makeBrushFromMinsMaxs({ x: 256, y: -256, z: 0 }, { x: 288, y: 256, z: 128 });
  const stepBrush = makeBrushFromMinsMaxs({ x: 100, y: -64, z: 0 }, { x: 164, y: 64, z: 16 });

  // makeLeafModel puts all brushes in one leaf.
  const model = makeLeafModel([floorBrush, wallBrush, stepBrush]);
  const trace = createTraceRunner(model);
  const pointContents = (p: any) => 0; // Mock empty space contents

  const mins = { x: -16, y: -16, z: -24 };
  const maxs = { x: 16, y: 16, z: 32 };

  // Default pmove state
  const defaultPmoveState = {
    origin: { x: 0, y: 0, z: 10 },
    velocity: { x: 0, y: 0, z: 0 },
    mins,
    maxs,
    pmFlags: 0,
    pmType: PmType.Normal,
    viewHeight: 22,
    waterlevel: 0,
    watertype: 0,
    onGround: false,
    groundContents: 0,
    gravity: 800,
    pmAccelerate: 10,
    pmAirAccelerate: 1,
    pmMaxSpeed: 300,
    pmDuckSpeed: 100,
    pmWaterSpeed: 400,
    pmWaterAccelerate: 10,
    frametime: 0.1,
    cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0, angles: { x: 0, y: 0, z: 0 } } as PmoveCmd,
    forward: { x: 1, y: 0, z: 0 },
    right: { x: 0, y: 1, z: 0 },
    viewAngles: { x: 0, y: 0, z: 0 },
    delta_angles: { x: 0, y: 0, z: 0 },
    viewPitch: 0,
    ladderMod: 1,
    onLadder: false,
    hasTime: false,
    pmTime: 0,
    n64Physics: false,
    startVelocity: { x: 0, y: 0, z: 0 }, // Used for impact calculation
  };

  it('should slide along the floor', () => {
    // Start slightly above the floor to avoid starting inside solid
    // Floor is at z=0, mins.z=-24. Top of feet is z-24.
    // If z=24, feet at 0.
    // Start at 24.1 to be safe.
    let state = { ...defaultPmoveState, origin: { x: 0, y: 0, z: 24.1 } };

    // Categorize position to update onGround status
    let catResult = categorizePosition({
       ...state,
       viewheight: state.viewHeight,
       trace,
       pointContents
    });

    state.pmFlags = catResult.pmFlags;
    state.onGround = catResult.onGround;

    expect(state.onGround).toBe(true);

    // Now slide along floor
    const startX = state.origin.x;
    state.cmd = { forwardmove: 400, sidemove: 0, upmove: 0, buttons: 0, angles: { x: 0, y: 0, z: 0 } };

    const moveResult = applyPmoveAirMove({
        ...state,
        trace,
    });

    state.origin = moveResult.origin;
    state.velocity = moveResult.velocity;

    // Should have moved in X
    expect(state.origin.x).toBeGreaterThan(startX);
    // Should stay close to ground
    expect(state.origin.z).toBeCloseTo(24.1, 1);
  });

  it('should be on ground when standing on floor', () => {
     let state = { ...defaultPmoveState, origin: { x: 0, y: 0, z: 24.1 } };

     // Check if we are on ground
     let catResult = categorizePosition({
       ...state,
       viewheight: state.viewHeight,
       trace,
       pointContents
    });

    expect(catResult.onGround).toBe(true);
  });

  it('should step up a 16 unit stair', () => {
    // Position just before step
    // Step is at x=100. Player radius 16. So front of player hits at x=84.
    const startX = 80;

    // Start slightly above ground to avoid precision startsolid issues
    let state = {
        ...defaultPmoveState,
        origin: { x: startX, y: 0, z: 24.01 }, // On ground
        velocity: { x: 200, y: 0, z: 0 }, // Moving towards step
        onGround: true,
        pmFlags: PmFlag.OnGround
    };

    state.cmd = { forwardmove: 400, sidemove: 0, upmove: 0, buttons: 0, angles: { x: 0, y: 0, z: 0 } };

    const result = applyPmoveAirMove({
        ...state,
        trace,
        stepSize: 18 // Pass stepSize as expected by current move.ts
    });

    // Should have climbed the step
    // New Z should be 24 (base) + 16 (step height) = 40.01
    expect(result.origin.x).toBeGreaterThan(startX);
    expect(result.origin.z).toBeGreaterThan(30); // Climbed
  });

  it('should jump correctly', () => {
     let state = {
        ...defaultPmoveState,
        origin: { x: 0, y: 0, z: 24.01 }, // On ground
        velocity: { x: 0, y: 0, z: 0 },
        onGround: true,
        pmFlags: PmFlag.OnGround
    };

    state.cmd = { forwardmove: 0, sidemove: 0, upmove: 200, buttons: PlayerButton.Jump, angles: { x: 0, y: 0, z: 0 } };

    const imports = {
        trace: trace,
        pointcontents: pointContents
    };

    const endState = runPmove(state, imports);

    expect(endState.pmFlags & PmFlag.JumpHeld).toBeTruthy();
    expect(endState.pmFlags & PmFlag.OnGround).toBe(0);

    // Check velocity
    // Jump adds 270. Gravity (800) is applied for 0.025s (20 units).
    // Expected velocity Z = 270 - 20 = 250.
    expect(endState.velocity).toEqual({ x: 0, y: 0, z: 250 });
  });
});
