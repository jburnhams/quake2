import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  spawnEntityFromDictionary,
  type SpawnOptions,
  type ParsedEntity,
  SpawnRegistry,
} from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import {
  Entity,
  SPAWNFLAG_NOT_EASY,
  SPAWNFLAG_NOT_MEDIUM,
  SPAWNFLAG_NOT_HARD,
  SPAWNFLAG_NOT_DEATHMATCH,
} from '../../../src/entities/entity.js';

describe('Spawn Filtering', () => {
  let mockEntities: any;
  let registry: SpawnRegistry;
  let options: SpawnOptions;

  beforeEach(() => {
    mockEntities = {
        spawn: vi.fn(() => ({
            inUse: true,
            classname: '',
            spawnflags: 0,
            mins: {x:0, y:0, z:0},
            maxs: {x:0, y:0, z:0},
            size: {x:0, y:0, z:0},
            angles: {x:0, y:0, z:0},
        })),
        freeImmediate: vi.fn((e: Entity) => {
            e.inUse = false;
        }),
        finalizeSpawn: vi.fn(),
        world: {},
        skill: 0,
        deathmatch: false,
    };

    registry = new SpawnRegistry();
    // Register a dummy spawn function
    registry.register('info_test', (entity) => {
        entity.classname = 'info_test';
    });

    options = {
        registry,
        entities: mockEntities,
    };
  });

  it('should filter out NOT_EASY when skill is 0', () => {
    mockEntities.skill = 0;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_EASY),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).toBeNull();
    expect(mockEntities.freeImmediate).toHaveBeenCalled();
  });

  it('should NOT filter out NOT_EASY when skill is 1', () => {
    mockEntities.skill = 1;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_EASY),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).not.toBeNull();
    expect(mockEntities.freeImmediate).not.toHaveBeenCalled();
  });

  it('should filter out NOT_MEDIUM when skill is 1', () => {
    mockEntities.skill = 1;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_MEDIUM),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).toBeNull();
    expect(mockEntities.freeImmediate).toHaveBeenCalled();
  });

  it('should NOT filter out NOT_MEDIUM when skill is 0', () => {
    mockEntities.skill = 0;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_MEDIUM),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).not.toBeNull();
    expect(mockEntities.freeImmediate).not.toHaveBeenCalled();
  });

  it('should filter out NOT_HARD when skill is 2', () => {
    mockEntities.skill = 2;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_HARD),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).toBeNull();
    expect(mockEntities.freeImmediate).toHaveBeenCalled();
  });

  it('should filter out NOT_HARD when skill is 3', () => {
    mockEntities.skill = 3;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_HARD),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).toBeNull();
    expect(mockEntities.freeImmediate).toHaveBeenCalled();
  });

  it('should NOT filter out NOT_HARD when skill is 1', () => {
    mockEntities.skill = 1;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_HARD),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).not.toBeNull();
    expect(mockEntities.freeImmediate).not.toHaveBeenCalled();
  });

  it('should filter out NOT_DEATHMATCH when deathmatch is true', () => {
    mockEntities.deathmatch = true;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_DEATHMATCH),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).toBeNull();
    expect(mockEntities.freeImmediate).toHaveBeenCalled();
  });

  it('should NOT filter out NOT_DEATHMATCH when deathmatch is false', () => {
    mockEntities.deathmatch = false;
    const dictionary: ParsedEntity = {
      classname: 'info_test',
      spawnflags: String(SPAWNFLAG_NOT_DEATHMATCH),
    };

    const entity = spawnEntityFromDictionary(dictionary, options);
    expect(entity).not.toBeNull();
    expect(mockEntities.freeImmediate).not.toHaveBeenCalled();
  });

  it('should handle multiple flags (e.g. NOT_EASY | NOT_HARD)', () => {
     // 0x100 | 0x400 = 256 + 1024 = 1280
     mockEntities.skill = 0; // Easy
     const dictionary: ParsedEntity = {
         classname: 'info_test',
         spawnflags: String(SPAWNFLAG_NOT_EASY | SPAWNFLAG_NOT_HARD),
     };

     const entity = spawnEntityFromDictionary(dictionary, options);
     expect(entity).toBeNull();
  });
});
