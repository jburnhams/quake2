import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';
import { SP_monster_gunner } from '../../../../src/entities/monsters/gunner.js';
import { Entity, EntityFlags, Solid, MoveType } from '../../../../src/entities/entity.js';
import { MonsterFrame } from '../../../../src/entities/entity.js';

describe('monster_gunner sound behavior', () => {
  let context: any;
  let gunner: Entity;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createTestContext();

    // Setup random
    context.entities.rng = {
      frandom: vi.fn(() => 0.6), // Force specific path (attack chain)
      crandom: vi.fn(() => 0.1), // Used by fire bullet
    };
    // Ensure game.random is also mocked if accessed that way
    context.entities.game.random = context.entities.rng;

    // Create gunner
    gunner = {
      classname: 'monster_gunner',
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      monsterinfo: {},
      timestamp: 0
    } as any;

    SP_monster_gunner(gunner, {
      entities: context.entities,
      health_multiplier: 1,
      skill: 1
    } as any);
  });

  it('plays gunatck1.wav during attack chain initiation (spin up)', () => {
    // Force attack
    gunner.enemy = {
        health: 100,
        origin: { x: 100, y: 0, z: 0 },
        solid: Solid.Bsp
    } as any;

    // Call attack to set current_move to attack_chain_move
    gunner.monsterinfo.attack!(gunner);

    // attack_chain_move: firstframe 137, lastframe 143.
    // Frame 0 of this move (frame 137 overall) should call gunner_opengun

    // Verify initial state
    const move = gunner.monsterinfo.current_move!;
    expect(move.firstframe).toBe(137);

    // Get the frame that should trigger the sound
    const frameIndex = 0; // Relative to start of move
    const frame = move.frames[frameIndex];

    // Execute the think function for this frame
    if (frame.think) {
        if (Array.isArray(frame.think)) {
            // Not expected for this frame
        } else {
            frame.think(gunner, context.entities);
        }
    }

    expect(context.entities.engine.sound).toHaveBeenCalledWith(
        gunner,
        0,
        'gunner/gunatck1.wav',
        1,
        1,
        0
    );
  });

  it('plays gunatck2.wav during firing loop', () => {
    // Setup gunner in firing chain
    // fire_chain_move: firstframe 144
    // All frames call gunner_fire_bullet_logic

    gunner.enemy = {
        health: 100,
        origin: { x: 100, y: 0, z: 0 },
        solid: Solid.Bsp
    } as any;

    // Simulate entering fire chain
    gunner.monsterinfo.attack!(gunner);
    // Simulate end of attack_chain_move
    const attackMove = gunner.monsterinfo.current_move!;
    if (attackMove.endfunc) {
        attackMove.endfunc(gunner, context.entities);
    }

    // Now we should be in fire_chain_move
    const fireMove = gunner.monsterinfo.current_move!;
    expect(fireMove.firstframe).toBe(144);

    const frame = fireMove.frames[0];
    // Execute firing logic
    if (frame.think && !Array.isArray(frame.think)) {
        frame.think(gunner, context.entities);
    }

    expect(context.entities.engine.sound).toHaveBeenCalledWith(
        gunner,
        0,
        'gunner/gunatck2.wav',
        1,
        1,
        0
    );
  });

  it('plays gunatck3.wav when firing grenades', () => {
     // Force grenade attack
     context.entities.rng.frandom = vi.fn(() => 0.1); // < 0.5 triggers grenade

     gunner.enemy = {
        health: 100,
        origin: { x: 100, y: 0, z: 0 },
        solid: Solid.Bsp
    } as any;

     gunner.monsterinfo.attack!(gunner);

     const move = gunner.monsterinfo.current_move!;
     expect(move.firstframe).toBe(108); // attack_grenade_move

     // Frame 4 (relative) triggers grenade
     const frame = move.frames[4];

     if (frame.think && !Array.isArray(frame.think)) {
         frame.think(gunner, context.entities);
     }

     expect(context.entities.engine.sound).toHaveBeenCalledWith(
        gunner,
        0,
        'gunner/gunatck3.wav',
        1,
        1,
        0
     );
  });
});
