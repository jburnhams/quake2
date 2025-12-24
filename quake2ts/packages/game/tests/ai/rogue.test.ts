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
import { createTestContext } from '@quake2ts/test-utils';
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
    it('should select best pitch when projectile lands near target', () => {
      enemy.inUse = true;
      const target = { x: 100, y: 0, z: 0 };
      const start = { x: 0, y: 0, z: 0 };
      const speed = 500;

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
        speed,
        5.0,
        false,
        false
      );

      expect(result).not.toBeNull();
      expect(result!.aimDir).toBeDefined();
    });
  });

  describe('Blocked Helpers', () => {
    it('blocked_checkplat should return false if no plat', () => {
      const result = blocked_checkplat(context.entities, self, 10);
      expect(result).toBe(false);
    });

    it('blocked_checkjump should return NO_JUMP if no enemy', () => {
      self.enemy = null;
      const result = blocked_checkjump(context.entities, self, 10);
      expect(result).toBe(BlockedJumpResult.NO_JUMP);
    });

    it('monster_jump_start should set jump_time', () => {
      monster_jump_start(context.entities, self);
      expect(self.monsterinfo.jump_time).toBeGreaterThan(context.entities.timeSeconds);
    });

    it('monster_jump_finished should return true if jump time expired', () => {
       self.monsterinfo.jump_time = context.entities.timeSeconds - 1;
       const result = monster_jump_finished(context.entities, self);
       expect(result).toBe(true);
    });
  });
});
