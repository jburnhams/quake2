import { vi } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import type { SpawnContext } from '../src/entities/spawn.js';
import type { EntitySystem } from '../src/entities/system.js';

export function createTestContext(): SpawnContext {
  const engine = {
    sound: vi.fn(),
    modelIndex: vi.fn(() => 0),
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
    sound: (ent: Entity, chan: number, sound: string, vol: number, attn: number, timeofs: number) => {
      engine.sound(ent, chan, sound, vol, attn, timeofs);
    }
    useTargets: vi.fn((entity: Entity, activator: Entity | null) => {
      // Basic mock implementation of useTargets to facilitate testing
      if (entity.target) {
        // In a real system we would look up by targetname.
        // Here we rely on the test setting up the connection manually if needed?
        // But wait, the test registers the target entity but the mock system doesn't store them in a map.
        // So we can't really look them up.
        // Unless we mock findByTargetName too.
      }
    }),
    findByTargetName: vi.fn(() => []),
    pickTarget: vi.fn(() => null),
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    warn: vi.fn(),
    free: vi.fn(),
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  };
}
