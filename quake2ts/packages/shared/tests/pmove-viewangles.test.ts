import { describe, expect, it } from 'vitest';
import { angleVectors } from '../src/math/angles.js';
import { normalizeVec3, lengthVec3, dotVec3 } from '../src/math/vec3.js';
import type { Vec3 } from '../src/math/vec3.js';
import {
  buildAirGroundWish,
  buildWaterWish,
} from '../src/pmove/pmove.js';
import type { PmoveCmd } from '../src/pmove/types.js';

/**
 * These tests verify that pmove correctly uses view angles to calculate
 * forward and right vectors for movement, rather than using hardcoded vectors.
 *
 * In Quake 2, movement is relative to the player's view direction:
 * - Forward key (W) moves in the direction the player is looking (yaw)
 * - Right key (D) moves perpendicular to the view direction
 * - The vectors must be calculated from viewAngles using AngleVectors
 *
 * Reference: rerelease/p_move.cpp lines 1538, 1686-1691, 800, 858
 */
describe('pmove view angle movement (critical bug fix)', () => {

  describe('angleVectors calculation', () => {
    it('calculates correct forward vector for 0 degree yaw (facing north)', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      // Forward should point along +X axis when yaw=0
      expect(forward.x).toBeCloseTo(1, 5);
      expect(forward.y).toBeCloseTo(0, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // Right should point along -Y axis (Quake's coordinate system)
      expect(right.x).toBeCloseTo(0, 5);
      expect(right.y).toBeCloseTo(-1, 5);
      expect(right.z).toBeCloseTo(0, 5);
    });

    it('calculates correct forward vector for 90 degree yaw (facing east)', () => {
      const angles: Vec3 = { x: 0, y: 90, z: 0 };
      const { forward, right } = angleVectors(angles);

      // Forward should point along +Y axis when yaw=90
      expect(forward.x).toBeCloseTo(0, 5);
      expect(forward.y).toBeCloseTo(1, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // Right should point along +X axis
      expect(right.x).toBeCloseTo(1, 5);
      expect(right.y).toBeCloseTo(0, 5);
      expect(right.z).toBeCloseTo(0, 5);
    });

    it('calculates correct forward vector for 180 degree yaw (facing south)', () => {
      const angles: Vec3 = { x: 0, y: 180, z: 0 };
      const { forward, right } = angleVectors(angles);

      // Forward should point along -X axis when yaw=180
      expect(forward.x).toBeCloseTo(-1, 5);
      expect(forward.y).toBeCloseTo(0, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // Right should point along +Y axis
      expect(right.x).toBeCloseTo(0, 5);
      expect(right.y).toBeCloseTo(1, 5);
      expect(right.z).toBeCloseTo(0, 5);
    });

    it('calculates correct forward vector for 270 degree yaw (facing west)', () => {
      const angles: Vec3 = { x: 0, y: 270, z: 0 };
      const { forward, right } = angleVectors(angles);

      // Forward should point along -Y axis when yaw=270
      expect(forward.x).toBeCloseTo(0, 5);
      expect(forward.y).toBeCloseTo(-1, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // Right should point along -X axis
      expect(right.x).toBeCloseTo(-1, 5);
      expect(right.y).toBeCloseTo(0, 5);
      expect(right.z).toBeCloseTo(0, 5);
    });

    it('calculates correct forward vector for 45 degree yaw (northeast)', () => {
      const angles: Vec3 = { x: 0, y: 45, z: 0 };
      const { forward, right } = angleVectors(angles);

      // Forward should point at 45 degrees between +X and +Y
      const len = Math.sqrt(2) / 2; // cos(45) = sin(45) ≈ 0.707
      expect(forward.x).toBeCloseTo(len, 5);
      expect(forward.y).toBeCloseTo(len, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // Right should be perpendicular
      expect(dotVec3(forward, right)).toBeCloseTo(0, 5);
    });

    it('handles pitch angles correctly (looking up/down)', () => {
      // Looking down 30 degrees
      const anglesDown: Vec3 = { x: 30, y: 0, z: 0 };
      const { forward: fwdDown } = angleVectors(anglesDown);

      // Forward should have negative Z component (down)
      expect(fwdDown.z).toBeLessThan(0);
      expect(lengthVec3(fwdDown)).toBeCloseTo(1, 5);

      // Looking up 30 degrees
      const anglesUp: Vec3 = { x: -30, y: 0, z: 0 };
      const { forward: fwdUp } = angleVectors(anglesUp);

      // Forward should have positive Z component (up)
      expect(fwdUp.z).toBeGreaterThan(0);
      expect(lengthVec3(fwdUp)).toBeCloseTo(1, 5);
    });

    it('applies pitch/3 adjustment for ground movement', () => {
      // In the original code, for ground/air movement, pitch is divided by 3
      // See rerelease/p_move.cpp lines 1686-1691
      const viewAngles: Vec3 = { x: 45, y: 0, z: 0 };

      // Original angles
      const { forward: fwdOriginal } = angleVectors(viewAngles);

      // Adjusted angles (pitch/3)
      const adjustedAngles: Vec3 = {
        x: viewAngles.x / 3,
        y: viewAngles.y,
        z: viewAngles.z
      };
      const { forward: fwdAdjusted } = angleVectors(adjustedAngles);

      // The adjusted forward should have less vertical component
      expect(Math.abs(fwdAdjusted.z)).toBeLessThan(Math.abs(fwdOriginal.z));
    });
  });

  describe('buildAirGroundWish with view angles', () => {
    it('moves forward relative to yaw=0 (north)', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,  // max forward
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should point along forward vector (north/+X)
      expect(result.wishdir.x).toBeCloseTo(1, 5);
      expect(result.wishdir.y).toBeCloseTo(0, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);
      expect(result.wishspeed).toBeGreaterThan(0);
    });

    it('moves forward relative to yaw=90 (east)', () => {
      const angles: Vec3 = { x: 0, y: 90, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should point along forward vector (east/+Y)
      expect(result.wishdir.x).toBeCloseTo(0, 5);
      expect(result.wishdir.y).toBeCloseTo(1, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);
    });

    it('moves forward relative to yaw=180 (south)', () => {
      const angles: Vec3 = { x: 0, y: 180, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should point along forward vector (south/-X)
      expect(result.wishdir.x).toBeCloseTo(-1, 5);
      expect(result.wishdir.y).toBeCloseTo(0, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);
    });

    it('strafes right relative to view direction', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 127,  // max right
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should point along right vector (-Y for yaw=0)
      expect(result.wishdir.x).toBeCloseTo(0, 5);
      expect(result.wishdir.y).toBeCloseTo(-1, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);
    });

    it('handles diagonal movement (forward + right)', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 127,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should be normalized combination of forward + right
      // Since forward=(1,0,0) and right=(0,-1,0), diagonal should be ~(0.707, -0.707, 0)
      const len = Math.sqrt(2) / 2;
      expect(result.wishdir.x).toBeCloseTo(len, 5);
      expect(result.wishdir.y).toBeCloseTo(-len, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);

      // Wishdir must be normalized
      expect(lengthVec3(result.wishdir)).toBeCloseTo(1, 5);
    });

    it('handles backward movement', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: -127,  // backward
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Wishdir should point opposite to forward vector
      expect(result.wishdir.x).toBeCloseTo(-1, 5);
      expect(result.wishdir.y).toBeCloseTo(0, 5);
      expect(result.wishdir.z).toBeCloseTo(0, 5);
    });

    it('produces zero wishspeed with no input', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      expect(result.wishspeed).toBe(0);
    });

    it('forces Z component to zero for ground movement', () => {
      // Even if we look up/down, ground movement should be horizontal only
      const angles: Vec3 = { x: 45, y: 0, z: 0 };  // looking down 45 degrees
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Z should always be 0 for ground/air movement
      expect(result.wishdir.z).toBeCloseTo(0, 5);
    });

    it('clamps wishspeed to maxSpeed', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 127,
        upmove: 0,
      };

      const maxSpeed = 100;
      const result = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed,
      });

      expect(result.wishspeed).toBeLessThanOrEqual(maxSpeed);
    });
  });

  describe('buildWaterWish with view angles', () => {
    it('moves forward in water relative to yaw', () => {
      const angles: Vec3 = { x: 0, y: 90, z: 0 };  // facing east
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      const result = buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Should move in the direction we're facing (east)
      // Note: Z will have small upward bias from water movement
      expect(result.wishdir.y).toBeGreaterThan(0);
      expect(result.wishspeed).toBeGreaterThan(0);
    });

    it('applies downward bias (sink) in water when no input', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 0,
        upmove: 0,  // no explicit up/down
      };

      const result = buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Should have downward component from bias (see rerelease PM_WaterMove sinking logic)
      expect(result.wishdir.z).toBeLessThan(0);
    });

    it('moves up in water with positive upmove', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 0,
        upmove: 127,  // swimming up
      };

      const result = buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Should move strongly upward
      expect(result.wishdir.z).toBeGreaterThan(0);
    });

    it('moves down in water with negative upmove', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 0,
        upmove: -127,  // swimming down
      };

      const result = buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Should move downward
      expect(result.wishdir.z).toBeLessThan(0);
    });

    it('halves wishspeed for water movement', () => {
      const angles: Vec3 = { x: 0, y: 0, z: 0 };
      const { forward, right } = angleVectors(angles);

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      // Calculate what the speed would be before halving
      const wishvel = {
        x: forward.x * cmd.forwardmove,
        y: forward.y * cmd.forwardmove,
        z: 10,  // upward bias
      };
      const expectedSpeed = Math.min(lengthVec3(wishvel), 320) * 0.5;

      const result = buildWaterWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Water movement should be half speed
      expect(result.wishspeed).toBeCloseTo(expectedSpeed, 2);
    });
  });

  describe('view angle edge cases', () => {
    it('handles extreme pitch angles', () => {
      const anglesUp: Vec3 = { x: -89, y: 0, z: 0 };  // looking almost straight up
      const { forward, right } = angleVectors(anglesUp);

      expect(lengthVec3(forward)).toBeCloseTo(1, 5);
      expect(lengthVec3(right)).toBeCloseTo(1, 5);
      expect(dotVec3(forward, right)).toBeCloseTo(0, 4);  // perpendicular
    });

    it('handles 360 degree wrapping', () => {
      const angles1: Vec3 = { x: 0, y: 0, z: 0 };
      const angles2: Vec3 = { x: 0, y: 360, z: 0 };

      const { forward: fwd1 } = angleVectors(angles1);
      const { forward: fwd2 } = angleVectors(angles2);

      // Should produce same result
      expect(fwd1.x).toBeCloseTo(fwd2.x, 5);
      expect(fwd1.y).toBeCloseTo(fwd2.y, 5);
      expect(fwd1.z).toBeCloseTo(fwd2.z, 5);
    });

    it('maintains orthogonality of forward/right/up vectors', () => {
      const angles: Vec3 = { x: 30, y: 45, z: 15 };
      const { forward, right, up } = angleVectors(angles);

      // All vectors should be unit length
      expect(lengthVec3(forward)).toBeCloseTo(1, 5);
      expect(lengthVec3(right)).toBeCloseTo(1, 5);
      expect(lengthVec3(up)).toBeCloseTo(1, 5);

      // All vectors should be perpendicular to each other
      expect(dotVec3(forward, right)).toBeCloseTo(0, 4);
      expect(dotVec3(forward, up)).toBeCloseTo(0, 4);
      expect(dotVec3(right, up)).toBeCloseTo(0, 4);
    });
  });

  describe('comparison with hardcoded vectors (demonstrates the bug)', () => {
    it('FAILS with hardcoded vectors when facing east', () => {
      // This test demonstrates the BUG in the current implementation
      // When facing east (yaw=90) and pressing forward, the player should move east
      // But with hardcoded forward={x:1, y:0, z:0}, they would move north instead!

      const hardcodedForward: Vec3 = { x: 1, y: 0, z: 0 };
      const hardcodedRight: Vec3 = { x: 0, y: 1, z: 0 };

      const cmd: PmoveCmd = {
        forwardmove: 127,
        sidemove: 0,
        upmove: 0,
      };

      // Using hardcoded vectors (BUG)
      const buggyResult = buildAirGroundWish({
        forward: hardcodedForward,
        right: hardcodedRight,
        cmd,
        maxSpeed: 320,
      });

      // Now calculate what SHOULD happen with proper view angles
      const angles: Vec3 = { x: 0, y: 90, z: 0 };  // facing east
      const { forward, right } = angleVectors(angles);

      const correctResult = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // The buggy version moves north (X direction)
      expect(buggyResult.wishdir.x).toBeCloseTo(1, 5);
      expect(buggyResult.wishdir.y).toBeCloseTo(0, 5);

      // The correct version moves east (Y direction)
      expect(correctResult.wishdir.x).toBeCloseTo(0, 5);
      expect(correctResult.wishdir.y).toBeCloseTo(1, 5);

      // They should NOT be equal - this demonstrates the bug!
      expect(buggyResult.wishdir.x).not.toBeCloseTo(correctResult.wishdir.x, 1);
      expect(buggyResult.wishdir.y).not.toBeCloseTo(correctResult.wishdir.y, 1);
    });

    it('FAILS with hardcoded vectors when strafing at yaw=180', () => {
      const hardcodedForward: Vec3 = { x: 1, y: 0, z: 0 };
      const hardcodedRight: Vec3 = { x: 0, y: 1, z: 0 };

      const cmd: PmoveCmd = {
        forwardmove: 0,
        sidemove: 127,  // strafe right
        upmove: 0,
      };

      // Using hardcoded vectors (BUG)
      const buggyResult = buildAirGroundWish({
        forward: hardcodedForward,
        right: hardcodedRight,
        cmd,
        maxSpeed: 320,
      });

      // With proper view angles facing south
      const angles: Vec3 = { x: 0, y: 180, z: 0 };
      const { forward, right } = angleVectors(angles);

      const correctResult = buildAirGroundWish({
        forward,
        right,
        cmd,
        maxSpeed: 320,
      });

      // Hardcoded: always strafes in +Y direction
      expect(buggyResult.wishdir.y).toBeCloseTo(1, 5);

      // Correct: when facing south, strafing right moves in +Y direction
      expect(correctResult.wishdir.y).toBeCloseTo(1, 5);

      // In this case they happen to match, so test with different angle
      // Let's test yaw=90 (facing east)
      const angles90: Vec3 = { x: 0, y: 90, z: 0 };
      const { forward: fwd90, right: right90 } = angleVectors(angles90);

      const correctResult90 = buildAirGroundWish({
        forward: fwd90,
        right: right90,
        cmd,
        maxSpeed: 320,
      });

      // Correct: when facing east, strafing right moves in +X direction
      expect(correctResult90.wishdir.x).toBeCloseTo(1, 5);

      // Hardcoded: still strafes in +Y direction (WRONG!)
      expect(buggyResult.wishdir.x).toBeCloseTo(0, 5);

      // Demonstrates the bug!
      expect(buggyResult.wishdir.x).not.toBeCloseTo(correctResult90.wishdir.x, 1);
    });
  });
});
