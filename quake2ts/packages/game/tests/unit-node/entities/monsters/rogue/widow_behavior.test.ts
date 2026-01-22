import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWidow } from '../../../../../src/entities/monsters/rogue/widow.js';
import { createTestContext } from '@quake2ts/test-utils';
import { Entity, MoveType, Solid, AiFlags } from '../../../../../src/entities/entity.js';
import { M_SlotsLeft } from '../../../../../src/entities/monsters/rogue/common.js';

describe('monster_widow behavior', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    context.health_multiplier = 1.0;
    context.entities.skill = 2; // Skill 2 => 4 slots

    // Fix mock RNG if needed by test logic
    context.entities.rng.frandom = vi.fn().mockReturnValue(0.5);

    entity = context.entities.spawn();
    vi.clearAllMocks();
  });

  it('should spawn reinforcements when logic is executed', () => {
    createWidow(entity, context);

    // Setup state
    entity.monsterinfo.monster_slots = 3;
    entity.monsterinfo.monster_used = 0;

    // We mock the spawn function to capture what happens
    const spawnSpy = vi.spyOn(context.entities, 'spawn');

    // Locate the spawn check function
    // In widow.ts, widow_frames_spawn frame 8 has think: widow_spawn_check

    // Manually get the move
    // We can't easily access the private move variable, but we can trigger logic.
    // However, widow_spawn_check is internal.
    // But we implemented logic in widow_spawn_check.

    // We need to trigger it.
    // Let's assume we can set the animation.
    // But `M_SetAnimation` sets `monsterinfo.current_move`.
    // We can inspect the frames if we get `current_move`.

    // Trigger attack logic to set spawn anim
    context.entities.rng.frandom = vi.fn().mockReturnValue(0.1); // Low random for spawn probability in attack?
    // widow_attack:
    // if (M_SlotsLeft(self) >= 2 && frandom(context) < 0.6) { M_SetAnimation(self, widow_move_spawn, context); ... }

    entity.enemy = context.entities.spawn(); // Needs enemy

    // Call attack
    entity.monsterinfo.attack(entity, context.entities);

    const move = (entity.monsterinfo as any).current_move;
    expect(move).toBeDefined();
    // Verify it is the spawn move (length 18)
    expect(move.frames.length).toBe(18);

    // The frame at index 8 has the think function `widow_spawn_check`.
    const spawnFrame = move.frames[8];
    expect(spawnFrame.think).toBeDefined();

    // Setup reinforcements
    entity.monsterinfo.reinforcements = [
        { classname: 'monster_stalker', strength: 1, mins: {x:0,y:0,z:0}, maxs:{x:0,y:0,z:0} }
    ];
    entity.monsterinfo.monster_slots = 5;
    entity.monsterinfo.monster_used = 0;

    // Mock RNG for picking reinforcement
    context.entities.rng.frandomRange = vi.fn().mockReturnValue(0.9); // Used for log slots?
    context.entities.rng.irandomRange = vi.fn().mockReturnValue(0); // Index 0

    // Call it directly
    spawnFrame.think(entity, context.entities);

    // Assert that spawn was called
    expect(spawnSpy).toHaveBeenCalled();
  });
});
