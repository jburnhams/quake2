import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTurretSpawns } from '../../../src/entities/monsters/turret.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { monster_fire_blaster } from '../../../src/entities/monsters/attack.js';
import { throwGibs } from '../../../src/entities/gibs.js';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_blaster: vi.fn(),
}));

vi.mock('../../../src/entities/gibs.js', () => ({
  throwGibs: vi.fn(),
}));

describe('monster_turret', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let turret: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    const soundMock = vi.fn();
    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        free: vi.fn(),
        engine: { sound: soundMock },
        sound: soundMock,
    } as unknown as EntitySystem;

    context = {
        entities: sys,
    } as unknown as SpawnContext;

    turret = new Entity(1);

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;

    vi.clearAllMocks();
  });

  it('registerTurretSpawns registers monster_turret', () => {
    registerTurretSpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_turret', expect.any(Function));
  });

  it('SP_monster_turret sets default properties', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(turret, context);

    expect(turret.model).toBe('models/monsters/turret/tris.md2');
    expect(turret.health).toBe(100);
    expect(turret.solid).toBe(Solid.BoundingBox);
    expect(turret.movetype).toBe(MoveType.Step);
    expect(turret.viewheight).toBe(24);
    expect(turret.monsterinfo.stand).toBeDefined();
    expect(turret.monsterinfo.attack).toBeDefined();
  });

  it('turret attack fires blaster on correct frame', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.enemy = new Entity(2);
    turret.enemy.origin = { x: 100, y: 0, z: 0 };
    turret.origin = { x: 0, y: 0, z: 0 };
    turret.angles = { x: 0, y: 0, z: 0 };

    turret.monsterinfo.attack!(turret, context as any);
    const move = turret.monsterinfo.current_move;

    expect(move).toBeDefined();
    expect(move!.frames.length).toBe(8);

    // Frame index 4 should have think
    const fireFn = move!.frames[4].think;
    expect(fireFn).toBeDefined();

    // Frame index 0 should NOT have think
    expect(move!.frames[0].think).toBeUndefined();

    fireFn!(turret, sys);

    expect(monster_fire_blaster).toHaveBeenCalledWith(
        turret,
        expect.anything(), // start
        expect.anything(), // dir
        2, // damage
        1000, // speed
        1, // flashtype
        0, // effect
        sys
    );
  });

  it('turret plays death animation when not gibbed', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.die!(turret, null, null, 10, { x: 0, y: 0, z: 0 }); // Damage not enough to gib

    expect(turret.deadflag).toBe(DeadFlag.Dying);
    expect(turret.solid).toBe(Solid.Not);
    expect(turret.takedamage).toBe(false);
    expect(throwGibs).not.toHaveBeenCalled();
    expect(sys.free).not.toHaveBeenCalled();

    // Check if animation changed to death sequence
    // The death move frames are 11-14
    expect(turret.monsterinfo.current_move!.frames.length).toBe(4);
    expect(turret.monsterinfo.current_move!.firstframe).toBe(11);
  });

  it('turret gibs when health is low enough', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.health = -50;
    turret.die!(turret, null, null, 100, { x: 0, y: 0, z: 0 });

    expect(throwGibs).toHaveBeenCalledWith(sys, turret.origin, 100);
    expect(sys.free).toHaveBeenCalledWith(turret);
  });

  it('turret enters pain state when damaged', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.pain!(turret, new Entity(2), 0, 10);

    // Check if animation changed to pain sequence
    expect(turret.monsterinfo.current_move!.frames.length).toBe(2);
    expect(turret.monsterinfo.current_move!.firstframe).toBe(9);

    // Check debounce
    expect(turret.pain_debounce_time).toBeGreaterThan(sys.timeSeconds);
  });
});
