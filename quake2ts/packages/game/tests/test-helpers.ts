import { vi } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import type { SpawnContext } from '../src/entities/spawn.js';
import type { EntitySystem } from '../src/entities/system.js';
import { createRandomGenerator } from '@quake2ts/shared';

export function createTestContext(options?: { seed?: number }): { entities: EntitySystem, game: any } & SpawnContext {
  const engine = {
    sound: vi.fn(),
    soundIndex: vi.fn(() => 0),
    modelIndex: vi.fn(() => 0),
    centerprintf: vi.fn(),
  };

  const seed = options?.seed ?? 12345;

  const entities = {
    spawn: vi.fn(() => new Entity(1)),
    free: vi.fn(),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn(),
    setSpawnRegistry: vi.fn(),
    timeSeconds: 10,
    modelIndex: vi.fn(() => 0),
    scheduleThink: vi.fn((entity: Entity, time: number) => {
      entity.nextthink = time;
    }),
    linkentity: vi.fn(),
    trace: vi.fn(() => ({
        fraction: 1.0,
        ent: null,
        allsolid: false,
        startsolid: false,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
    })),
    pointcontents: vi.fn(() => 0),
    multicast: vi.fn(),
    unicast: vi.fn(),
    engine, // Attach mocked engine
    game: { // Mock game object for random access
      random: createRandomGenerator({ seed })
    },
    sound: vi.fn((ent: Entity, chan: number, sound: string, vol: number, attn: number, timeofs: number) => {
      engine.sound(ent, chan, sound, vol, attn, timeofs);
    }),
    soundIndex: vi.fn((sound: string) => engine.soundIndex(sound)),
    useTargets: vi.fn((entity: Entity, activator: Entity | null) => {
    }),
    findByTargetName: vi.fn(() => []),
    pickTarget: vi.fn(() => null),
    killBox: vi.fn(),
    rng: createRandomGenerator({ seed }), // Use real RNG for determinism or easy mocking if we replace it
    imports: {
        configstring: vi.fn(),
    },
    level: {
        intermission_angle: { x: 0, y: 0, z: 0 },
        intermission_origin: { x: 0, y: 0, z: 0 },
    },
    targetNameIndex: new Map(),
    forEachEntity: vi.fn((callback) => {
        // Implement simple iteration over a few mocked entities if needed,
        // or just rely on the fact that G_PickTarget iterates.
        // For testing G_PickTarget, we can look at the targetNameIndex we just added
        for (const bucket of (entities as any).targetNameIndex.values()) {
            for (const ent of bucket) {
                callback(ent);
            }
        }
    }),
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    game: (entities as any).game,
    health_multiplier: 1,
    warn: vi.fn(),
    free: vi.fn(),
    // Legacy support for tests that might check precache
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  } as unknown as SpawnContext & { entities: EntitySystem, game: any };
}

export function createSpawnContext(): SpawnContext {
    return createTestContext();
}

export function createEntity(): Entity {
    return new Entity(1);
}
