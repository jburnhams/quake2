import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptHookRegistry, ScriptHooks } from '../../src/scripting/hooks.js';
import { Entity } from '../../src/entities/entity.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGame, GameExports } from '../../src/index.js';
import { createTestContext } from '../test-helpers.js';

describe('ScriptHookRegistry', () => {
  let registry: ScriptHookRegistry;

  beforeEach(() => {
    registry = new ScriptHookRegistry();
  });

  it('should register and unregister hooks', () => {
    const hook: ScriptHooks = {
      onMapLoad: vi.fn(),
    };

    const unregister = registry.register(hook);

    registry.onMapLoad('test_map');
    expect(hook.onMapLoad).toHaveBeenCalledWith('test_map');

    unregister();

    registry.onMapLoad('test_map_2');
    expect(hook.onMapLoad).toHaveBeenCalledTimes(1); // Still only 1 call from before
  });

  it('should support multiple hooks', () => {
    const hook1 = { onMapLoad: vi.fn() };
    const hook2 = { onMapLoad: vi.fn() };

    registry.register(hook1);
    registry.register(hook2);

    registry.onMapLoad('test');

    expect(hook1.onMapLoad).toHaveBeenCalledWith('test');
    expect(hook2.onMapLoad).toHaveBeenCalledWith('test');
  });

  it('should trigger onPlayerSpawn', () => {
    const hook = { onPlayerSpawn: vi.fn() };
    registry.register(hook);
    const player = { classname: 'player' } as Entity;
    registry.onPlayerSpawn(player);
    expect(hook.onPlayerSpawn).toHaveBeenCalledWith(player);
  });

  it('triggers onDamage when entity takes damage', () => {
    const onDamage = vi.fn();
    entities.scriptHooks.register({ onDamage });

    const target = entities.spawn();
    target.takedamage = true;
    target.health = 100;
    target.classname = 'target';

    const attacker = entities.spawn();
    attacker.classname = 'attacker';

    T_Damage(
      target,
      attacker,
      attacker,
      ZERO_VEC3,
      ZERO_VEC3,
      ZERO_VEC3,
      10,
      0,
      0,
      DamageMod.UNKNOWN,
      0,
      undefined,
      undefined,
      entities // Pass entities system
    );

    expect(onDamage).toHaveBeenCalledWith(target, attacker, attacker, 10);
  });
     
  it('should trigger onPlayerDeath', () => {
    const hook = { onPlayerDeath: vi.fn() };
    registry.register(hook);
    const player = { classname: 'player' } as Entity;
    registry.onPlayerDeath(player, null, null, 100);
    expect(hook.onPlayerDeath).toHaveBeenCalledWith(player, null, null, 100);
  });

  it('should trigger onEntitySpawn', () => {
    const hook = { onEntitySpawn: vi.fn() };
    registry.register(hook);
    const ent = { classname: 'rocket' } as Entity;
    registry.onEntitySpawn(ent);
    expect(hook.onEntitySpawn).toHaveBeenCalledWith(ent);
  });

  it('should trigger onEntityRemove', () => {
    const hook = { onEntityRemove: vi.fn() };
    registry.register(hook);
    const ent = { classname: 'rocket' } as Entity;
    registry.onEntityRemove(ent);
    expect(hook.onEntityRemove).toHaveBeenCalledWith(ent);
  });

  it('should trigger onDamage', () => {
    const hook = { onDamage: vi.fn() };
    registry.register(hook);
    const target = { classname: 'monster' } as Entity;
    registry.onDamage(target, null, null, 50, DamageFlags.NONE, DamageMod.UNKNOWN);
    expect(hook.onDamage).toHaveBeenCalledWith(target, null, null, 50, DamageFlags.NONE, DamageMod.UNKNOWN);
  });

  it('should trigger onPickup', () => {
    const hook = { onPickup: vi.fn() };
    registry.register(hook);
    const player = { classname: 'player' } as Entity;
    const item = { classname: 'item_health' } as Entity;
    registry.onPickup(player, item);
    expect(hook.onPickup).toHaveBeenCalledWith(player, item);
  });
});

