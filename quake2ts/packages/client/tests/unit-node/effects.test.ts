import { describe, it, expect, vi } from 'vitest';
import { processEntityEffects } from '@quake2ts/client/effects.js';
import { EntityEffects, Vec3 } from '@quake2ts/shared';
import { DLight } from '@quake2ts/engine';

describe('processEntityEffects', () => {
  it('should add lights for rocket projectiles', () => {
    const dlights: DLight[] = [];
    const ent = {
        effects: EntityEffects.Rocket,
        renderfx: 0,
        origin: { x: 10, y: 10, z: 10 }
    };
    processEntityEffects(ent, dlights, 10.0);

    expect(dlights).toHaveLength(1);
    expect(dlights[0].intensity).toBe(200);
    expect(dlights[0].color).toEqual({ x: 1.0, y: 0.5, z: 0.2 });
  });

  it('should add lights for BFG projectiles', () => {
    const dlights: DLight[] = [];
    const ent = {
        effects: EntityEffects.Bfg,
        renderfx: 0,
        origin: { x: 10, y: 10, z: 10 }
    };
    processEntityEffects(ent, dlights, 10.0);

    expect(dlights).toHaveLength(1);
    expect(dlights[0].intensity).toBe(300);
    expect(dlights[0].color).toEqual({ x: 0.1, y: 1.0, z: 0.1 });
  });

  it('should add lights for blue hyperblaster', () => {
    const dlights: DLight[] = [];
    const ent = {
        effects: EntityEffects.Bluehyperblaster,
        renderfx: 0,
        origin: { x: 10, y: 10, z: 10 }
    };
    processEntityEffects(ent, dlights, 10.0);

    expect(dlights).toHaveLength(1);
    expect(dlights[0].color).toEqual({ x: 0.2, y: 0.2, z: 1.0 });
  });
});
