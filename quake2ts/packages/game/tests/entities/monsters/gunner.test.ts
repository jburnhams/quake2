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
    vi.clearAllMocks();
    const testContext = createTestContext();
    sys = testContext.entities as unknown as EntitySystem;
    context = testContext;

    gunner = new Entity(1);

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;
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

    // Mock RNG to deterministic values
    // Case 1: > 0.5 -> Chain
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, context.entities as any);
    const moveChain = gunner.monsterinfo.current_move;
    expect(moveChain).toBeDefined();
    // Chain frames length is 7 now (attack_chain_frames) + 8 (fire_chain) + 7 (endfire_chain) technically,
    // but the initial move `attack_chain_move` has 7 frames.
    expect(moveChain?.frames.length).toBe(7);

    // Case 2: <= 0.5 -> Grenade
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.4);
    gunner.monsterinfo.attack!(gunner, context.entities as any);
    const moveGrenade = gunner.monsterinfo.current_move;
    expect(moveGrenade).toBeDefined();
    expect(moveGrenade?.frames.length).toBe(21); // Grenade frames length
  });

  it('gunner_fire_bullet_logic fires bullets', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 100, y: 0, z: 0 };
    gunner.origin = { x: 0, y: 0, z: 0 };

    // We need to access the logic function used in fire_chain_frames
    // It is not exported, so we simulate the move transition.

    // Transition to fire chain move
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.6);
    gunner.monsterinfo.attack!(gunner, context.entities as any);

    // attack_chain_move ends with gunner_fire_chain
    const attackMove = gunner.monsterinfo.current_move!;
    const endFunc = attackMove.endfunc!;

    // Simulate end of attack_chain -> triggers gunner_fire_chain -> sets fire_chain_move
    endFunc(gunner, sys);

    const fireMove = gunner.monsterinfo.current_move!;
    expect(fireMove).toBeDefined();
    expect(fireMove.frames.length).toBe(8);

    // Now call the think function of one of the frames
    const fireFn = fireMove.frames[0].think!;
    fireFn(gunner, sys);

    expect(monster_fire_bullet).toHaveBeenCalled();
    // Check damage arg (3)
    expect(monster_fire_bullet).toHaveBeenCalledWith(
        gunner,
        expect.anything(), // start
        expect.anything(), // forward
        3, // damage
        4, // kick
        300, 500, 0, // spread (Updated to match C source: HSPREAD 300, VSPREAD 500)
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

    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.4); // Grenade
    gunner.monsterinfo.attack!(gunner, context.entities as any);
    const move = gunner.monsterinfo.current_move!;

    // Find a frame with gunner_fire_grenade (e.g. index 4)
    const fireFn = move.frames[4].think!;
    expect(fireFn).toBeDefined();

    fireFn(gunner, sys);

    expect(createGrenade).toHaveBeenCalled();
  });

  it('gunner_pain selects random pain animation', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      const spy = vi.spyOn(sys.rng, 'frandom');

      // Pain 3 (< 0.33)
      spy.mockReturnValue(0.1);
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(185); // pain3 start

      // Pain 2 (< 0.66)
      spy.mockReturnValue(0.4);
      // Reset debounce
      gunner.pain_debounce_time = 0;
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(177); // pain2 start

       // Pain 1 (else)
      spy.mockReturnValue(0.8);
      // Reset debounce
      gunner.pain_debounce_time = 0;
      gunner.pain!(gunner, null, 0, 10);
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(159); // pain1 start
  });

  it('gunner_fidget triggers randomly during stand', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      gunner.monsterinfo.current_move = undefined; // clear
      gunner.monsterinfo.stand!(gunner, context as any);

      const standMove = gunner.monsterinfo.current_move!;
      expect(standMove.firstframe).toBe(0);

      // Last frame of stand has check for fidget
      const checkFidget = standMove.frames[29].think!;
      expect(checkFidget).toBeDefined();

      // Mock random <= 0.05
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);
      checkFidget(gunner, sys);

      // Should switch to fidget move (start frame 30)
      expect(gunner.monsterinfo.current_move?.firstframe).toBe(30);
  });

  it('duck behavior flags', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      // Should invoke duck if random allows (mock it)
      // Actually dodge uses random > 0.25 return, so <= 0.25 to proceed
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.1);
      gunner.monsterinfo.dodge!(gunner, new Entity(2), 0);

      expect(gunner.monsterinfo.current_move?.firstframe).toBe(201); // Duck start

      // Test duck_down logic
      const downFn = gunner.monsterinfo.current_move?.frames[0].think!;
      const originalMaxsZ = gunner.maxs.z;
      downFn(gunner, sys);

      expect(gunner.maxs.z).toBeLessThan(originalMaxsZ); // Should have crouched
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeTruthy(); // AI_DUCKED

      // Test duck_up logic (frame 6)
      const upFn = gunner.monsterinfo.current_move?.frames[6].think!;
      upFn(gunner, sys);

      expect(gunner.maxs.z).toBe(originalMaxsZ); // Should be back
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeFalsy();
  });
});
