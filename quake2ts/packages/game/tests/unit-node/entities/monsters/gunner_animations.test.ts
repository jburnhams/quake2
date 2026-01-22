import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_gunner } from '../../../../src/entities/monsters/gunner.js';
import { Entity, DeadFlag, Solid } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('monster_gunner', () => {
  let context: any;
  let gunner: Entity;
  let spawnContext: any;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;
    spawnContext = { entities: context, health_multiplier: 1 } as any;

    gunner = {
      index: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      classname: 'monster_gunner',
      health: 175,
      max_health: 175,
      monsterinfo: {
        current_move: null,
      },
      enemy: null,
    } as any;
  });

  it('should have all animation moves defined', () => {
      SP_monster_gunner(gunner, spawnContext);

      // Stand
      gunner.monsterinfo.stand!(gunner);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(0);

      // Walk
      gunner.monsterinfo.walk!(gunner);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(76);

      // Run
      gunner.monsterinfo.run!(gunner);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(94);
  });

  it('should transition to grenade attack', () => {
      SP_monster_gunner(gunner, spawnContext);

      // Force RNG to choose grenade (<= 0.5)
      context.rng.frandom = vi.fn().mockReturnValue(0.4);

      gunner.monsterinfo.attack!(gunner, context);
      // attack_grenade_move firstframe 108
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(108);
  });

  it('should transition to chain attack', () => {
      SP_monster_gunner(gunner, spawnContext);
      // Force RNG to choose chain (> 0.5)
      context.rng.frandom = vi.fn().mockReturnValue(0.6);

      gunner.monsterinfo.attack!(gunner, context);
      // attack_chain_move firstframe 137
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(137);
  });

  it('should transition to pain animations', () => {
      SP_monster_gunner(gunner, spawnContext);

      // Use mock implementation to control sequence easily
      const mockFrandom = vi.fn();
      context.rng.frandom = mockFrandom;

      // Pain 3 (< 0.33)
      // Call 1: Sound -> 0.1
      // Call 2: Move -> 0.1
      mockFrandom.mockReturnValue(0.1);

      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(185);

      // Pain 2 (< 0.66)
      // Call 1: Sound -> 0.6 (else)
      // Call 2: Move -> 0.5 (< 0.66)
      mockFrandom.mockReset(); // Clear previous
      mockFrandom.mockReturnValueOnce(0.6).mockReturnValueOnce(0.5);

      gunner.pain_debounce_time = 0; // Reset debounce
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(177);

      // Pain 1 (else)
      // Call 1: Sound -> 0.8
      // Call 2: Move -> 0.8
      mockFrandom.mockReset();
      mockFrandom.mockReturnValue(0.8);

      gunner.pain_debounce_time = 0;
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(159);
  });

  it('should transition to duck', () => {
      SP_monster_gunner(gunner, spawnContext);

      // Trigger dodge which triggers duck
      // dodge also has random check (> 0.25 returns?)
      // We want to force it to pass.
      context.rng.frandom = vi.fn().mockReturnValue(0.1);

      gunner.monsterinfo.dodge!(gunner, gunner, 0); // self, attacker, eta

      // duck_move firstframe 201
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(201);
  });
});
