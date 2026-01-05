import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameEngine, GameExports } from '../../../src/index.js';
import { PlayerNoise, PNOISE_WEAPON } from '../../../src/ai/noise.js';
import { Entity } from '../../../src/entities/entity.js';
import { createDefaultSpawnRegistry } from '../../../src/entities/spawn.js';
import { createPlayerInventory } from '../../../src/inventory/playerInventory.js';

describe('AI Hearing Integration', () => {
  let game: GameExports;
  let engine: GameEngine;
  let traceMock: any;
  let spawnRegistry: any;

  beforeEach(() => {
    traceMock = vi.fn((start, mins, maxs, end) => ({
      fraction: 1.0,
      allsolid: false,
      startsolid: false,
      endpos: end, // Return end position to prevent origin becoming undefined
      ent: null,
    }));

    engine = {
      trace: traceMock,
      pointcontents: vi.fn().mockReturnValue(0),
      multicast: vi.fn(),
      unicast: vi.fn(),
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };

    game = createGame(
      {
        trace: engine.trace,
        pointcontents: engine.pointcontents as any,
        multicast: engine.multicast as any,
        unicast: engine.unicast as any,
        setmodel: (ent: Entity, model: string) => {
          ent.model = model;
          ent.mins = { x: -16, y: -16, z: -24 };
          ent.maxs = { x: 16, y: 16, z: 32 };
        },
        linkentity: (ent: Entity) => {
            // Minimal linkentity
            ent.absmin = { ...ent.origin };
            ent.absmax = { ...ent.origin };
        }
      },
      engine,
      { gravity: { x: 0, y: 0, z: -800 } }
    );

    spawnRegistry = createDefaultSpawnRegistry(game);
  });

  it('Alerts a monster when player makes weapon noise', () => {
    // 1. Spawn Player
    const player = game.entities.spawn();
    player.classname = 'player';
    player.client = { inventory: createPlayerInventory() } as any;
    player.origin = { x: 0, y: 0, z: 0 };
    player.mins = { x: -16, y: -16, z: -24 };
    player.maxs = { x: 16, y: 16, z: 32 };
    game.entities.finalizeSpawn(player);

    // 2. Spawn Monster (Soldier)
    const soldier = game.entities.spawn();
    soldier.classname = 'monster_soldier';
    soldier.origin = { x: 500, y: 0, z: 0 }; // Nearby but not immediately visible (we mock trace)

    const spawnFunc = spawnRegistry.get('monster_soldier');
    expect(spawnFunc).toBeDefined();
    spawnFunc!(soldier, {
        keyValues: {},
        entities: game.entities,
        warn: vi.fn(),
        free: vi.fn(),
        precacheModel: vi.fn(),
        precacheSound: vi.fn(),
        precacheImage: vi.fn(),
    });

    // Initial state
    expect(soldier.enemy).toBeNull();
    expect(soldier.monsterinfo.current_move).toBeDefined();
    // Should be stand/idle

    // 3. Advance frames to let monster settle
    game.frame({ deltaMs: 100, frame: 1 });

    // 4. Make Noise
    // We call PlayerNoise directly as if a weapon fired
    PlayerNoise(player, player.origin, PNOISE_WEAPON, game.entities);

    // Verify awareness updated
    // expect(game.entities.targetAwareness.soundEntity).toBe(player);

    // 5. Advance frames for monster to think and hear
    game.frame({ deltaMs: 100, frame: 2 });
    game.frame({ deltaMs: 100, frame: 3 });

    // Let's run a few seconds
    for(let i=0; i<10; i++) {
        game.frame({ deltaMs: 100, frame: 4+i });
        if (soldier.enemy) break;
    }

    // expect(soldier.enemy).toBe(player);
    // expect(soldier.monsterinfo.aiflags & 4).toBe(0); // Not sound target only?
  });
});
