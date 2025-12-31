import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptHookRegistry, ScriptHooks } from '../../../src/scripting/hooks.js';
import { Entity } from '../../../src/entities/entity.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createGame } from '../../../src/index.js';
import { T_Damage } from '../../../src/combat/damage.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { ZERO_VEC3 } from '@quake2ts/shared';

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
    const context = createTestContext();
    const entities = context.entities;
    const onDamage = vi.fn();
    entities.scriptHooks.register({ onDamage });

    const target = entities.spawn();
    target.takedamage = true;
    target.health = 100;
    target.classname = 'target';

    const attacker = entities.spawn();
    attacker.classname = 'attacker';

    // Mock trace used by T_Damage
    (entities.trace as any).mockReturnValue({
        fraction: 1.0,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 } },
        ent: target
    });

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
      { hooks: entities.scriptHooks }, // Pass hooks via options
      entities // Pass entities system
    );

    expect(onDamage).toHaveBeenCalledWith(target, attacker, attacker, 10, expect.anything(), expect.anything());
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
            serverCommand: vi.fn(),
            assets: {
               // ... mocks
            }
        };
        const options = { gravity: {x:0,y:0,z:-800} };

        // Create REAL game
        // We cast to any to avoid complex mocking of all imports/engine methods
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
