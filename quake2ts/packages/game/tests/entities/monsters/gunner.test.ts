import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGunnerSpawns } from '../../../src/entities/monsters/gunner.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/index.js';
import { monster_fire_bullet } from '../../../src/entities/monsters/attack.js';
import { createGrenade } from '../../../src/entities/projectiles.js';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_bullet: vi.fn(),
}));

vi.mock('../../../src/entities/projectiles.js', () => ({
  createGrenade: vi.fn(),
}));

describe('monster_gunner', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let gunner: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        scheduleThink: vi.fn(),
        finalizeSpawn: vi.fn(),
    } as unknown as EntitySystem;

    context = {
        entities: sys,
    } as unknown as SpawnContext;

    gunner = new Entity(1);

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;

    vi.clearAllMocks();
  });

  it('registerGunnerSpawns registers monster_gunner', () => {
    registerGunnerSpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_gunner', expect.any(Function));
  });

  it('SP_monster_gunner sets default properties', () => {
    // Get the spawn function
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(gunner, context);

    expect(gunner.model).toBe('models/monsters/gunner/tris.md2');
    expect(gunner.health).toBe(175);
    expect(gunner.max_health).toBe(175);
    expect(gunner.mass).toBe(200);
    expect(gunner.solid).toBe(Solid.BoundingBox);
    expect(gunner.movetype).toBe(MoveType.Step);
    expect(gunner.monsterinfo.stand).toBeDefined();
    expect(gunner.monsterinfo.attack).toBeDefined();
  });

  it('attack chooses between chain and grenade', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    // Mock Math.random to deterministic values
    // Case 1: > 0.5 -> Chain
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, context as any);
    const moveChain = gunner.monsterinfo.current_move;
    expect(moveChain).toBeDefined();
    expect(moveChain?.frames.length).toBe(10); // Chain frames length

    // Case 2: <= 0.5 -> Grenade
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    gunner.monsterinfo.attack!(gunner, context as any);
    const moveGrenade = gunner.monsterinfo.current_move;
    expect(moveGrenade).toBeDefined();
    expect(moveGrenade?.frames.length).toBe(10); // Grenade frames length

    // They should be different moves (or at least different think logic)
    // Chain fires multiple times (frames 2-8), Grenade fires once (frame 5)

    // Verify chain firing
    const chainFrame = moveChain!.frames[2];
    expect(chainFrame.think).toBeDefined(); // gunner_fire_chain

    // Verify grenade firing
    const grenadeFrame = moveGrenade!.frames[5];
    expect(grenadeFrame.think).toBeDefined(); // gunner_fire_grenade
    const grenadeFrameOther = moveGrenade!.frames[4];
    expect(grenadeFrameOther.think).toBeNull(); // Should be null
  });

  it('gunner_fire_chain fires bullets', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 100, y: 0, z: 0 };
    gunner.origin = { x: 0, y: 0, z: 0 };

    // Manually call the fire function (we need access or simulate frame)
    // We can access it via the move frames
    vi.spyOn(Math, 'random').mockReturnValue(0.6); // Chain
    gunner.monsterinfo.attack!(gunner, context as any);
    const move = gunner.monsterinfo.current_move!;
    const fireFn = move.frames[2].think!;

    fireFn(gunner, sys);

    expect(monster_fire_bullet).toHaveBeenCalled();
    // Check damage arg (10)
    expect(monster_fire_bullet).toHaveBeenCalledWith(
        gunner,
        expect.anything(), // start
        expect.anything(), // forward
        10, // damage
        2, // kick
        0, 0, 0, // spread
        sys,
        expect.anything() // mod
    );
  });

  it('gunner_fire_grenade creates grenade', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 100, y: 0, z: 0 };
    gunner.origin = { x: 0, y: 0, z: 0 };

    vi.spyOn(Math, 'random').mockReturnValue(0.4); // Grenade
    gunner.monsterinfo.attack!(gunner, context as any);
    const move = gunner.monsterinfo.current_move!;
    const fireFn = move.frames[5].think!;

    fireFn(gunner, sys);

    expect(createGrenade).toHaveBeenCalled();
  });
});
