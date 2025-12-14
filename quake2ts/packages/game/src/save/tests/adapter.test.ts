import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSerializedGameState, applySerializedGameState, AdapterContext } from '../adapter.js';
import { EntitySystem, EntitySystemSnapshot } from '../../entities/system.js';
import { LevelClock } from '../../level.js';
import { Entity } from '../../entities/entity.js';
import { createPlayerInventory, WeaponId } from '../../inventory/index.js';
import { RandomGenerator } from '@quake2ts/shared';

describe('Save Adapter', () => {
  let mockEntitySystem: any;
  let mockLevelClock: any;
  let mockRandom: any;
  let mockPlayer: Entity;

  beforeEach(() => {
    mockPlayer = new Entity(1);
    mockPlayer.classname = 'player';
    mockPlayer.origin = { x: 100, y: 200, z: 300 };
    mockPlayer.angles = { x: 0, y: 90, z: 0 };
    mockPlayer.velocity = { x: 10, y: 0, z: 0 };
    mockPlayer.client = {
      inventory: createPlayerInventory(),
      damage_alpha: 0,
      damage_blend: [0, 0, 0],
      kick_angles: { x: 0, y: 0, z: 0 },
      kick_origin: { x: 0, y: 0, z: 0 },
      pm_type: 0,
      pm_time: 0,
      pm_flags: 0,
      gun_frame: 0,
      rdflags: 0,
      fov: 90,
      // ... partial mock
    } as any;

    const snapshot: EntitySystemSnapshot = {
      timeSeconds: 10,
      pool: {
        capacity: 100,
        activeOrder: [1],
        freeList: [],
        pendingFree: []
      },
      entities: [
        {
          index: 1,
          fields: {
             classname: 'player',
             origin: [100, 200, 300]
          }
        }
      ],
      thinks: [],
      awareness: {
        frameNumber: 100,
        sightEntityIndex: null,
        sightEntityFrame: 0,
        soundEntityIndex: null,
        soundEntityFrame: 0,
        sound2EntityIndex: null,
        sound2EntityFrame: 0,
        sightClientIndex: null,
      },
      crossLevelFlags: 0,
      crossUnitFlags: 0,
      level: {
        next_auto_save: 0,
        health_bar_entities: [null, null, null, null],
        intermission_angle: { x: 0, y: 0, z: 0 },
        intermission_origin: { x: 0, y: 0, z: 0 },
        helpmessage1: '',
        helpmessage2: '',
        help1changed: 0,
        help2changed: 0,
        mapname: 'test_map'
      }
    };

    mockEntitySystem = {
      find: vi.fn().mockReturnValue(mockPlayer),
      createSnapshot: vi.fn().mockReturnValue(snapshot),
      restore: vi.fn(),
      level: {
        mapname: 'test_map'
      }
    };

    mockLevelClock = {
      current: {
        timeSeconds: 10,
        frameNumber: 100,
        previousTimeSeconds: 9.9,
        deltaSeconds: 0.1
      },
      restore: vi.fn()
    };

    mockRandom = {
      getState: vi.fn().mockReturnValue({ mt: { index: 0, state: [] } }),
      setState: vi.fn()
    };
  });

  it('createSerializedGameState constructs correct state', () => {
    const context: AdapterContext = {
      entitySystem: mockEntitySystem,
      levelClock: mockLevelClock,
      random: mockRandom
    };

    const serialized = createSerializedGameState(context);

    expect(serialized.mapName).toBe('test_map');
    expect(serialized.time).toBe(10);
    expect(serialized.playerState.origin).toEqual({ x: 100, y: 200, z: 300 });
    expect(serialized.entities.length).toBe(1);
    expect(serialized.playerInventory).toBeDefined();
    expect(serialized._internalSnapshot).toBeDefined();
    expect(mockEntitySystem.createSnapshot).toHaveBeenCalled();
  });

  it('applySerializedGameState restores state', () => {
    const serialized = createSerializedGameState({
      entitySystem: mockEntitySystem,
      levelClock: mockLevelClock,
      random: mockRandom
    });

    // Modify serialized to test restore
    serialized.time = 20;

    applySerializedGameState(serialized, {
      entitySystem: mockEntitySystem,
      levelClock: mockLevelClock,
      random: mockRandom
    });

    expect(mockLevelClock.restore).toHaveBeenCalledWith(expect.objectContaining({
      timeSeconds: 20
    }));
    expect(mockEntitySystem.restore).toHaveBeenCalledWith(serialized._internalSnapshot);
    expect(mockRandom.setState).toHaveBeenCalled();
  });

  it('applySerializedGameState handles missing internal snapshot (legacy/partial)', () => {
    const serialized = createSerializedGameState({
      entitySystem: mockEntitySystem,
      levelClock: mockLevelClock,
      random: mockRandom
    });

    // Remove internal snapshot
    delete serialized._internalSnapshot;

    applySerializedGameState(serialized, {
      entitySystem: mockEntitySystem,
      levelClock: mockLevelClock,
      random: mockRandom
    });

    expect(mockEntitySystem.restore).toHaveBeenCalledWith(expect.objectContaining({
      entities: serialized.entities,
      timeSeconds: serialized.time
    }));
    // Should warn in console, but we're not checking that here
  });
});
