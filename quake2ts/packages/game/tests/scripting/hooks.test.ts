import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { createGame } from '../../src/index.js';
import { GameEngine } from '../../src/imports.js';
import { Entity } from '../../src/entities/entity.js';
import { createWeaponPickupEntity } from '../../src/entities/items/weapons.js';
import { WEAPON_ITEMS } from '../../src/inventory/items.js';
import { player_die } from '../../src/entities/player.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

describe('Script Hooks', () => {
  let gameExports: ReturnType<typeof createGame>;
  let entities: EntitySystem;
  let engine: GameEngine;

  beforeEach(() => {
    engine = {
      modelIndex: vi.fn(() => 1),
      soundIndex: vi.fn(() => 1),
      sound: vi.fn(),
      centerprintf: vi.fn(),
      time: vi.fn(() => 1000),
    } as any;

    gameExports = createGame({}, engine, { gravity: { x: 0, y: 0, z: -800 } });
    entities = gameExports.entities;
  });

  it('triggers onMapLoad when spawnWorld is called', () => {
    const onMapLoad = vi.fn();
    entities.scriptHooks.register({ onMapLoad });

    entities.level.mapname = 'test_map';
    gameExports.spawnWorld();

    expect(onMapLoad).toHaveBeenCalledWith('test_map');
  });

  it('triggers onMapUnload when shutdown is called', () => {
    const onMapUnload = vi.fn();
    entities.scriptHooks.register({ onMapUnload });

    gameExports.shutdown();

    expect(onMapUnload).toHaveBeenCalled();
  });

  it('triggers onPlayerSpawn when player spawns via respawn/clientBegin', () => {
    const onPlayerSpawn = vi.fn();
    entities.scriptHooks.register({ onPlayerSpawn });

    // Mock client
    const client: any = {
        inventory: {
            powerups: new Map(),
            weapons: [],
            ownedWeapons: new Set(),
            ammo: { counts: {}, caps: [] }
        }
    };

    const player = gameExports.clientBegin(client);

    expect(onPlayerSpawn).toHaveBeenCalledWith(player);
  });

  it('triggers onPlayerDeath when player dies', () => {
    const onPlayerDeath = vi.fn();
    entities.scriptHooks.register({ onPlayerDeath });

    const player = entities.spawn();
    player.classname = 'player';
    player.client = {
        inventory: {
            keys: new Set(),
            powerups: new Map(),
            items: new Set(),
            ownedWeapons: new Set(),
            ammo: { counts: [], caps: [] }
        }
    } as any;
    player.health = 0;

    const attacker = entities.spawn();

    player_die(player, attacker, attacker, 100, ZERO_VEC3, DamageMod.UNKNOWN, entities);

    expect(onPlayerDeath).toHaveBeenCalledWith(player, attacker, attacker, 100);
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

  it('triggers onPickup when player picks up an item', () => {
    const onPickup = vi.fn();
    entities.scriptHooks.register({ onPickup });

    const player = entities.spawn();
    player.classname = 'player';
    player.client = {
        inventory: {
            weapons: [],
            ownedWeapons: new Set(),
            ammo: { counts: [], caps: [100, 100, 100, 100, 100, 100] }, // Ensure caps exist
            powerups: new Map(),
            items: new Set(),
            keys: new Set(),
        }
    } as any;

    const weaponItem = WEAPON_ITEMS['weapon_shotgun'];
    // Mock weapon pickup entity creation and touch
    const pickup = createWeaponPickupEntity(gameExports, weaponItem);
    const self = entities.spawn();
    Object.assign(self, pickup);

    // Trigger touch
    if (self.touch) {
        self.touch(self, player);
    } else {
        throw new Error("Touch function not defined");
    }

    expect(onPickup).toHaveBeenCalledWith(player, weaponItem.id);
  });

  it('triggers onEntitySpawn when entity is spawned', () => {
    const onEntitySpawn = vi.fn();
    entities.scriptHooks.register({ onEntitySpawn });

    const ent = entities.spawn();

    expect(onEntitySpawn).toHaveBeenCalledWith(ent);
  });

  it('triggers onEntityRemove when entity is freed', () => {
    const onEntityRemove = vi.fn();
    entities.scriptHooks.register({ onEntityRemove });

    const ent = entities.spawn();
    entities.free(ent);

    expect(onEntityRemove).toHaveBeenCalledWith(ent);
  });
});
