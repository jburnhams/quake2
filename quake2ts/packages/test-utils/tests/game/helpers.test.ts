import { describe, it, expect, vi } from 'vitest';
import {
  createTestContext,
  createSpawnTestContext,
  createCombatTestContext,
  createPhysicsTestContext
} from '../../src/game/helpers.js';
import { Entity } from '@quake2ts/game';

describe('Game Context Helpers', () => {
  describe('createTestContext', () => {
    it('should create a context with entities and game mocks', () => {
      const context = createTestContext();
      expect(context.entities).toBeDefined();
      expect(context.game).toBeDefined();
      expect(context.engine).toBeDefined();
    });

    it('should allow initial entities', () => {
      const initialEnts = [new Entity(1), new Entity(2)];
      const context = createTestContext({ initialEntities: initialEnts });
      let count = 0;
      context.entities.forEachEntity(() => count++);
      expect(count).toBe(2);
    });
  });

  describe('createSpawnTestContext', () => {
    it('should create a spawn context', () => {
      const context = createSpawnTestContext('map1');
      expect(context).toBeDefined();
      // Verify map name somehow?
      // Currently our mock game just hardcodes 'q2dm1' in spawnWorld,
      // but in future we might check this.
    });
  });

  describe('createCombatTestContext', () => {
    it('should create a combat context', () => {
      const context = createCombatTestContext();
      expect(context).toBeDefined();
    });
  });

  describe('createPhysicsTestContext', () => {
    it('should create a physics context', () => {
      const context = createPhysicsTestContext();
      expect(context).toBeDefined();
    });
  });
});
