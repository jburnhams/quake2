
import { describe, it, expect, vi } from 'vitest';
import { processEntityEffects } from '@quake2ts/client/effects.js';
import { EntityEffects, Vec3 } from '@quake2ts/shared';
import { DLight } from '@quake2ts/engine';

describe('processEntityEffects', () => {
    it('should add red light for EF_FLAG1', () => {
        const ent = {
            effects: EntityEffects.Flag1,
            renderfx: 0,
            origin: { x: 0, y: 0, z: 0 }
        };
        const dlights: DLight[] = [];
        const time = 100;

        processEntityEffects(ent, dlights, time);

        expect(dlights).toHaveLength(1);
        expect(dlights[0].color).toEqual({ x: 1.0, y: 0.2, z: 0.2 });
        // Flickering intensity around 200 +/- 20
        expect(dlights[0].intensity).toBeGreaterThan(170);
        expect(dlights[0].intensity).toBeLessThan(230);
    });

    it('should add blue light for EF_FLAG2', () => {
        const ent = {
            effects: EntityEffects.Flag2,
            renderfx: 0,
            origin: { x: 0, y: 0, z: 0 }
        };
        const dlights: DLight[] = [];
        const time = 100;

        processEntityEffects(ent, dlights, time);

        expect(dlights).toHaveLength(1);
        expect(dlights[0].color).toEqual({ x: 0.2, y: 0.2, z: 1.0 });
        // Flickering intensity around 200 +/- 20
        expect(dlights[0].intensity).toBeGreaterThan(170);
        expect(dlights[0].intensity).toBeLessThan(230);
    });
});
