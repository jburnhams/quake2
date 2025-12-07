import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGunnerSpawns } from '../../../src/entities/monsters/gunner.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/index.js';
import { monster_fire_bullet } from '../../../src/entities/monsters/attack.js';
import { createGrenade } from '../../../src/entities/projectiles.js';
import { AIFlags } from '../../../src/ai/constants.js';
import { createTestContext } from '../../test-helpers.js';

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
    // Use createTestContext to get a full mock including rng
    const testCtx = createTestContext();
    context = testCtx;
    sys = testCtx.entities;

    // Override some mocks if specific behavior needed
    sys.engine.sound = vi.fn();
    sys.sound = vi.fn();

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

    // Mock RNG
    // Case 1: > 0.5 -> Chain
    sys.rng.frandom = vi.fn().mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, sys); // Pass context!
    const moveChain = gunner.monsterinfo.current_move;
    expect(moveChain).toBeDefined();
    expect(moveChain?.frames.length).toBe(7);

    // Case 2: <= 0.5 -> Grenade
    sys.rng.frandom = vi.fn().mockReturnValue(0.4);
    gunner.monsterinfo.attack!(gunner, sys);
    const moveGrenade = gunner.monsterinfo.current_move;
    expect(moveGrenade).toBeDefined();
    expect(moveGrenade?.frames.length).toBe(21);
  });

  it('gunner_fire_bullet_logic fires bullets', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 100, y: 0, z: 0 };
    gunner.origin = { x: 0, y: 0, z: 0 };

    // Transition to fire chain move
    sys.rng.frandom = vi.fn().mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, sys);

    const attackMove = gunner.monsterinfo.current_move!;
    const endFunc = attackMove.endfunc!;

    endFunc(gunner, sys);

    const fireMove = gunner.monsterinfo.current_move!;
    expect(fireMove).toBeDefined();
    expect(fireMove.frames.length).toBe(8);

    const fireFn = fireMove.frames[0].think!;
    fireFn(gunner, sys);

    expect(monster_fire_bullet).toHaveBeenCalled();
    expect(monster_fire_bullet).toHaveBeenCalledWith(
        gunner,
        expect.anything(),
        expect.anything(),
        3,
        4,
        300, 500, 0,
        sys,
        expect.anything()
    );
  });

  it('gunner_fire_grenade creates grenade', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 100, y: 0, z: 0 };
    gunner.origin = { x: 0, y: 0, z: 0 };

    sys.rng.frandom = vi.fn().mockReturnValue(0.4);
    gunner.monsterinfo.attack!(gunner, sys);
    const move = gunner.monsterinfo.current_move!;

    const fireFn = move.frames[4].think!;
    expect(fireFn).toBeDefined();

    fireFn(gunner, sys);

    expect(createGrenade).toHaveBeenCalled();
  });

  it('gunner_pain selects random pain animation', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      // Mock RNG sequence for pain
      // gunner_pain:
      // 1. sound RNG (< 0.5)
      // 2. move RNG

      const mockFrandom = vi.fn();
      sys.rng.frandom = mockFrandom;

      // Pain 3 (< 0.33)
      mockFrandom.mockReturnValue(0.1); // Both calls return 0.1
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(185);

      // Pain 2 (< 0.66)
      // Call 1 (sound): 0.6 (else)
      // Call 2 (move): 0.5 (< 0.66)
      mockFrandom.mockReturnValueOnce(0.6).mockReturnValueOnce(0.5);

      gunner.pain_debounce_time = 0;
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(177);

       // Pain 1 (else)
      mockFrandom.mockReturnValue(0.8);
      gunner.pain_debounce_time = 0;
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(159);
  });

  it('gunner_fidget triggers randomly during stand', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      gunner.monsterinfo.current_move = undefined;
      gunner.monsterinfo.stand!(gunner); // Stand sets move

      const standMove = gunner.monsterinfo.current_move!;
      expect(standMove.firstframe).toBe(0);

      const checkFidget = standMove.frames[29].think!;
      expect(checkFidget).toBeDefined();

      sys.rng.frandom = vi.fn().mockReturnValue(0.01);
      checkFidget(gunner, sys); // Pass context!

      expect(gunner.monsterinfo.current_move?.firstframe).toBe(30);
  });

  it('duck behavior flags', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      sys.rng.frandom = vi.fn().mockReturnValue(0.1);
      gunner.monsterinfo.dodge!(gunner, new Entity(2), 0);

      expect(gunner.monsterinfo.current_move?.firstframe).toBe(201);

      const downFn = gunner.monsterinfo.current_move?.frames[0].think!;
      const originalMaxsZ = gunner.maxs.z;

      // gunner_duck_down uses frandom > 0.5 check for fire
      sys.rng.frandom = vi.fn().mockReturnValue(0.6);
      downFn(gunner, sys); // Pass context

      expect(gunner.maxs.z).toBeLessThan(originalMaxsZ);
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeTruthy();

      const upFn = gunner.monsterinfo.current_move?.frames[6].think!;
      upFn(gunner, sys); // Pass context

      expect(gunner.maxs.z).toBe(originalMaxsZ);
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeFalsy();
  });

});
