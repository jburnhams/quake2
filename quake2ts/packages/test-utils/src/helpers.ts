import { vi, type Mock } from 'vitest';
import { Entity, SpawnRegistry, ScriptHookRegistry, type SpawnContext, type EntitySystem } from '@quake2ts/game';
import { createRandomGenerator, type Vec3 } from '@quake2ts/shared';

// Re-export generic helpers from shared
export { intersects, stairTrace, ladderTrace } from '@quake2ts/shared';

// -- Types --

export interface MockEngine {
  sound: Mock;
  soundIndex: Mock;
  modelIndex: Mock;
  centerprintf: Mock;
}

export interface MockGame {
  random: ReturnType<typeof createRandomGenerator>;
  registerEntitySpawn: Mock;
  unregisterEntitySpawn: Mock;
  getCustomEntities: Mock;
  hooks: ScriptHookRegistry;
  registerHooks: Mock;
  spawnWorld: Mock;
  clientBegin: Mock;
  damage: Mock;
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

  const game = {
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
    clientBegin: vi.fn(() => {
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

  const traceFn = vi.fn((start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) => ({
    fraction: 1.0,
    ent: null,
    allsolid: false,
    startsolid: false,
    endpos: end,
    plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
    surfaceFlags: 0,
    contents: 0
  }));

  const entityList: Entity[] = options?.initialEntities ? [...options.initialEntities] : [];

  // Create hooks helper that interacts with the entity list
  const hooks = game.hooks;

  const entities = {
    spawn: vi.fn(() => {
      const ent = new Entity(entityList.length + 1);
      entityList.push(ent);
      hooks.onEntitySpawn(ent);
      return ent;
    }),
    free: vi.fn((ent: Entity) => {
      const idx = entityList.indexOf(ent);
      if (idx !== -1) {
        entityList.splice(idx, 1);
      }
      hooks.onEntityRemove(ent);
    }),
    finalizeSpawn: vi.fn(),
    freeImmediate: vi.fn((ent: Entity) => {
      const idx = entityList.indexOf(ent);
      if (idx !== -1) {
        entityList.splice(idx, 1);
      }
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
    }
  } as unknown as EntitySystem;

  return {
    keyValues: {},
    entities,
    game,
    engine,
    health_multiplier: 1,
    warn: vi.fn(),
    free: vi.fn(),
    precacheModel: vi.fn(),
    precacheSound: vi.fn(),
    precacheImage: vi.fn(),
  } as unknown as TestContext;
}

export function createSpawnContext(): SpawnContext {
  return createTestContext();
}

export function createEntity(): Entity {
  return new Entity(1);
}
