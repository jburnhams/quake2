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
  let entities: EntitySystem;
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

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    jorg.monsterinfo.attack(jorg);

    if (jorg.monsterinfo.current_move?.endfunc) {
        jorg.monsterinfo.current_move.endfunc(jorg, entities);
    }

    const move = jorg.monsterinfo.current_move;
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
