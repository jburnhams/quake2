import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameExports, GameEngine, GameCreateOptions } from '../src/index.js';
import { EntitySystem } from '../src/entities/system.js';
import { Entity, MoveType, Solid } from '../src/entities/entity.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../src/inventory/index.js';
import { Vec3 } from '@quake2ts/shared';
import { AmmoItemId, pickupAmmo } from '../src/inventory/ammo.js';

// Mock engine
const mockEngine: GameEngine = {
    trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: {x:0,y:0,z:0} }),
    sound: vi.fn(),
    soundIndex: vi.fn().mockReturnValue(1),
    centerprintf: vi.fn(),
    modelIndex: vi.fn().mockReturnValue(1),
    multicast: vi.fn(),
    unicast: vi.fn(),
    configstring: vi.fn(),
    serverCommand: vi.fn(),
};

const mockImports = {
    trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: {x:0,y:0,z:0} }),
    pointcontents: vi.fn().mockReturnValue(0),
};

const options: GameCreateOptions = {
    gravity: { x: 0, y: 0, z: -800 },
    deathmatch: false
};

describe('Player State Snapshot', () => {
    let game: GameExports;
    let player: Entity;

    beforeEach(() => {
        vi.clearAllMocks();
        game = createGame(mockImports, mockEngine, options);
        game.init(0);
        // Spawn a player manually or via game mechanics if possible
        // game.spawnWorld() handles player spawn in SP
        game.spawnWorld();
        player = game.entities.find(e => e.classname === 'player')!;

        // Ensure player has client
        if (!player.client) {
             const inventory = createPlayerInventory();
             game.clientBegin({
                 inventory,
                 weaponStates: { states: new Map() },
                 pers: {
                     connected: true,
                     inventory: [],
                     health: 100,
                     max_health: 100,
                     savedFlags: 0,
                     selected_item: 0
                 },
                 buttons: 0,
                 pm_type: 0,
                 pm_time: 0,
                 pm_flags: 0,
                 gun_frame: 0,
                 rdflags: 0,
                 fov: 90
             });
             player = game.entities.find(e => e.classname === 'player')!;
        }
    });

    it('should correctly report ammo for current weapon', () => {
        // Give shotgun and shells
        const inv = player.client!.inventory;
        inv.ownedWeapons.add(WeaponId.Shotgun);
        inv.currentWeapon = WeaponId.Shotgun;
        // inv.ammo.counts is array indexed by AmmoType
        // Shells index is 1 (usually)
        // Let's use helper
        pickupAmmo(inv.ammo, AmmoItemId.Shells, { countOverride: 25 });

        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1 });

        // Assert
        expect(snapshot.state.ammo).toBe(25);
    });

    it('should report correct viewangles', () => {
        player.angles = { x: 10, y: 20, z: 5 };
        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1 });

        expect(snapshot.state.viewangles.x).toBe(10);
        expect(snapshot.state.viewangles.y).toBe(20);
        expect(snapshot.state.viewangles.z).toBe(5);
    });

    it('should report correct fov', () => {
        player.client!.fov = 110;
        const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1 });

        expect(snapshot.state.fov).toBe(110);
    });

    // We will enable this test after implementing damage_alpha
    // it('should report damageAlpha', () => {
    //     player.client!.damage_alpha = 0.5;
    //     const snapshot = game.frame({ deltaSeconds: 0.1, frame: 1 });
    //     expect(snapshot.state.damageAlpha).toBe(0.5);
    // });
});
