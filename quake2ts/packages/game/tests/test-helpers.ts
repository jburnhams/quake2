import { vi } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import type { SpawnContext } from '../src/entities/spawn.js';
import type { EntitySystem } from '../src/entities/system.js';

export function createTestContext(): SpawnContext {
  const engine = {
    sound: vi.fn(),
    modelIndex: vi.fn(() => 0),
    centerprintf: vi.fn(),
  };

  const entities = {
    spawn: () => new Entity(1),
    free: vi.fn(),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn(),
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
    sound: vi.fn((ent: Entity, chan: number, sound: string, vol: number, attn: number, timeofs: number) => {
      engine.sound(ent, chan, sound, vol, attn, timeofs);
    }),
    useTargets: vi.fn((entity: Entity, activator: Entity | null) => {
    }),
    findByTargetName: vi.fn(() => []),
    pickTarget: vi.fn(() => null)
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    warn: vi.fn(),
    free: vi.fn(),
    // Legacy support for tests that might check precache
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  } as unknown as SpawnContext;
}

export function createSpawnContext(): SpawnContext {
    return createTestContext();
}

export function createEntity(): Entity {
    return new Entity(1);
}
