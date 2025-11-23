import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerBerserkSpawns } from '../../../src/entities/monsters/berserk.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { T_Damage } from '../../../src/combat/damage.js';
import { infront } from '../../../src/ai/targeting.js';

// Mock dependencies
vi.mock('../../../src/combat/damage.js', () => ({
  T_Damage: vi.fn(),
  Damageable: {},
  DamageApplicationResult: {}
}));

vi.mock('../../../src/ai/targeting.js', () => ({
  range: vi.fn(),
  infront: vi.fn(),
  visible: vi.fn(),
  Range: { Melee: 0, Near: 1, Mid: 2, Far: 3 }
}));

describe('monster_berserk', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let berserk: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
    } as unknown as EntitySystem;

    context = {
        entities: sys,
    } as unknown as SpawnContext;

    berserk = new Entity(1);

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;

    vi.clearAllMocks();
  });

  it('registerBerserkSpawns registers monster_berserk', () => {
    registerBerserkSpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_berserk', expect.any(Function));
  });

  it('SP_monster_berserk sets default properties', () => {
    registerBerserkSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(berserk, context);

    expect(berserk.model).toBe('models/monsters/berserk/tris.md2');
    expect(berserk.health).toBe(240);
    expect(berserk.solid).toBe(Solid.BoundingBox);
    expect(berserk.movetype).toBe(MoveType.Step);
    expect(berserk.monsterinfo.stand).toBeDefined();
    expect(berserk.monsterinfo.attack).toBeDefined();
  });

  it('berserk attack chooses random move', () => {
    registerBerserkSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(berserk, context);

    berserk.monsterinfo.attack!(berserk, context as any);
    expect(berserk.monsterinfo.current_move).toBeDefined();
    // It could be one of three moves, but we just verify it set something
    expect(berserk.monsterinfo.current_move!.firstframe).toBeGreaterThan(0);
  });

  it('berserk melee attack inflicts damage', () => {
    registerBerserkSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(berserk, context);

    // Force specific attack for testing (punch)
    berserk.monsterinfo.attack!(berserk, context as any);
    // Find the damage frame
    // We can't easily force the random choice, so we can iterate frames of the current move
    // Or we can manually invoke the swing function logic if it was exported, but it's not.
    // Instead, we will simulate the scenario where a swing happens.

    // Let's force the punch move manually by mocking Math.random to return 0
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    berserk.monsterinfo.attack!(berserk, context as any);

    const move = berserk.monsterinfo.current_move!;
    // Punch hit frame is index 3
    const attackFrame = move.frames[3];
    expect(attackFrame.think).toBeDefined();

    // Set up enemy
    const enemy = new Entity(2);
    enemy.origin = { x: 50, y: 0, z: 0 };
    enemy.health = 100;
    enemy.inUse = true;
    berserk.origin = { x: 0, y: 0, z: 0 };
    berserk.enemy = enemy;

    // Mock infront to true
    (infront as any).mockReturnValue(true);

    attackFrame.think!(berserk, sys);

    expect(T_Damage).toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('berserk melee attack misses if out of range', () => {
    registerBerserkSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(berserk, context);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1); // Punch
    berserk.monsterinfo.attack!(berserk, context as any);

    const move = berserk.monsterinfo.current_move!;
    const attackFrame = move.frames[3];

    // Set up enemy far away
    const enemy = new Entity(2);
    enemy.origin = { x: 200, y: 0, z: 0 };
    enemy.health = 100;
    enemy.inUse = true;
    berserk.origin = { x: 0, y: 0, z: 0 };
    berserk.enemy = enemy;

    (infront as any).mockReturnValue(true);

    attackFrame.think!(berserk, sys);

    expect(T_Damage).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });
});
