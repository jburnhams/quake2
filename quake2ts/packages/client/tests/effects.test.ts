import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEntityEffects } from '../src/effects.js';
import { EntityEffects, Vec3 } from '@quake2ts/shared';
import { DLight, ParticleSystem, spawnBlood } from '@quake2ts/engine';

vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@quake2ts/engine')>();
    return {
        ...actual,
        spawnBlood: vi.fn(),
    };
});

describe('processEntityEffects', () => {
  const mockParticleSystem = {
      spawn: vi.fn(),
      rng: {
          frandom: () => 0.5
      }
  } as unknown as ParticleSystem;

  beforeEach(() => {
      vi.clearAllMocks();
  });

  it('should add lights for rocket projectiles', () => {
    const dlights: DLight[] = [];
    const ent = {
        effects: EntityEffects.Rocket,
        renderfx: 0,
        origin: { x: 10, y: 10, z: 10 }
    };
    processEntityEffects(ent, dlights, undefined, 10.0);

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
    processEntityEffects(ent, dlights, undefined, 10.0);

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
    processEntityEffects(ent, dlights, undefined, 10.0);

    expect(dlights).toHaveLength(1);
    expect(dlights[0].color).toEqual({ x: 0.2, y: 0.2, z: 1.0 });
  });

  it('should spawn blood trail for EF_GIB', () => {
      const dlights: DLight[] = [];
      const ent = {
          effects: EntityEffects.Gib,
          renderfx: 0,
          origin: { x: 50, y: 50, z: 50 }
      };

      processEntityEffects(ent, dlights, mockParticleSystem, 10.0);

      expect(spawnBlood).toHaveBeenCalledWith(expect.objectContaining({
          system: mockParticleSystem,
          origin: ent.origin
      }));
  });

  it('should spawn green blood trail for EF_GREENGIBS', () => {
      const dlights: DLight[] = [];
      const ent = {
          effects: EntityEffects.Greengibs,
          renderfx: 0,
          origin: { x: 60, y: 60, z: 60 }
      };

      processEntityEffects(ent, dlights, mockParticleSystem, 10.0);

      expect(spawnBlood).toHaveBeenCalledWith(expect.objectContaining({
          system: mockParticleSystem,
          origin: ent.origin,
          color: [0.0, 0.8, 0.0, 0.95]
      }));
  });
});
