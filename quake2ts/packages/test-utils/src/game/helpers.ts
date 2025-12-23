import { vi, type Mock } from 'vitest';
import { Entity, SpawnRegistry, ScriptHookRegistry, type SpawnContext, type EntitySystem } from '@quake2ts/game';
import { createRandomGenerator, type Vec3 } from '@quake2ts/shared';
import { createTraceMock } from '../shared/collision.js';

// Re-export collision helpers from shared collision utility
export { intersects, stairTrace, ladderTrace, createTraceMock, createSurfaceMock } from '../shared/collision.js';

// -- Types --

export interface MockEngine {
  sound: Mock<[Entity, number, string, number, number, number], void>;
  soundIndex: Mock<[string], number>;
  modelIndex: Mock<[string], number>;
  centerprintf: Mock<[Entity, string], void>;
}

export interface MockGame {
  random: ReturnType<typeof createRandomGenerator>;
  registerEntitySpawn: Mock<[string, (entity: Entity) => void], void>;
  unregisterEntitySpawn: Mock<[string], void>;
  getCustomEntities: Mock<[], string[]>;
  hooks: ScriptHookRegistry;
  registerHooks: Mock<[any], any>;
  spawnWorld: Mock<[], void>;
  clientBegin: Mock<[any], void>;
  damage: Mock<[number], void>;
}

export interface TestContext extends SpawnContext {
  entities: EntitySystem;
  game: MockGame;
  engine: MockEngine;
}

// -- Factories --

export const createMockEngine = (): MockEngine => ({
  sound: vi.fn(),
  soundIndex: vi.fn((sound: string) => 0),
  modelIndex: vi.fn((model: string) => 0),
  centerprintf: vi.fn(),
});

export const createMockGame = (seed: number = 12345): { game: MockGame, spawnRegistry: SpawnRegistry } => {
  const spawnRegistry = new SpawnRegistry();
  const hooks = new ScriptHookRegistry();

  const game: MockGame = {
    random: createRandomGenerator({ seed }),
    registerEntitySpawn: vi.fn((classname: string, spawnFunc: (entity: Entity) => void) => {
      spawnRegistry.register(classname, (entity) => spawnFunc(entity));
    }),
    unregisterEntitySpawn: vi.fn((classname: string) => {
      spawnRegistry.unregister(classname);
    }),
    getCustomEntities: vi.fn(() => Array.from(spawnRegistry.keys())),
    hooks,
    registerHooks: vi.fn((newHooks) => hooks.register(newHooks)),
    spawnWorld: vi.fn(() => {
      hooks.onMapLoad('q2dm1');
    }),
    clientBegin: vi.fn((client) => {
      hooks.onPlayerSpawn({} as any);
    }),
    damage: vi.fn((amount: number) => {
      hooks.onDamage({} as any, null, null, amount, 0, 0);
    })
  };

  return { game, spawnRegistry };
};

