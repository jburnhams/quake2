import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMonsterEntityFactory, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { registerGunnerSpawns } from '../../../src/entities/monsters/gunner.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { monster_fire_bullet } from '../../../src/entities/monsters/attack.js';
import { createGrenade } from '../../../src/entities/projectiles.js';
import { AIFlags } from '../../../src/ai/constants.js';
import { createTestContext } from '@quake2ts/test-utils';

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

    gunner = createMonsterEntityFactory('monster_gunner', { number: 1 });

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;
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

    // Mock RNG to deterministic values
    // Case 1: > 0.5 -> Chain
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, context.entities as any);
    const moveChain = gunner.monsterinfo.current_move;
    expect(moveChain).toBeDefined();
    expect(moveChain?.frames.length).toBe(7);

    // Case 2: <= 0.5 -> Grenade
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.4);
    gunner.monsterinfo.attack!(gunner, context.entities as any);
    const moveGrenade = gunner.monsterinfo.current_move;
    expect(moveGrenade).toBeDefined();
    expect(moveGrenade?.frames.length).toBe(21);
  });

  it('gunner_fire_bullet_logic fires bullets', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = createPlayerEntityFactory({
        number: 2,
        origin: { x: 100, y: 0, z: 0 }
    });
    gunner.origin = { x: 0, y: 0, z: 0 };

    // Transition to fire chain move
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, context.entities as any);

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

    gunner.enemy = createPlayerEntityFactory({
        number: 2,
        origin: { x: 100, y: 0, z: 0 }
    });
    gunner.origin = { x: 0, y: 0, z: 0 };

    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.4); // Grenade
    gunner.monsterinfo.attack!(gunner, context.entities as any);
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

      const mockFrandom = vi.spyOn(sys.rng, 'frandom');

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

      // Mock random <= 0.05
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);
      checkFidget(gunner, sys);

      expect(gunner.monsterinfo.current_move?.firstframe).toBe(30);
  });

  it('duck behavior flags', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      // Should invoke duck if random allows (mock it)
      // Actually dodge uses random > 0.25 return, so <= 0.25 to proceed
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.1);
      gunner.monsterinfo.dodge!(gunner, createEntityFactory({ number: 2 }), 0);

      expect(gunner.monsterinfo.current_move?.firstframe).toBe(201); // Duck start

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
