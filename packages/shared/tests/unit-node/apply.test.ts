import { describe, expect, it } from 'vitest';
import {
  applyPmove,
  type PlayerState,
  type PmoveCmd,
  type PmoveTraceResult,
  type Vec3,
  lengthVec3,
  normalizeVec3
} from '@quake2ts/shared';

/**
 * Integration tests for applyPmove with view angles.
 * These tests verify that player movement is correctly calculated
 * relative to their view direction, not hardcoded world directions.
 */
describe('applyPmove integration with view angles', () => {

  // Helper to create a basic player state
  const createPlayerState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    viewAngles: { x: 0, y: 0, z: 0 },
    onGround: true,
    waterLevel: 0,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },
    damageAlpha: 0,
    damageIndicators: [],
    blend: [0, 0, 0, 0],
    stats: [],
    kick_angles: { x: 0, y: 0, z: 0 },
    kick_origin: { x: 0, y: 0, z: 0 },
    gunoffset: { x: 0, y: 0, z: 0 },
    gunangles: { x: 0, y: 0, z: 0 },
    gunindex: 0,
    pm_type: 0,
    pm_time: 0,
    pm_flags: 0,
    gun_frame: 0,
    rdflags: 0,
    fov: 90,
    ...overrides,
  });

  // Simple trace function that allows free movement
  const freeMovementTrace = (start: Vec3, end: Vec3): PmoveTraceResult => ({
    fraction: 1.0,
    endpos: end,
    allsolid: false,
    startsolid: false,
  });

  // Point contents that returns no water/solid
  const emptyPointContents = (_point: Vec3): number => 0;

  describe('movement relative to view direction', () => {
    it('moves forward in the direction of yaw=0 (north)', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      // Apply pmove multiple times to accumulate velocity
      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Should have moved primarily in +X direction (forward for yaw=0)
      expect(currentState.velocity.x).toBeGreaterThan(20);
      expect(Math.abs(currentState.velocity.y)).toBeLessThan(5);

      // Origin should also reflect this movement
      expect(currentState.origin.x).toBeGreaterThan(state.origin.x);
    });

    it('moves forward in the direction of yaw=90 (east)', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 90, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Should have moved primarily in +Y direction (forward for yaw=90)
      expect(currentState.velocity.y).toBeGreaterThan(20);
      expect(Math.abs(currentState.velocity.x)).toBeLessThan(5);

      expect(currentState.origin.y).toBeGreaterThan(state.origin.y);
    });

    it('moves forward in the direction of yaw=180 (south)', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 180, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Should have moved primarily in -X direction (forward for yaw=180)
      expect(currentState.velocity.x).toBeLessThan(-20);
      expect(Math.abs(currentState.velocity.y)).toBeLessThan(5);

      expect(currentState.origin.x).toBeLessThan(state.origin.x);
    });

    it('moves forward in the direction of yaw=270 (west)', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 270, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Should have moved primarily in -Y direction (forward for yaw=270)
      expect(currentState.velocity.y).toBeLessThan(-20);
      expect(Math.abs(currentState.velocity.x)).toBeLessThan(5);

      expect(currentState.origin.y).toBeLessThan(state.origin.y);
    });
  });

  describe('strafing relative to view direction', () => {
    it('strafes right relative to yaw=0', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 127, // strafe right
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Right for yaw=0 is -Y direction
      expect(currentState.velocity.y).toBeLessThan(-20);
      expect(Math.abs(currentState.velocity.x)).toBeLessThan(5);
    });

    it('strafes right relative to yaw=90', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 90, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 127,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Right for yaw=90 is +X direction
      expect(currentState.velocity.x).toBeGreaterThan(20);
      expect(Math.abs(currentState.velocity.y)).toBeLessThan(5);
    });
  });

  describe('diagonal movement', () => {
    it('moves diagonally forward-right relative to view angle', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 127,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Should move in both +X (forward) and -Y (right) directions
      expect(currentState.velocity.x).toBeGreaterThan(15);
      expect(currentState.velocity.y).toBeLessThan(-15);

      // Velocity should be normalized diagonally
      const velocityDir = normalizeVec3(currentState.velocity);
      expect(Math.abs(velocityDir.x)).toBeGreaterThan(0.5);
      expect(Math.abs(velocityDir.y)).toBeGreaterThan(0.5);
    });
  });

  describe('pitch angle influence', () => {
    it('reduces pitch influence for ground movement (pitch/3)', () => {
      // Test that looking down doesn't make you move downward on ground
      const state = createPlayerState({
        viewAngles: { x: 45, y: 0, z: 0 }, // looking down 45 degrees
        onGround: true,
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // Z velocity should be minimal for ground movement (pitch/3 adjustment)
      // The wishdir should have Z forced to 0 by buildAirGroundWish
      expect(Math.abs(currentState.velocity.z)).toBeLessThan(50);

      // Should still move forward in X direction
      expect(currentState.velocity.x).toBeGreaterThan(20);
    });

    it('handles water movement differently from ground movement', () => {
      // Water movement should use different physics
      // The key test is that view angles are used correctly (tested above)
      // Water-specific behavior (upmove, friction) is tested in dedicated water tests
      const stateGround = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
        waterLevel: 0, // on ground
        onGround: true,
      });

      const stateWater = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
        waterLevel: 2, // in water
        onGround: false,
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const groundResult = applyPmove(stateGround, cmd, freeMovementTrace, emptyPointContents);
      const waterResult = applyPmove(stateWater, cmd, freeMovementTrace, emptyPointContents);

      // Both should accelerate forward, but at different rates
      expect(groundResult.velocity.x).toBeGreaterThan(0);
      expect(waterResult.velocity.x).toBeGreaterThan(0);

      // This test primarily verifies that both code paths work with view angles
      expect(groundResult).toBeDefined();
      expect(waterResult).toBeDefined();
    });

    // NOTE: Comprehensive water physics tests exist in water.test.ts
    // This test verifies that view angles work correctly for both water and ground
    // Water-specific behavior (upmove, friction, bias) is covered in dedicated tests
  });

  describe('consistency across frames', () => {
    it('produces consistent movement when repeated', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 45, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      // Run twice and compare
      let state1 = state;
      let state2 = state;

      for (let i = 0; i < 10; i++) {
        state1 = applyPmove(state1, cmd, freeMovementTrace, emptyPointContents);
      }

      for (let i = 0; i < 10; i++) {
        state2 = applyPmove(state2, cmd, freeMovementTrace, emptyPointContents);
      }

      // Results should be identical
      expect(state1.origin.x).toBeCloseTo(state2.origin.x, 10);
      expect(state1.origin.y).toBeCloseTo(state2.origin.y, 10);
      expect(state1.origin.z).toBeCloseTo(state2.origin.z, 10);

      expect(state1.velocity.x).toBeCloseTo(state2.velocity.x, 10);
      expect(state1.velocity.y).toBeCloseTo(state2.velocity.y, 10);
      expect(state1.velocity.z).toBeCloseTo(state2.velocity.z, 10);
    });
  });

  describe('edge cases', () => {
    it('handles zero view angles correctly', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result = applyPmove(state, cmd, freeMovementTrace, emptyPointContents);

      expect(result).toBeDefined();
      expect(result.velocity.x).toBeGreaterThan(0);
    });

    it('handles 360 degree wrapping', () => {
      const state1 = createPlayerState({
        viewAngles: { x: 0, y: 0, z: 0 },
      });

      const state2 = createPlayerState({
        viewAngles: { x: 0, y: 360, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result1 = applyPmove(state1, cmd, freeMovementTrace, emptyPointContents);
      const result2 = applyPmove(state2, cmd, freeMovementTrace, emptyPointContents);

      // Both should produce same results
      expect(result1.velocity.x).toBeCloseTo(result2.velocity.x, 5);
      expect(result1.velocity.y).toBeCloseTo(result2.velocity.y, 5);
    });

    it('handles no input gracefully', () => {
      const state = createPlayerState({
        viewAngles: { x: 0, y: 45, z: 0 },
      });

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 0,
        upmove: 0,
      };

      const result = applyPmove(state, cmd, freeMovementTrace, emptyPointContents);

      expect(result).toBeDefined();
      // With no input, velocity should remain low or decrease due to friction
      expect(lengthVec3(result.velocity)).toBeLessThan(10);
    });
  });

  describe('comparison: correct vs incorrect implementation', () => {
    it('produces DIFFERENT results than hardcoded vectors would', () => {
      // This test demonstrates that our fix actually changes behavior
      // A player facing east (yaw=90) should move east, not north

      const state = createPlayerState({
        viewAngles: { x: 0, y: 90, z: 0 }, // facing east
      });

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      let currentState = state;
      for (let i = 0; i < 10; i++) {
        currentState = applyPmove(currentState, cmd, freeMovementTrace, emptyPointContents);
      }

      // With correct implementation: should move in +Y (east)
      expect(currentState.velocity.y).toBeGreaterThan(20);
      expect(Math.abs(currentState.velocity.x)).toBeLessThan(5);

      // With hardcoded vectors {x:1, y:0, z:0}, it would move in +X (north)
      // This test verifies we're NOT doing that
      expect(Math.abs(currentState.velocity.x)).toBeLessThan(5);
    });
  });
});