export function createTestContext(options?: { seed?: number, initialEntities?: Entity[] }): TestContext {
  const engine = createMockEngine();
  const seed = options?.seed ?? 12345;
  const { game, spawnRegistry } = createMockGame(seed);

  const traceFn = vi.fn((start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) =>
    createTraceMock({
      endpos: end,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0 }
    })
  );

  const entityList: Entity[] = options?.initialEntities ? [...options.initialEntities] : [];

  // Create hooks helper that interacts with the entity list
  const hooks = game.hooks;

  const entities = {
    spawn: vi.fn(() => {
      const ent = new Entity(entityList.length + 1);
      ent.inUse = true;
      entityList.push(ent);
      hooks.onEntitySpawn(ent);
      return ent;
    }),
    free: vi.fn((ent: Entity) => {
      const idx = entityList.indexOf(ent);
      if (idx !== -1) {
        entityList.splice(idx, 1);
      }
      ent.inUse = false;
      hooks.onEntityRemove(ent);
    }),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn((ent: Entity) => {
      const idx = entityList.indexOf(ent);
      if (idx !== -1) {
        entityList.splice(idx, 1);
      }
      ent.inUse = false;
    }),
    setSpawnRegistry: vi.fn(),
    timeSeconds: 10,
    deltaSeconds: 0.1,
    modelIndex: vi.fn(() => 0),
    scheduleThink: vi.fn((entity: Entity, time: number) => {
      entity.nextthink = time;
    }),
    linkentity: vi.fn(),
    trace: traceFn,
    pointcontents: vi.fn(() => 0),
    multicast: vi.fn(),
    unicast: vi.fn(),
    engine,
    scriptHooks: hooks,
    game,
    sound: vi.fn((ent: Entity, chan: number, sound: string, vol: number, attn: number, timeofs: number) => {
      engine.sound(ent, chan, sound, vol, attn, timeofs);
    }),
    soundIndex: vi.fn((sound: string) => engine.soundIndex(sound)),
    useTargets: vi.fn((entity: Entity, activator: Entity | null) => {
    }),
    findByTargetName: vi.fn(() => []),
    pickTarget: vi.fn(() => null),
    killBox: vi.fn(),
    rng: createRandomGenerator({ seed }),
    imports: {
      configstring: vi.fn(),
      trace: traceFn,
      pointcontents: vi.fn(() => 0),
    },
    level: {
      intermission_angle: { x: 0, y: 0, z: 0 },
      intermission_origin: { x: 0, y: 0, z: 0 },
      next_auto_save: 0,
      health_bar_entities: null
    },
    targetNameIndex: new Map(),
    forEachEntity: vi.fn((callback: (ent: Entity) => void) => {
      entityList.forEach(callback);
    }),
    find: vi.fn((predicate: (ent: Entity) => boolean) => {
      return entityList.find(predicate);
    }),
    findByClassname: vi.fn((classname: string) => {
      return entityList.find(e => e.classname === classname);
    }),
    beginFrame: vi.fn((timeSeconds: number) => {
      (entities as any).timeSeconds = timeSeconds;
    }),
    targetAwareness: {
      timeSeconds: 10,
      frameNumber: 1,
      sightEntity: null,
      soundEntity: null,
    },
    warn: vi.fn(), // Added warn to entities as it is sometimes used there too, though typically on SpawnContext
    // Adding missing properties to satisfy EntitySystem interface partially or fully
    // We cast to unknown first anyway, but filling these in makes it safer for consumers
    skill: 1,
    deathmatch: false,
    coop: false,
    activeCount: entityList.length,
    world: entityList.find(e => e.classname === 'worldspawn') || new Entity(0),
    // ... other EntitySystem properties would go here
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    game,
    engine,
    health_multiplier: 1,
    warn: vi.fn(),
    free: vi.fn(),
    // Mock precache functions if they are part of SpawnContext in future or TestContext extensions
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  } as unknown as TestContext;
}

export function createSpawnTestContext(mapName?: string): TestContext {
  const ctx = createTestContext();
  // Simulate map load if needed
  if (mapName) {
    ctx.game.spawnWorld();
  }
  return ctx;
}

export function createCombatTestContext(): TestContext {
  return createTestContext();
}

export function createPhysicsTestContext(): TestContext {
  return createTestContext();
}

export function createEntity(): Entity {
  return new Entity(1);
}

/**
 * Creates mock imports and engine for use with createGame() from @quake2ts/game.
 * This is a convenience helper that provides all the commonly mocked functions
 * needed to instantiate a real Game instance in tests.
 *
 * @param overrides Optional overrides for specific mock functions
 * @returns An object containing both imports and engine mocks
 *
 * @example
 * ```typescript
 * import { createGame } from '@quake2ts/game';
 * import { createGameImportsAndEngine } from '@quake2ts/test-utils';
 *
 * const { imports, engine } = createGameImportsAndEngine();
 * const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
 * ```
 */
export function createGameImportsAndEngine(overrides?: {
  imports?: Partial<{
    trace: Mock;
    pointcontents: Mock;
    linkentity: Mock;
    multicast: Mock;
    unicast: Mock;
  }>;
  engine?: Partial<{
    trace: Mock;
    sound: Mock;
    centerprintf: Mock;
    modelIndex: Mock;
    soundIndex: Mock;
  }>;
}) {
  const defaultTrace = vi.fn().mockReturnValue({
    fraction: 1.0,
    endpos: { x: 0, y: 0, z: 0 },
    allsolid: false,
    startsolid: false,
  });

  const imports = {
    trace: defaultTrace,
    pointcontents: vi.fn().mockReturnValue(0),
    linkentity: vi.fn(),
    multicast: vi.fn(),
    unicast: vi.fn(),
    ...overrides?.imports,
  };

  const engine = {
    trace: vi.fn().mockReturnValue({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: 0 },
      allsolid: false,
      startsolid: false,
    }),
    sound: vi.fn(),
    centerprintf: vi.fn(),
    modelIndex: vi.fn().mockReturnValue(1),
    soundIndex: vi.fn().mockReturnValue(1),
    ...overrides?.engine,
  };

  return { imports, engine };
}
