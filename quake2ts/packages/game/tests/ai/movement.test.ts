import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai_stand, ai_walk, ai_run, ai_charge } from '../../src/ai/movement.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { AIFlags } from '../../src/ai/constants.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import * as targeting from '../../src/ai/targeting.js';
import * as perception from '../../src/ai/perception.js';

describe('AI Movement', () => {
  let testContext: ReturnType<typeof createTestContext>;
  let sys: EntitySystem;
  let self: Entity;
  let enemy: Entity;

  beforeEach(() => {
    testContext = createTestContext();
    sys = testContext.entities;
    // Set deltaSeconds
    Object.defineProperty(sys, 'deltaSeconds', {
        value: 0.1,
        writable: true
    });

    // Setup self (monster)
    self = sys.spawn();
    Object.assign(self, createMonsterEntityFactory('monster_test', {
        origin: { x: 0, y: 0, z: 0 },
        angles: { x: 0, y: 0, z: 0 },
        movetype: MoveType.Step,
        solid: Solid.Bbox,
        flags: EntityFlags.Fly, // Allow movement without ground check for simplicity
        ideal_yaw: 0,
        yaw_speed: 200, // Fast enough to turn in one frame
        monsterinfo: {
          stand: vi.fn(),
          run: vi.fn(),
          sight: vi.fn(),
          aiflags: 0
        } as any
    }));

    // Setup enemy
    enemy = sys.spawn();
    Object.assign(enemy, createPlayerEntityFactory({
        origin: { x: 200, y: 0, z: 0 },
        classname: 'player'
    }));
    enemy.inUse = true;

    // Mock external dependencies
    vi.spyOn(targeting, 'findTarget').mockReturnValue(false);
    vi.spyOn(targeting, 'ai_checkattack').mockReturnValue(false);
    vi.spyOn(perception, 'visible').mockReturnValue(true);

    // Ensure trace returns success for movement
    (sys.trace as any).mockImplementation(() => ({
        fraction: 1.0,
        ent: null,
        allsolid: false,
        startsolid: false,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
    }));
  });

  describe('ai_stand', () => {
    it('should change yaw', () => {
      self.ideal_yaw = 90;
      self.angles.y = 0;
      ai_stand(self, 0, sys);

      // Should have turned
      expect(self.angles.y).toBeGreaterThan(0);
    });

    it('should check for targets if no enemy', () => {
      self.enemy = null;
      ai_stand(self, 0, sys);
      expect(targeting.findTarget).toHaveBeenCalled();
    });

    it('should behave as ai_run (turn towards enemy) if StandGround flag is set and has enemy', () => {
      self.monsterinfo.aiflags |= AIFlags.StandGround;
      self.enemy = enemy;
      self.angles.y = 180;
      self.ideal_yaw = 0; // Enemy is at 0 (200, 0, 0)

      ai_stand(self, 10, sys);

      // Should be turning towards 0
      expect(self.angles.y).not.toBe(180);
    });
  });

  describe('ai_walk', () => {
    it('should move towards goal (call M_MoveToGoal)', () => {
       self.goalentity = enemy;
       self.ideal_yaw = 0;

       const oldX = self.origin.x;
       ai_walk(self, 10, sys);

       // Should move in X direction (yaw 0)
       expect(self.origin.x).toBeGreaterThan(oldX);
    });

    it('should check for targets', () => {
      ai_walk(self, 10, sys);
      expect(targeting.findTarget).toHaveBeenCalled();
    });
  });

  describe('ai_run', () => {
    it('should call stand if StandGround flag is set', () => {
        self.monsterinfo.aiflags |= AIFlags.StandGround;

        ai_run(self, 10, sys);

        expect(self.monsterinfo.stand).toHaveBeenCalled();
    });

    it('should check attack if enemy exists', () => {
        self.enemy = enemy;
        enemy.inUse = true;

        ai_run(self, 10, sys);

        expect(targeting.ai_checkattack).toHaveBeenCalled();
    });

    it('should move towards enemy if not attacking', () => {
        self.enemy = enemy;

        const oldX = self.origin.x;
        ai_run(self, 10, sys);

        // Should move
        expect(self.origin.x).toBeGreaterThan(oldX);
    });

    it('should perform aggressive pursuit (turn)', () => {
        self.enemy = enemy;
        enemy.origin = {x: 0, y: 1000, z: 0}; // 90 degrees
        self.angles.y = 0;

        ai_run(self, 10, sys);

        // Should turn towards 90
        expect(self.angles.y).toBeGreaterThan(0);
    });
  });

  describe('ai_charge', () => {
    it('should change yaw and move', () => {
        self.enemy = enemy;
        enemy.origin = {x: 200, y: 0, z: 0}; // Ahead
        self.angles.y = 0;

        const oldX = self.origin.x;
        ai_charge(self, 10, sys);

        expect(self.origin.x).toBeGreaterThan(oldX);
    });

    it('should check attack', () => {
       self.enemy = enemy;
       vi.spyOn(targeting, 'ai_checkattack').mockReturnValue(true);

       const oldX = self.origin.x;
       ai_charge(self, 10, sys);

       expect(self.origin.x).toBe(oldX);
    });
  });
});
