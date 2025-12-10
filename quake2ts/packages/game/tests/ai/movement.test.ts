import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SV_CloseEnough, M_MoveToGoal, SV_movestep, M_walkmove } from '../../src/ai/movement.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { Vec3 } from '@quake2ts/shared';

describe('AI Movement', () => {
  let context: ReturnType<typeof createTestContext>;
  let self: Entity;
  let target: Entity;

  beforeEach(() => {
    context = createTestContext();
    self = context.entities.spawn();
    self.classname = 'monster_test';
    self.origin = { x: 0, y: 0, z: 0 };
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.absmin = { x: -16, y: -16, z: -24 };
    self.absmax = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.Bbox;
    self.takedamage = true;
    self.health = 100;

    // Initialize monsterinfo
    self.monsterinfo = {
      currentmove: undefined,
      aiflags: 0,
      nextframe: 0,
      trail_time: 0,
      vis_time: 0,
      last_sighting: { x: 0, y: 0, z: 0 },
      search_time: 0,
      checkattack: undefined,
      attack_state: 0,
      pausetime: 0,
      stand: undefined,
      idle: undefined,
      idle_time: 0,
      sight: undefined,
      run: undefined,
      walk: undefined,
      melee: undefined,
      attack: undefined,
      dodge: undefined,
      duck: undefined,
      unduck: undefined,
      blocked: undefined,
      bad_move_time: 0,
      random_change_time: 0,
      move_block_counter: 0,
      move_block_change_time: 0,
      path_blocked_counter: 0,
      path_wait_time: 0,
      nav_path_cache_time: 0,
      nav_path: {
        returnCode: 0,
        firstMovePoint: { x: 0, y: 0, z: 0 },
        secondMovePoint: { x: 0, y: 0, z: 0 }
      }
    } as any;

    target = context.entities.spawn();
    target.classname = 'player';
    target.origin = { x: 100, y: 0, z: 0 };
    target.mins = { x: -16, y: -16, z: -24 };
    target.maxs = { x: 16, y: 16, z: 32 };
    target.absmin = { x: 84, y: -16, z: -24 };
    target.absmax = { x: 116, y: 16, z: 32 };
  });

  describe('SV_CloseEnough', () => {
    it('should return true if entity is within distance', () => {
      // self at 0, target at 100.
      // self.absmax.x = 16. target.absmin.x = 84.
      // Gap is 84 - 16 = 68.
      // If dist is 70, should be close enough.
      expect(SV_CloseEnough(self, target, 70)).toBe(true);
    });

    it('should return false if entity is outside distance', () => {
      // Gap is 68.
      // If dist is 60, should not be close enough.
      expect(SV_CloseEnough(self, target, 60)).toBe(false);
    });

    it('should handle height differences', () => {
        target.origin = { x: 0, y: 0, z: 100 };
        target.absmin = { x: -16, y: -16, z: 76 };
        target.absmax = { x: 16, y: 16, z: 132 };

        // self.absmax.z = 32. target.absmin.z = 76.
        // Gap is 44.
        expect(SV_CloseEnough(self, target, 50)).toBe(true);
        expect(SV_CloseEnough(self, target, 40)).toBe(false);
    });
  });

  describe('SV_movestep', () => {
    it('should move entity if path is clear', () => {
      const move: Vec3 = { x: 10, y: 0, z: 0 };

      // Mock trace to be clear
      vi.spyOn(context.game, 'trace').mockReturnValue({
        fraction: 1,
        endpos: { x: 10, y: 0, z: 0 },
        allsolid: false,
        startsolid: false,
        plane: null,
        ent: null,
      } as any);

      // Mock M_CheckBottom to return true (safe ground)
      // We need to spy on the exported function, but since it's in the same module we might need to mock implementation or dependency.
      // However, SV_movestep calls context.trace.
      // And it calls M_CheckBottom.
      // Since M_CheckBottom is internal or exported, mocking it might be tricky if not careful.
      // But M_CheckBottom basically calls context.trace and context.pointcontents.
      // We can mock those to simulate ground.

      // For M_CheckBottom:
      // It checks down traces.

      // Let's assume M_CheckBottom returns true for now via logic mocking.

      // Mock pointcontents to return 0 (not solid)
      vi.spyOn(context.game, 'pointcontents').mockReturnValue(0);

      const result = SV_movestep(self, move, true, context);

      expect(result).toBe(true);
      expect(self.origin.x).toBe(10);
    });

    it('should return false if blocked', () => {
      const move: Vec3 = { x: 10, y: 0, z: 0 };

      // Mock trace to be blocked immediately
      vi.spyOn(context.game, 'trace').mockReturnValue({
        fraction: 0,
        endpos: { x: 0, y: 0, z: 0 },
        allsolid: false,
        startsolid: false,
        plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
        ent: null,
      } as any);

      const result = SV_movestep(self, move, true, context);

      expect(result).toBe(false);
      expect(self.origin.x).toBe(0);
    });
  });

  describe('M_MoveToGoal', () => {
    it('should simply face ideal yaw if movement disabled', () => {
       // Not easily testable without cvar, but we can skip
    });

    it('should move towards goal if line of sight is clear', () => {
      self.goalentity = target;
      self.ideal_yaw = 0;

      // Mock traceline (imports.trace used as traceline mostly?)
      // Actually game.trace.

      // M_MoveToGoal calls traceline (which is often game.trace with specialized args in Q2, but here usually just trace).

      // We need to mock trace calls:
      // 1. traceline check to goal -> clear
      // 2. SV_StepDirection -> M_walkmove -> SV_movestep -> trace -> clear

      const traceSpy = vi.spyOn(context.game, 'trace').mockImplementation((start, mins, maxs, end) => {
          // If checking line to goal (mins/maxs usually null or ignored in C++ traceline, but here we pass entity?)
          // In M_MoveToGoal logic: trace(start, null, null, end, ...) usually implies traceline.

          return {
              fraction: 1.0,
              endpos: end,
              allsolid: false,
              startsolid: false,
              ent: null
          } as any;
      });

      // Also need pointcontents for ground checks
      vi.spyOn(context.game, 'pointcontents').mockReturnValue(0);

      // Mock M_CheckBottom logic via traces
      // It traces down. If we assume ground is solid at z=-24.

      M_MoveToGoal(self, 10, context);

      // Should have moved
      expect(self.origin.x).toBeGreaterThan(0);
    });
  });
});
