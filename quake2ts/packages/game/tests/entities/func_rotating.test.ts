import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SP_func_rotating } from '../../src/entities/funcs.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import { createEntityFactory } from '@quake2ts/test-utils';
import * as damageModule from '../../src/combat/damage.js';

// Mock T_Damage
vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

describe('func_rotating', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;

    beforeEach(async () => {
        context = await createTestContext();
        sys = context.entities;
        vi.clearAllMocks();
    });

    it('initializes correctly', () => {
        const ent = createEntityFactory({
            classname: 'func_rotating',
            speed: 100,
            model: '*1'
        });

        SP_func_rotating(ent, { entities: sys } as any);

        expect(ent.movetype).toBe(MoveType.Push);
        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.avelocity.z).toBe(100);
    });

    it('sets angular velocity based on spawnflags', () => {
        const ent = createEntityFactory({
            classname: 'func_rotating',
            speed: 100,
            spawnflags: 4 // X-Axis
        });

        SP_func_rotating(ent, { entities: sys } as any);

        expect(ent.avelocity.x).toBe(100);
        expect(ent.avelocity.y).toBe(0);
        expect(ent.avelocity.z).toBe(0);
    });

    it('inflicts pain on blocked', () => {
        const ent = createEntityFactory({
            classname: 'func_rotating',
            dmg: 10
        });

        SP_func_rotating(ent, { entities: sys } as any);

        expect(ent.blocked).toBeDefined();

        const victim = createEntityFactory({
            classname: 'player',
            health: 100,
            takedamage: true
        });

        if (ent.blocked) {
             ent.blocked(ent, victim, sys);
        }

        // Ensure damage is applied directly to health
        expect(victim.health).toBe(90);
    });
});
