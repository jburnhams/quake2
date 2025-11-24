
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/tests/src/setup.js';
import {
  createGame,
  type GameExports,
  type GameImports,
  type GameEngine,
} from '../../src/index.js';
import {
  createDefaultSpawnRegistry,
} from '../../src/entities/spawn.js';
import { createPlayerInventory } from '../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../src/combat/index.js';
import {
  CollisionEntityIndex,
  pointContents,
  CollisionModel,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import { makeBrushFromMinsMaxs, makeLeafModel } from '../physics/bsp-helpers.js';

describe('Scenario 4: Save/Load Mid-Level', () => {
  let game: GameExports;
  let collisionModel: CollisionModel;
  let collisionIndex: CollisionEntityIndex;

  beforeAll(async () => {
    setupBrowserEnvironment();

    // 1. Synthetic Map
    const floor = makeBrushFromMinsMaxs(
        { x: -1000, y: -1000, z: -10 },
        { x: 1000, y: 1000, z: 0 },
        CONTENTS_SOLID
    );
    collisionModel = makeLeafModel([floor]);
    collisionIndex = new CollisionEntityIndex();

    // 2. Setup Game
    const engine: GameEngine = {
      trace: vi.fn(),
      modelIndex: vi.fn(() => 1),
      sound: vi.fn(),
      centerprintf: vi.fn(),
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    const imports: GameImports = {
      trace: (start, mins, maxs, end, passent, contentmask) => {
        const result = collisionIndex.trace({
          model: collisionModel,
          headnode: -1,
          start,
          end,
          mins: mins || { x: 0, y: 0, z: 0 },
          maxs: maxs || { x: 0, y: 0, z: 0 },
          passId: passent ? passent.index : undefined,
          contentMask: contentmask
        });
        return {
          fraction: result.fraction,
          endpos: result.endpos,
          plane: result.plane,
          surfaceFlags: result.surfaceFlags || 0,
          contents: result.contents || 0,
          allsolid: result.allsolid,
          startsolid: result.startsolid,
          ent: result.entityId ? game.entities.get(result.entityId) : null
        };
      },
      pointcontents: (point) => {
        return pointContents(point, collisionModel, -1);
      },
      linkentity: (ent) => {
        collisionIndex.link({
          id: ent.index,
          origin: ent.origin,
          mins: ent.mins,
          maxs: ent.maxs,
          contents: ent.solid === 3 ? 1 : 0,
        });
      },
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    game = createGame(imports, engine, {
      gravity: { x: 0, y: 0, z: -800 },
      deathmatch: false
    });

    game.init(0);
    game.spawnWorld();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should save and load game state correctly', () => {
    // 1. Spawn Player and set some state
    const player = game.entities.spawn();
    player.classname = 'player';
    player.origin = { x: 0, y: 0, z: 25 };
    player.health = 80;
    player.client = {
      inventory: createPlayerInventory(),
      weaponStates: createPlayerWeaponStates(),
      weaponstate: 0,
      ps: {
        fov: 90,
        gunindex: 0,
        blend: [0,0,0,0],
        kick_angles: { x: 0, y: 0, z: 0 },
        stats: [],
        rdflags: 0,
      }
    } as any;

    // Add item to inventory
    // player.client.inventory.items.add(1); // Assuming 1 is Shotgun or something

    game.entities.linkentity(player);

    // Run a few frames to advance time
    for (let i = 0; i < 10; i++) {
        game.frame({
            deltaMs: 100,
            timeMs: (i + 1) * 100,
            frame: i + 1,
            deltaSeconds: 0.1
        }, {
             angles: { x: 0, y: 0, z: 0 },
             forwardmove: 0,
             sidemove: 0,
             upmove: 0,
             buttons: 0,
             msec: 100,
             serverFrame: i
         });
    }

    const savedTime = game.time;
    expect(savedTime).toBeGreaterThan(0);

    // 2. Create Save
    const saveFile = game.createSave('synthetic', 0, savedTime);
    expect(saveFile).toBeDefined();
    expect(saveFile.player).toBeDefined();

    // 3. Advance game state (Change things)
    player.health = 50;
    player.origin = { x: 100, y: 0, z: 25 };

    // 4. Load Save
    game.loadSave(saveFile);

    // 5. Verify restored state
    const loadedPlayer = game.entities.find(e => e.classname === 'player');
    expect(loadedPlayer).toBeDefined();

    // Note: loadSave might not restore the exact same entity reference, but find should get it.
    // However, the test holds 'player' reference. If 'loadSave' clears entities and respawns, 'player' ref might be stale or freed.
    // EntitySystem.restore uses existing pool but overwrites.
    // If indices match, 'player' object might be reused or restored.

    // Check health
    expect(loadedPlayer!.health).toBe(80); // Restored to 80

    // Check origin
    expect(loadedPlayer!.origin.x).toBe(0);

    // Check time
    expect(game.time).toBeCloseTo(savedTime);
  });
});