describe('GameExports Hooks Integration', () => {
  let game: GameExports;
  let hooks: ScriptHooks;

  beforeEach(async () => {
    // createTestContext provides a simplified environment where game logic is mocked/minimal.
    // The "game" object returned by createTestContext is a mock object defined in test-helpers.ts,
    // NOT the full GameExports from createGame.
    // However, hooks.test.ts seems to want to test integration with the REAL createGame logic,
    // OR test that the mock setup in test-helpers supports hooks.
    //
    // If we want to test REAL integration, we should use createGame from ../src/index.js.
    // But createGame requires engine, imports, etc.
    //
    // The previous failure was "game.registerHooks is not a function" because createTestContext returned a mock game object that didn't have it.
    // I updated createTestContext to include registerHooks.
    //
    // Now let's see if we are testing the mock or the real deal.
    // The test calls `game.spawnWorld()`. In the mock, this just calls hooks.onMapLoad.
    // This confirms the mock is working.
    //
    // If we want to test that REAL createGame calls hooks, we should instantiate real createGame.

    // For this test file, let's stick to testing the mock context first to ensure test-helpers are correct,
    // AND then maybe add a test for real createGame if needed.
    // The current test suite describes "GameExports Hooks Integration".
    // If `game` comes from `createTestContext().game`, it is the mock.

    const context = await createTestContext();
    game = context.game; // This is the mock game from test-helpers

    hooks = {
      onMapLoad: vi.fn(),
      onEntitySpawn: vi.fn(),
      onEntityRemove: vi.fn(),
      onPlayerSpawn: vi.fn(),
      onDamage: vi.fn()
    };
    game.registerHooks(hooks);
  });

  it('should trigger onMapLoad on spawnWorld', () => {
    // In mock game, spawnWorld calls onMapLoad
    game.spawnWorld();
    expect(hooks.onMapLoad).toHaveBeenCalledWith('q2dm1');
  });

  it('should trigger onEntitySpawn when spawning entity', () => {
    // In mock context, entities.spawn calls onEntitySpawn
    const context = createTestContext();
    // Wait, we need to register hooks on the game that matches the entities.
    // The `game` variable is context.game.
    // The `context.entities` uses that game.
    // BUT in test-helpers, I instantiated `hooks` inside createTestContext.
    // I need to make sure I am using the SAME context.

    // In `beforeEach`, I did `context = await createTestContext(); game = context.game`.
    // I should also get `entities`.
  });
});

describe('Real GameExports Hooks Integration', () => {
    // Test the actual createGame logic
    it('should trigger hooks in real game flow', () => {
        const { entities: mockEntities } = createTestContext();
        const engine = mockEntities.engine;
        const imports = {
            trace: vi.fn(() => ({ fraction: 1, endpos: {x:0,y:0,z:0} })),
            pointcontents: vi.fn(),
            linkentity: vi.fn(),
            multicast: vi.fn(),
            unicast: vi.fn(),
            configstring: vi.fn(),
            serverCommand: vi.fn()
        };
        const options = { gravity: {x:0,y:0,z:-800} };

        // Create REAL game
        const game = createGame(imports as any, engine, options);

        const hooks = {
            onMapLoad: vi.fn(),
            onPlayerSpawn: vi.fn()
        };

        game.registerHooks(hooks);

        // trigger spawnWorld
        game.entities.world.message = 'map1';
        game.spawnWorld();
        expect(hooks.onMapLoad).toHaveBeenCalledWith('map1');

        // trigger clientBegin -> onPlayerSpawn
        const client = { inventory: { ammo: { counts: [] } } } as any;
        game.clientBegin(client);
        expect(hooks.onPlayerSpawn).toHaveBeenCalled();
    });
});
