
import { describe, it, expect, vi } from 'vitest';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import { runStep } from '../../../src/physics/movement.js';
import { createTestContext, createMonsterEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Monster Fall Damage', () => {
  it('should apply damage when a monster falls', () => {
    const context = createTestContext();
    const sys = context.entities;

    // Mock findInBox which is used by runStep -> checkTriggers
    if (sys && !sys.findInBox) {
        sys.findInBox = vi.fn().mockReturnValue([]);
    }

    // Create a monster entity
    const monsterData = createMonsterEntityFactory('monster_test', {
      solid: Solid.BBox,
      movetype: MoveType.Step,
      health: 100,
      max_health: 100,
      takedamage: true,
      flags: 0, // Not flying or swimming
      origin: { x: 0, y: 0, z: 200 },
      velocity: { x: 0, y: 0, z: -1000 }, // Falling fast
      gravityVector: { x: 0, y: 0, z: -1 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 }
    });

    const monster = spawnEntity(sys, monsterData);

    // Mock trace to simulate hitting ground
    sys.trace = (start, mins, maxs, end, passEntity, contentMask) => {
        if (start.z > 0 && end.z < 0) {
            const fraction = (start.z - 0) / (start.z - end.z);
            return {
                allsolid: false,
                startsolid: false,
                fraction: fraction,
                endpos: { x: start.x, y: start.y, z: 0 },
                plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
                ent: { linkcount: 1, solid: Solid.Bsp } as any
            };
        }
        return {
            allsolid: false,
            startsolid: false,
            fraction: 1.0,
            endpos: end,
            ent: null
        };
    };

    const imports = {
        trace: sys.trace,
        linkentity: vi.fn(),
        pointcontents: () => 0,
    };

    // We need to position monster close enough to hit ground in one frame
    monster.origin.z = 50;
    const gravity = { x: 0, y: 0, z: -800 };
    const frametime = 0.1;

    // Run physics step
    runStep(monster, sys, imports as any, gravity, frametime);

    // Expect velocity.z to be 0 (stopped on ground)
    expect(monster.velocity.z).toBe(0);

    // Expect health to be reduced
    // initial 100.
    // velocity -1000 -> delta ~100 -> damage > 0.
    expect(monster.health).toBeLessThan(100);
  });
});
