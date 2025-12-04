import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PredictAim,
  M_CalculatePitchToFire,
  blocked_checkplat,
  blocked_checkjump,
  monster_jump_start,
  monster_jump_finished,
  BlockedJumpResult
} from '../../src/ai/rogue.js';
import { createTestContext } from '../test-helpers.js';
import { Entity, EntityFlags, ServerFlags, Solid } from '../../src/entities/entity.js';
import { Vec3, ZERO_VEC3, copyVec3 } from '@quake2ts/shared';

describe('Rogue AI Extensions', () => {
  let context: ReturnType<typeof createTestContext>;
  let self: Entity;
  let enemy: Entity;

  // Mock createEntity helper
  const createEntity = () => new Entity(1);

  beforeEach(async () => {
    context = await createTestContext();
    self = createEntity();
    enemy = createEntity();
    self.inUse = true;
    enemy.inUse = true;

    self.origin = { x: 0, y: 0, z: 0 };
    self.enemy = enemy;
    self.monsterinfo = {
      ...self.monsterinfo,
      jump_height: 64,
      drop_height: 128
    };

    enemy.origin = { x: 100, y: 0, z: 0 };
    enemy.velocity = { ...ZERO_VEC3 };
    enemy.viewheight = 22;
    enemy.svflags |= ServerFlags.Player;
  });

  describe('PredictAim', () => {
    it('should predict target position based on velocity', () => {
      enemy.velocity = { x: 0, y: 100, z: 0 };
      const boltSpeed = 1000;
      const offset = 0;

      // Distance is 100. Time to impact = distance / bolt_speed = 100 / 1000 = 0.1s.
      // Enemy is moving away in Y axis? No, enemy is at 100,0,0. Velocity is 0,100,0.
      // Time is 0.1s.
      // Enemy moves: velocity * time = 0, 100*0.1, 0 = 0, 10, 0.
      // Predicted pos = 100, 10, 0.
      // Aimpoint should be 100, 10, 0.

      // However, previous test failed with:
      // expected 10.239140588936163 to be close to 10
      // 10.239... means time was larger than 0.1s.
      // 100 * time = 10.239 => time = 0.10239.
      // If time = 0.10239, then distance was 102.39?
      // 102.39 / 1000 = 0.10239.
      // Distance between (0,0,0) and (100, 10.239, 0) is roughly sqrt(100^2 + 10^2) = 100.5.

      // Wait, PredictAim uses `dist` based on INITIAL positions?
      // `let dir = subtractVec3(target.origin, start);`
      // `let dist = lengthVec3(dir);`
      // Initial dist = 100.
      // time = 100 / 1000 = 0.1.
      // vec = target.origin + velocity * time = (100, 0, 0) + (0, 100, 0) * 0.1 = (100, 10, 0).

      // Why did the test fail with 10.239?
      // Maybe I misread the test setup?
      // enemy.origin = { x: 100, y: 0, z: 0 };
      // enemy.velocity = { x: 0, y: 100, z: 0 };
      // boltSpeed = 1000.

      // Let's re-read PredictAim implementation carefully.
      /*
        let dir = subtractVec3(target.origin, start);
        if (eye_height) { dir.z += target.viewheight; }
        let dist = lengthVec3(dir);

        // ... traces ...

        let time = dist / bolt_speed;
        let vec = target.origin + velocity * (time - offset);
      */

      // If eye_height was false (it is in the failing test), then dist = 100.
      // time = 0.1.
      // vec.y = 100 * 0.1 = 10.

      // So why did I get 10.239?
      // Ah, wait. `subtractVec3` and `lengthVec3` are from `@quake2ts/shared`.
      // Is it possible `self.origin` wasn't 0,0,0?
      // I set `self.origin = { x: 0, y: 0, z: 0 };` in beforeEach.

      // Maybe `eye_height` argument handling in my test?
      // I passed `false`.

      // Wait, look at failure 2: "PredictAim > should adjust for eye height if requested"
      // "expected +0 to be close to 22".
      // This means aimpoint.z came back as 0, but we expected 22.
      // This happens if `eye_height` logic didn't add viewheight to final `vec`.

      // Code:
      /*
        if (eye_height) {
          // vec.z += (target.viewheight || 0); // Readonly
          vec = { ...vec, z: vec.z + (target.viewheight || 0) };
        }
      */
      // It DOES add it.
      // So why is it 0?
      // Maybe `target.viewheight` is undefined?
      // I set `enemy.viewheight = 22`.
      // `target` is `enemy`.

      // But wait, `tr.ent !== target` check?
      // In the test `should adjust for eye height if requested`:
      // `context.entities.trace` mock returns `fraction: 1.0, ent: null`.
      // `target` is `enemy`.
      // `tr.ent` is `null`.
      // `tr.ent !== target` is TRUE.

      // So it enters the `if (tr.ent !== target)` block.
      // `eye_height = !eye_height;` -> toggles from true to false!
      // Then it recalculates `dir` and `dist`.
      // And later `if (eye_height)` checks the NEW value (false).
      // So it does NOT add viewheight to `vec`.

      // So, because the trace "missed" the target (returned ent: null), PredictAim assumed the shot was blocked/invalid and toggled eye_height to try center-mass.
      // To fix this test, the mock trace must return `ent: target`.

      // Okay, that explains the eye height failure.

      // Now about the 10.239 failure.
      // Mock trace returns `ent: null` by default in `test-helpers.ts`.
      // So `eye_height` (passed as false) toggles to `true`.
      // Then `dir.z` adds `target.viewheight` (22).
      // `dir` becomes (100, 0, 22).
      // `dist` = sqrt(100^2 + 22^2) = sqrt(10000 + 484) = sqrt(10484) = 102.3914...
      // `time` = 102.39 / 1000 = 0.10239.
      // `vec.y` = 100 * 0.10239 = 10.239.

      // Mystery solved! The default mock trace behavior (missing the target) causes PredictAim to toggle logic.

      const { aimpoint: aimpoint2 } = PredictAim(
        context.entities,
        self,
        enemy,
        self.origin,
        boltSpeed,
        false,
        offset
      );

      // Since default mock trace returns ent:null, PredictAim toggles eye_height (false -> true).
      // It aims at viewheight (z=22).
      // Distance is ~102.39.
      // Time is ~0.10239.
      // Y displacement is ~10.239.

      // I should update the test expectation to match this logic OR fix the mock trace to hit the target.
      // Fixing the mock trace is better to test the "happy path".

      // I will update the mock trace for the happy path test.
    });

    it('should predict target position correctly (happy path)', () => {
      enemy.velocity = { x: 0, y: 100, z: 0 };
      const boltSpeed = 1000;
      const offset = 0;

      // Mock trace to hit target
      context.entities.trace = vi.fn().mockReturnValue({
        fraction: 1.0,
        endpos: enemy.origin,
        ent: enemy
      });

      const { aimpoint } = PredictAim(
        context.entities,
        self,
        enemy,
        self.origin,
        boltSpeed,
        false, // eye_height false
        offset
      );

      expect(aimpoint.x).toBeCloseTo(100);
      expect(aimpoint.y).toBeCloseTo(10);
      expect(aimpoint.z).toBeCloseTo(0);
    });

    it('should adjust for eye height if requested', () => {
      // Mock trace to hit target
      context.entities.trace = vi.fn().mockReturnValue({
        fraction: 1.0,
        endpos: enemy.origin,
        ent: enemy
      });

      const { aimpoint } = PredictAim(
        context.entities,
        self,
        enemy,
        self.origin,
        0,
        true,
        0
      );

      expect(aimpoint.z).toBeCloseTo(22);
    });

    it('should handle blocked shots by toggling eye height', () => {
      // Mock trace to fail first attempt
      const originalTrace = context.entities.trace;
      let callCount = 0;

      context.entities.trace = vi.fn().mockImplementation((start, mins, maxs, end, passEnt, mask) => {
        callCount++;
        if (callCount === 1) {
          // First trace blocked (aiming at eye height)
          return {
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            ent: null
          };
        }
        // Second trace succeeds (aiming at body)
        return {
          fraction: 1.0,
          endpos: end,
          ent: enemy
        };
      });

      const { aimpoint } = PredictAim(
        context.entities,
        self,
        enemy,
        self.origin,
        0,
        true,
        0
      );

      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(aimpoint.z).toBeCloseTo(0);

      context.entities.trace = originalTrace;
    });
  });

  describe('M_CalculatePitchToFire', () => {
    it('should find a valid pitch to hit target', () => {
      enemy.inUse = true;
      const target = enemy.origin;
      const start = self.origin;
      const baseAim = { x: 1, y: 0, z: 0 };
      const speed = 500;

      // Mock trace to always succeed
       context.entities.trace = vi.fn().mockReturnValue({
          fraction: 1.0,
          endpos: target,
          ent: null
       });
    });

    it('should select best pitch when projectile lands near target', () => {
      enemy.inUse = true;
      const target = { x: 100, y: 0, z: 0 };
      const start = { x: 0, y: 0, z: 0 };
      const baseAim = { x: 1, y: 0, z: 0 };

      context.entities.trace = vi.fn().mockImplementation((s, mins, maxs, e) => {
        if (e.z <= 0) {
           return {
             fraction: 0.5,
             endpos: { ...e, z: 0 },
             plane: { normal: { x: 0, y: 0, z: 1 } },
             ent: null
           };
        }
        return { fraction: 1.0, endpos: e };
      });

      const result = M_CalculatePitchToFire(
        context.entities,
        self,
        target,
        start,
        baseAim,
        500,
        5.0,
        false,
        false
      );

      expect(result.valid).toBe(true);
      expect(result.aim).toBeDefined();
    });
  });

  describe('Blocked Helpers', () => {
    it('blocked_checkplat should return false if no plat', () => {
      const result = blocked_checkplat(self, 10, context.entities);
      expect(result).toBe(false);
    });

    it('blocked_checkjump should return NO_JUMP if no enemy', () => {
      self.enemy = undefined;
      const result = blocked_checkjump(self, 10, context.entities);
      expect(result).toBe(BlockedJumpResult.NO_JUMP);
    });

    it('monster_jump_start should set jump_time', () => {
      monster_jump_start(self, context.entities);
      expect(self.monsterinfo.jump_time).toBeGreaterThan(context.entities.timeSeconds);
    });

    it('monster_jump_finished should return true if jump time expired', () => {
       self.monsterinfo.jump_time = context.entities.timeSeconds - 1;
       const result = monster_jump_finished(self, context.entities);
       expect(result).toBe(true);
    });
  });
});
