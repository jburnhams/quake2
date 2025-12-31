import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSaveFile,
  parseSaveFile,
  applySaveFile,
  type SaveApplyTargets,
} from '../../src/save/save.js';
import { EntitySystem, type Entity } from '../../src/entities/system.js';
import { LevelClock } from '../../src/level.js';
import { RandomGenerator } from '@quake2ts/shared';
import { CvarRegistry } from '@quake2ts/engine';
import { createPlayerInventory, type PlayerInventory, WeaponId, PowerupId } from '../../src/inventory/playerInventory.js';
import { DeadFlag } from '../../src/entities/entity.js';
import { AmmoType } from '../../src/inventory/items.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Save/Load Robustness', () => {
  let entitySystem: EntitySystem;
  let levelClock: LevelClock;
  let rng: RandomGenerator;
  let cvars: CvarRegistry;
  let playerInventory: PlayerInventory;
  let targets: SaveApplyTargets;

  // Use createGameImportsAndEngine for mocking
  let mockImports: ReturnType<typeof createGameImportsAndEngine>['imports'];
  let mockEngine: ReturnType<typeof createGameImportsAndEngine>['engine'];


  beforeEach(() => {
    const result = createGameImportsAndEngine();
    mockImports = result.imports;
    mockEngine = result.engine;

    entitySystem = new EntitySystem(mockEngine, mockImports, undefined, 800);
    levelClock = new LevelClock();
    rng = new RandomGenerator(12345);
    cvars = new CvarRegistry();
    playerInventory = createPlayerInventory();

    targets = {
      levelClock,
      entitySystem,
      rng,
      cvars,
      player: playerInventory
    };
  });

  it('should save and restore player state when dead', () => {
    // 1. Setup dead player
    const player = entitySystem.spawn();
    player.classname = 'player';
    player.health = -20;
    player.deadflag = DeadFlag.Dead;
    player.takedamage = false;
    player.origin = { x: 100, y: 200, z: 30 };

    // 2. Create Save
    const save = createSaveFile({
      map: 'test_map',
      difficulty: 1,
      playtimeSeconds: 120,
      levelState: levelClock.snapshot(),
      entitySystem,
      rngState: rng.getState(),
      player: playerInventory
    });

    // 3. Clear System
    entitySystem = new EntitySystem(mockEngine, mockImports, undefined, 800);
    const newTargets = { ...targets, entitySystem };

    // 4. Load
    applySaveFile(save, newTargets);

    // 5. Verify
    let loadedPlayer: Entity | undefined;
    newTargets.entitySystem.forEachEntity((ent) => {
        if (ent.index === player.index) loadedPlayer = ent;
    });

    expect(loadedPlayer).toBeDefined();
    expect(loadedPlayer!.health).toBe(-20);
    expect(loadedPlayer!.deadflag).toBe(DeadFlag.Dead);
    expect(loadedPlayer!.origin).toEqual({ x: 100, y: 200, z: 30 });
  });

  it('should handle large inventory states', () => {
    // 1. Fill inventory
    playerInventory.ammo.counts[AmmoType.Shells] = 100;
    playerInventory.ammo.counts[AmmoType.Cells] = 200;
    playerInventory.ammo.counts[AmmoType.Rockets] = 50;
    playerInventory.ownedWeapons.add(WeaponId.SuperShotgun);
    playerInventory.ownedWeapons.add(WeaponId.RocketLauncher);
    playerInventory.ownedWeapons.add(WeaponId.BFG10K);
    playerInventory.currentWeapon = WeaponId.BFG10K;

    // 2. Create Save
    const save = createSaveFile({
      map: 'inventory_test',
      difficulty: 2,
      playtimeSeconds: 300,
      levelState: levelClock.snapshot(),
      entitySystem,
      rngState: rng.getState(),
      player: playerInventory
    });

    // 3. Reset Inventory
    const newInventory = createPlayerInventory();

    // 4. Load
    applySaveFile(save, { ...targets, player: newInventory });

    // 5. Verify
    expect(newInventory.ammo.counts[AmmoType.Shells]).toBe(100);
    expect(newInventory.ammo.counts[AmmoType.Cells]).toBe(200);
    expect(newInventory.ownedWeapons.has(WeaponId.BFG10K)).toBe(true);
    expect(newInventory.currentWeapon).toBe(WeaponId.BFG10K);
  });

  it('should fail gracefully with corrupted checksum', () => {
    const save = createSaveFile({
      map: 'corruption_test',
      difficulty: 1,
      playtimeSeconds: 10,
      levelState: levelClock.snapshot(),
      entitySystem,
      rngState: rng.getState()
    });

    // Tamper with data
    const raw = JSON.parse(JSON.stringify(save));
    raw.map = 'hacked_map';
    // Checksum remains for 'corruption_test', so this should fail

    expect(() => parseSaveFile(raw)).toThrow(/checksum mismatch/);
  });

  it('should restore powerup timers correctly', () => {
    const futureTime = 1000 + 30 * 1000; // 30 seconds from now
    playerInventory.powerups.set(PowerupId.QuadDamage, futureTime);

    // Create Save
    const save = createSaveFile({
      map: 'powerup_test',
      difficulty: 1,
      playtimeSeconds: 100,
      levelState: levelClock.snapshot(),
      entitySystem,
      rngState: rng.getState(),
      player: playerInventory
    });

    // Reset
    const newInventory = createPlayerInventory();

    // Load
    applySaveFile(save, { ...targets, player: newInventory });

    // Verify
    expect(newInventory.powerups.get(PowerupId.QuadDamage)).toBe(futureTime);
  });

  it('should support max entities limit simulation', () => {
    // Spawn many entities
    for (let i = 0; i < 100; i++) {
      const e = entitySystem.spawn();
      e.classname = 'dummy';
      e.health = 100;
    }

    const save = createSaveFile({
      map: 'stress_test',
      difficulty: 1,
      playtimeSeconds: 50,
      levelState: levelClock.snapshot(),
      entitySystem,
      rngState: rng.getState()
    });

    // Reset
    const newSystem = new EntitySystem(mockEngine, mockImports, undefined, 800);
    applySaveFile(save, { ...targets, entitySystem: newSystem });

    // Verify count
    let count = 0;
    newSystem.forEachEntity(() => {
      count++;
    });
    // +1 for worldspawn which is always at 0
    expect(count).toBe(101);
  });
});
