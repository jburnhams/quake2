import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_jorg } from '../../../src/entities/monsters/jorg.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, MoveType, Solid, DamageMod } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import * as attackModule from '../../../src/entities/monsters/attack.js';
import * as rogueAi from '../../../src/ai/rogue.js';

// Mock attack module
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_bullet_v2: vi.fn(),
  monster_fire_bfg: vi.fn(),
}));

// Spy on rogue AI module instead of mocking it directly to ensure exports work
// But since we want to return a value, we can use vi.spyOn if the module is imported
// or vi.mock if we want to replace it entirely.
// The issue "Cannot destructure property 'aimdir' of 'PredictAim(...)' as it is undefined" suggests the mock isn't returning what we expect.

vi.mock('../../../src/ai/rogue.js', () => ({
  PredictAim: vi.fn(),
}));

describe('monster_jorg', () => {
  let context: any; // SpawnContext
  let entities: any;
  let jorg: Entity;

  beforeEach(() => {
    vi.clearAllMocks();

    // Configure PredictAim mock return value
    (rogueAi.PredictAim as any).mockReturnValue({
        aimdir: { x: 1, y: 0, z: 0 },
        aimpoint: { x: 100, y: 0, z: 0 }
    });

    context = createTestContext();
    entities = context.entities;
    jorg = entities.spawn();
    SP_monster_jorg(jorg, context);
  });

  it('should spawn with correct properties', () => {
    expect(jorg.classname).toBe('monster_jorg');
    expect(jorg.health).toBe(3000);
    expect(jorg.max_health).toBe(3000);
    expect(jorg.movetype).toBe(MoveType.Step);
    expect(jorg.solid).toBe(Solid.BoundingBox);
  });

  it('should use PredictAim when firing bullets (Attack 1 Loop)', () => {
    const enemy = entities.spawn();
    enemy.origin = { x: 200, y: 0, z: 0 };
    enemy.viewheight = 20;
    jorg.enemy = enemy;

    // Use mock RNG
    vi.spyOn(entities.rng, 'frandom').mockReturnValue(0.1);

    // Initial attack selection
    jorg.monsterinfo.attack(jorg, entities);

    // jorg_attack sets current_move to attack1_move or attack2_move
    // based on random <= 0.75.
    // 0.1 <= 0.75 -> attack1_move (start_attack1 in C)
    // Wait, in my updated jorg.ts, attack1_move is the loop?
    // Let's check jorg.ts
    // jorg_attack sets attack1_move.
    // attack1_move is the loop frames directly?
    // attack1_move = { firstframe: 73, ... frames: attack1_frames ... }
    // attack1_frames has think: jorg_fire_bullet.

    // But wait, there is attack1_start_move which chains to attack1_move.
    // In jorg.ts:
    // attack1_start_move: frames 65-72
    // attack1_move: frames 73-78, think: jorg_fire_bullet.

    // jorg_attack sets current_move = attack1_move?
    // In jorg.ts:
    // if (Math.random() <= 0.75) { ... self.monsterinfo.current_move = attack1_move; }
    // I mapped it directly to the loop for simplicity in the port or maybe missed the start phase usage?
    // In jorg.ts: `self.monsterinfo.current_move = attack1_move;`
    // So it skips start?
    // Ah, wait. `attack1_start_move` exists but is it used?
    // `const attack1_start_move` is defined but only endfunc is set.
    // `jorg_attack` sets `attack1_move`.

    // Okay, so current_move IS attack1_move.
    // Frames are 6.
    // Frame 0 has think `jorg_fire_bullet`.

    const move = jorg.monsterinfo.current_move;
    expect(move).toBeDefined();

    const frame = move?.frames[0];
    expect(frame?.think).toBeDefined();

    frame?.think?.(jorg, entities);

    expect(rogueAi.PredictAim).toHaveBeenCalled();
    expect(rogueAi.PredictAim).toHaveBeenCalledTimes(2);

    const calls = (rogueAi.PredictAim as any).mock.calls;
    const offsets = calls.map((c: any) => c[6]);
    expect(offsets).toContain(0.2);
    expect(offsets).toContain(-0.2);

    expect(attackModule.monster_fire_bullet_v2).toHaveBeenCalledTimes(2);
  });
});
