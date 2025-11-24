import { vi } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import type { SpawnContext } from '../src/entities/spawn.js';
import type { EntitySystem } from '../src/entities/system.js';

export function createTestContext(): SpawnContext {
  const entities = {
    spawn: () => new Entity(1),
    free: vi.fn(),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn(),
    timeSeconds: 10,
    modelIndex: vi.fn(() => 0),
    scheduleThink: vi.fn(),
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
