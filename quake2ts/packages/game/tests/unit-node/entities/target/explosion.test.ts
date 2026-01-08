import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { ServerCommand, TempEntity, ZERO_VEC3 } from '@quake2ts/shared';
import { MulticastType } from '../../../src/imports.js';
import { Entity } from '../../../src/entities/entity.js';

describe('target_explosion and target_splash', () => {
  let entities: EntitySystem;
  let registry: any;
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = {
        soundIndex: vi.fn(),
        modelIndex: vi.fn(),
        multicast: vi.fn(),
        trace: vi.fn().mockReturnValue({ allsolid: false, startsolid: false, fraction: 1.0, endpos: ZERO_VEC3 }),
        linkentity: vi.fn(),
    };
    entities = new EntitySystem(
        mockEngine as any, // engine
        mockEngine as any, // imports
        undefined,
        2048
    );
    registry = createDefaultSpawnRegistry();
    entities.setSpawnRegistry(registry);
  });

  describe('target_explosion', () => {
    it('should trigger explosion effect when used', () => {
      const target = spawnEntityFromDictionary({
          classname: 'target_explosion',
          origin: '10 20 30'
      }, { registry, entities });

      if (target?.use) {
          target.use(target, null, null, entities);
      }

      expect(mockEngine.multicast).toHaveBeenCalledWith(
          target?.origin,
          MulticastType.Phs,
          ServerCommand.temp_entity,
          TempEntity.EXPLOSION1,
          target?.origin
      );
    });
  });

  describe('target_splash', () => {
    it('should trigger splash effect when used', () => {
      const target = spawnEntityFromDictionary({
          classname: 'target_splash',
          origin: '10 20 30',
          count: '5',
          sounds: '2', // color
          angles: '0 90 0' // movedir
      }, { registry, entities });

      expect(target?.count).toBe(5);
      expect(target?.sounds).toBe(2);

      if (target?.use) {
          target.use(target, null, null, entities);
      }

      expect(mockEngine.multicast).toHaveBeenCalledWith(
          target?.origin,
          MulticastType.Pvs,
          ServerCommand.temp_entity,
          TempEntity.SPLASH,
          5, // count
          target?.origin,
          target?.movedir,
          2 // sounds (color)
      );
    });
  });
});
