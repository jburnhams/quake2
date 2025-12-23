import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SpawnRegistry,
  spawnEntityFromDictionary,
  type SpawnOptions,
} from '../../src/entities/spawn.js';
import {
  EntitySystem,
} from '../../src/entities/system.js';
import {
  Entity,
  SPAWNFLAG_NOT_EASY,
  SPAWNFLAG_NOT_MEDIUM,
  SPAWNFLAG_NOT_HARD,
  SPAWNFLAG_NOT_DEATHMATCH,
} from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Entity Spawn Filtering', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;
  let sys: EntitySystem;

  beforeEach(() => {
    // We will recreate the system for each test to vary skill/deathmatch
    registry = new SpawnRegistry();
    // Register a dummy spawn function
    registry.register('info_null', (entity, ctx) => {
        // do nothing
    });
  });

  const createOptions = (skill: number, deathmatch: boolean): SpawnOptions => {
      // Mock engine and imports using helper
      const { engine } = createGameImportsAndEngine();
      // Create system manually to pass skill/deathmatch
      sys = new EntitySystem(engine as any, undefined, undefined, undefined, undefined, deathmatch, skill);
      sys.setSpawnRegistry(registry);

      return {
          registry,
          entities: sys,
          onWarning: () => {}
      };
  };

  it('should filter NOT_EASY entities when skill is 0', () => {
    const options = createOptions(0, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_EASY)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).toBeNull();
  });

  it('should NOT filter NOT_EASY entities when skill is 1', () => {
    const options = createOptions(1, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_EASY)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).not.toBeNull();
    expect(entity?.inUse).toBe(true);
  });

  it('should filter NOT_MEDIUM entities when skill is 1', () => {
    const options = createOptions(1, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_MEDIUM)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).toBeNull();
  });

  it('should NOT filter NOT_MEDIUM entities when skill is 0', () => {
    const options = createOptions(0, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_MEDIUM)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).not.toBeNull();
  });

  it('should filter NOT_HARD entities when skill is 2', () => {
    const options = createOptions(2, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_HARD)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).toBeNull();
  });

  it('should filter NOT_HARD entities when skill is 3 (Nightmare)', () => {
    const options = createOptions(3, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_HARD)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).toBeNull();
  });

  it('should NOT filter NOT_HARD entities when skill is 1', () => {
    const options = createOptions(1, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_HARD)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).not.toBeNull();
  });

  it('should filter NOT_DEATHMATCH entities when deathmatch is true', () => {
    const options = createOptions(1, true);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_DEATHMATCH)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).toBeNull();
  });

  it('should NOT filter NOT_DEATHMATCH entities when deathmatch is false', () => {
    const options = createOptions(1, false);
    const dict = {
        classname: 'info_null',
        spawnflags: String(SPAWNFLAG_NOT_DEATHMATCH)
    };

    const entity = spawnEntityFromDictionary(dict, options);
    expect(entity).not.toBeNull();
  });

  it('should handle combined flags correctly', () => {
      // Not Easy AND Not Deathmatch
      // If skill is Easy (0) and not deathmatch -> Filtered
      let options = createOptions(0, false);
      let dict = {
          classname: 'info_null',
          spawnflags: String(SPAWNFLAG_NOT_EASY | SPAWNFLAG_NOT_DEATHMATCH)
      };
      expect(spawnEntityFromDictionary(dict, options)).toBeNull();

      // If skill is Medium (1) and not deathmatch -> Not filtered
      options = createOptions(1, false);
      expect(spawnEntityFromDictionary(dict, options)).not.toBeNull();

      // If skill is Medium (1) and deathmatch -> Filtered by deathmatch
      options = createOptions(1, true);
      expect(spawnEntityFromDictionary(dict, options)).toBeNull();
  });
});
