import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { createGame } from '../../src/index.js';
import { EntitySystem } from '../../src/entities/system.js';
import { createPlayerInventory, WeaponId } from '../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates, getWeaponState } from '../../src/combat/weapons/state.js';
import { fireEtfRifle } from '../../src/combat/weapons/rogue.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { createFlechette } from '../../src/entities/projectiles.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('Rogue Weapons: ETF Rifle', () => {
  let game: any;
  let sys: EntitySystem;
  let player: Entity;
  let mockImports: ReturnType<typeof createGameImportsAndEngine>['imports'];
  let mockEngine: ReturnType<typeof createGameImportsAndEngine>['engine'];

  beforeEach(() => {
    const result = createGameImportsAndEngine();
    mockImports = result.imports;
    mockEngine = result.engine;

    // Use a simpler trace for default
    mockImports.trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, ent: null });

    const gameExports = createGame(mockImports, mockEngine, { gravity: { x: 0, y: 0, z: -800 } });

    // Partially mock game entities system to spy on spawn
    game = {
      ...gameExports,
      entities: {
        ...gameExports.entities,
        spawn: vi.fn().mockImplementation(() => createEntityFactory({ number: 0 })),
        free: vi.fn(),
        modelIndex: vi.fn().mockReturnValue(1),
        finalizeSpawn: vi.fn(),
        scheduleThink: vi.fn(),
        findByRadius: vi.fn().mockReturnValue([]),
        // Ensure multicast is available on sys
        multicast: mockImports.multicast
      }
    };
    sys = game.entities;
    game.trace = mockImports.trace;
    game.multicast = mockImports.multicast;

    player = createPlayerEntityFactory({
      origin: { x: 100, y: 100, z: 100 },
      angles: { x: 0, y: 90, z: 0 }, // Facing North (Y+)
      viewheight: 22,
      client: {
        inventory: createPlayerInventory(),
        weaponStates: createPlayerWeaponStates(),
        buttons: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90
      } as any
    }) as Entity;
  });

  it('should fire a flechette projectile', () => {
    player.client!.inventory.ammo.counts[AmmoType.Flechettes] = 10;

    // Setup spy on createFlechette via sys.spawn
    const flechette = createEntityFactory({ number: 2 }) as Entity;
    sys.spawn = vi.fn().mockReturnValue(flechette);

    const start = { x: 100, y: 100, z: 122 };
    const forward = { x: 0, y: 1, z: 0 };
    fireEtfRifle(game, player, player.client!.inventory, getWeaponState(player.client!.weaponStates, WeaponId.EtfRifle), start, forward);

    // Verify ammo consumption
    expect(player.client!.inventory.ammo.counts[AmmoType.Flechettes]).toBe(9);

    // Verify flechette properties
    expect(flechette.classname).toBe('flechette');
    expect(flechette.owner).toBe(player);
    expect(flechette.movetype).toBe(MoveType.FlyMissile);
    expect(flechette.modelindex).toBe(1);

    // Verify touch handler exists
    expect(typeof flechette.touch).toBe('function');
  });

  it('should apply freeze effect on impact with monster', () => {
    sys.multicast = game.multicast;

    const flechette = createEntityFactory({ number: 2 }) as Entity;
    sys.spawn = vi.fn().mockReturnValue(flechette);

    const forward = { x: 0, y: 1, z: 0 };
    createFlechette(sys, player, player.origin, forward, 10, 900);

    // Simulate touch with a monster
    const monster = createEntityFactory({ number: 3 }) as Entity;
    monster.takedamage = true;
    monster.health = 100;
    monster.monsterinfo = {
        freeze_time: 0,
        aiflags: 0,
        last_sighting: ZERO_VEC3,
        trail_time: 0,
        pausetime: 0
    } as any;

    const touch = flechette.touch!;
    touch(flechette, monster, null, null);

    expect(monster.monsterinfo!.freeze_time).toBeGreaterThan(0);

    // Also verify sys.free was called on flechette
    expect(sys.free).toHaveBeenCalledWith(flechette);
  });
});

describe('T_Damage Frozen Shatter', () => {
    let game: any;
    let sys: EntitySystem;
    let mockImports: ReturnType<typeof createGameImportsAndEngine>['imports'];
    let mockEngine: ReturnType<typeof createGameImportsAndEngine>['engine'];

    beforeEach(() => {
        const result = createGameImportsAndEngine();
        mockImports = result.imports;
        mockEngine = result.engine;

        const gameExports = createGame(mockImports, mockEngine, { gravity: { x: 0, y: 0, z: -800 } });
        game = { ...gameExports };
        sys = game.entities;
    });

    it('should instantly kill frozen entity', () => {
        const monster = createEntityFactory({ number: 1 }) as Entity;
        monster.takedamage = true;
        monster.health = 100;
        monster.monsterinfo = {
            freeze_time: 20, // Frozen
            aiflags: 0,
            last_sighting: ZERO_VEC3,
            trail_time: 0,
            pausetime: 0
        } as any;

        const result = T_Damage(
            monster as any,
            null,
            null,
            ZERO_VEC3,
            ZERO_VEC3,
            ZERO_VEC3,
            1, // Tiny damage
            0,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            10 // Current time
        );

        expect(result).not.toBeNull();
        expect(result!.take).toBe(200); // 100 health + 100 extra
        expect(monster.health).toBeLessThan(-40); // Gibbed
    });
});
