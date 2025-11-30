import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGunnerSpawns } from '../../../src/entities/monsters/gunner.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/index.js';
import { AIFlags } from '../../../src/ai/constants.js';

describe('monster_gunner jump', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let gunner: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    const soundMock = vi.fn();
    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        scheduleThink: vi.fn(),
        finalizeSpawn: vi.fn(),
        engine: { sound: soundMock },
        sound: soundMock,
    } as unknown as EntitySystem;

    context = {
        entities: sys,
    } as unknown as SpawnContext;

    gunner = new Entity(1);
    spawnRegistry = { register: vi.fn() } as unknown as SpawnRegistry;
  });

  it('gunner jump triggers when far from enemy', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 300, y: 0, z: 0 }; // > 256
    gunner.origin = { x: 0, y: 0, z: 0 };
    gunner.groundentity = new Entity(3);

    // Mock random < 0.1
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    // Call run to set state
    gunner.monsterinfo.run!(gunner, 10, sys);

    // Simulate frame think that checks for jump
    // run_move has jump check at frame 0
    const runMove = gunner.monsterinfo.current_move!;
    const checkJump = runMove.frames[0].think!;
    checkJump(gunner, sys);

    // Should switch to jump move
    expect(gunner.monsterinfo.current_move?.firstframe).toBe(209);
  });

  it('gunner jump does NOT trigger if SPAWNFLAG_NOJUMPING is set', () => {
    registerGunnerSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(gunner, context);

    gunner.spawnflags |= 16; // NO JUMPING
    gunner.enemy = new Entity(2);
    gunner.enemy.origin = { x: 300, y: 0, z: 0 };
    gunner.groundentity = new Entity(3);

    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    gunner.monsterinfo.run!(gunner, 10, sys);

    const runMove = gunner.monsterinfo.current_move!;
    const checkJump = runMove.frames[0].think!;
    checkJump(gunner, sys);

    expect(gunner.monsterinfo.current_move?.firstframe).not.toBe(209);
  });

  it('gunner_jump_takeoff sets velocity and duck flag', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      gunner.enemy = new Entity(2);
      gunner.enemy.origin = { x: 300, y: 0, z: 0 };
      gunner.origin = { x: 0, y: 0, z: 0 };
      gunner.groundentity = new Entity(3);

      // Force jump move state manually because run() just sets run_move
      // We need to simulate the transition to jump_move which happens inside gunner_jump
      gunner.monsterinfo.run!(gunner, 10, sys);
      const runMove = gunner.monsterinfo.current_move!;

      // Trigger jump logic
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      const checkJump = runMove.frames[0].think!;
      checkJump(gunner, sys); // This sets current_move to jump_move

      // Now we are in jump_move
      const jumpMove = gunner.monsterinfo.current_move!;
      expect(jumpMove.firstframe).toBe(209);

      // Trigger takeoff (frame 0 of jump_move)
      const takeoff = jumpMove.frames[0].think!;
      takeoff(gunner, sys);

      expect(gunner.velocity.z).toBe(270);
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeTruthy();
      expect(gunner.origin.z).toBe(1); // Lifted off ground
  });

  it('gunner_check_landing handles landing', () => {
      registerGunnerSpawns(spawnRegistry);
      const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
      spawnFn(gunner, context);

      // Setup landing state
      gunner.monsterinfo.aiflags |= AIFlags.Ducked;
      gunner.groundentity = new Entity(3); // Landed

      // Force jump move manually to simulate state
      gunner.enemy = new Entity(2);
      gunner.enemy.origin = { x: 300, y: 0, z: 0 };
      gunner.groundentity = new Entity(3);
      vi.spyOn(Math, 'random').mockReturnValue(0.01);

      // Enter run
      gunner.monsterinfo.run!(gunner, 10, sys);
      const runMove = gunner.monsterinfo.current_move!;

      // Trigger jump via run frame 0 logic
      const checkJump = runMove.frames[0].think!;
      checkJump(gunner, sys);

      // Now in jump_move
      const jumpMove = gunner.monsterinfo.current_move!;
      const checkLanding = jumpMove.frames[3].think!; // Frame 3 is check_landing

      checkLanding(gunner, sys);

      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeFalsy();
      expect(sys.engine.sound).toHaveBeenCalledWith(gunner, 0, 'mutant/thud1.wav', 1, 1, 0);
  });
});
