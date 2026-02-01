import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGunnerSpawns } from '../../../../src/entities/monsters/gunner.js';
import { AIFlags } from '../../../../src/ai/constants.js';
import { createTestContext, spawnEntityFromDictionary, TestContext } from '@quake2ts/test-utils';
import { EntitySystem } from '../../../../src/entities/system.js';
import { Entity } from '../../../../src/entities/entity.js';

describe('monster_gunner jump', () => {
  let sys: EntitySystem;
  let context: TestContext;
  let gunner: Entity;

  beforeEach(() => {
    context = createTestContext();
    sys = context.entities;

    // Register gunner spawn using the system's register method
    registerGunnerSpawns({
        register: (classname, factory) => sys.registerEntityClass(classname, factory)
    } as any);

    gunner = spawnEntityFromDictionary(sys, { classname: 'monster_gunner' });
  });

  it('gunner jump triggers when far from enemy', () => {
    gunner.enemy = sys.spawn();
    gunner.enemy.origin = { x: 300, y: 0, z: 0 }; // > 256
    gunner.origin = { x: 0, y: 0, z: 0 };
    gunner.groundentity = sys.spawn();

    // Mock random < 0.1
    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);

    // Call run to set state
    if (gunner.monsterinfo.run) {
        gunner.monsterinfo.run(gunner, 10, sys);
    }

    // Simulate frame think that checks for jump
    // run_move has jump check at frame 0
    const runMove = gunner.monsterinfo.current_move!;
    const checkJump = runMove.frames[0].think!;
    checkJump(gunner, sys);

    // Should switch to jump move
    expect(gunner.monsterinfo.current_move?.firstframe).toBe(209);
  });

  it('gunner jump does NOT trigger if SPAWNFLAG_NOJUMPING is set', () => {
    // Re-spawn to apply flags
    // Or just set flag manually since we already spawned
    gunner.spawnflags |= 16; // NO JUMPING

    gunner.enemy = sys.spawn();
    gunner.enemy.origin = { x: 300, y: 0, z: 0 };
    gunner.groundentity = sys.spawn();

    vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);

    if (gunner.monsterinfo.run) {
        gunner.monsterinfo.run(gunner, 10, sys);
    }

    const runMove = gunner.monsterinfo.current_move!;
    const checkJump = runMove.frames[0].think!;
    checkJump(gunner, sys);

    expect(gunner.monsterinfo.current_move?.firstframe).not.toBe(209);
  });

  it('gunner_jump_takeoff sets velocity and duck flag', () => {
      gunner.enemy = sys.spawn();
      gunner.enemy.origin = { x: 300, y: 0, z: 0 };
      gunner.origin = { x: 0, y: 0, z: 0 };
      gunner.groundentity = sys.spawn();

      if (gunner.monsterinfo.run) {
          gunner.monsterinfo.run(gunner, 10, sys);
      }
      const runMove = gunner.monsterinfo.current_move!;

      // Trigger jump logic
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);
      const checkJump = runMove.frames[0].think!;
      checkJump(gunner, sys);

      // Now we are in jump_move
      const jumpMove = gunner.monsterinfo.current_move!;
      expect(jumpMove.firstframe).toBe(209);

      // Trigger takeoff (frame 0 of jump_move)
      const takeoff = jumpMove.frames[0].think!;
      takeoff(gunner, sys);

      expect(gunner.velocity.z).toBe(270);
      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeTruthy();
      expect(gunner.origin.z).toBe(1);
  });

  it('gunner_check_landing handles landing', () => {
      gunner.monsterinfo.aiflags |= AIFlags.Ducked;
      gunner.groundentity = sys.spawn();

      gunner.enemy = sys.spawn();
      gunner.enemy.origin = { x: 300, y: 0, z: 0 };
      gunner.groundentity = sys.spawn();
      vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.01);

      if (gunner.monsterinfo.run) {
          gunner.monsterinfo.run(gunner, 10, sys);
      }
      const runMove = gunner.monsterinfo.current_move!;

      const checkJump = runMove.frames[0].think!;
      checkJump(gunner, sys);

      const jumpMove = gunner.monsterinfo.current_move!;
      const checkLanding = jumpMove.frames[3].think!;

      checkLanding(gunner, sys);

      expect(gunner.monsterinfo.aiflags & AIFlags.Ducked).toBeFalsy();

      // Check engine.sound directly as that's what gunner calls
      expect(sys.engine.sound).toHaveBeenCalledWith(gunner, 0, 'mutant/thud1.wav', 1, 1, 0);
  });
});
