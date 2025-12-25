import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientEffectSystem, EntityProvider } from '../src/effects-system.js';
import { EngineImports, Renderer, ParticleSystem, spawnBulletImpact, spawnBlood, spawnExplosion, spawnMuzzleFlash, spawnSplash, spawnSteam } from '@quake2ts/engine';
import { TempEntity, Vec3, MZ_BLASTER } from '@quake2ts/shared';
import { createMockDLightManager } from '@quake2ts/test-utils';

// Mock engine dependencies
const mockRenderer = {
  particleSystem: {
    spawn: vi.fn(),
    update: vi.fn(),
    rng: {
        frandom: () => 0.5
    }
  } as unknown as ParticleSystem
} as unknown as Renderer;

const mockAudio = {
  soundindex: vi.fn().mockReturnValue(1),
  positioned_sound: vi.fn(),
  sound: vi.fn()
};

const mockEngine = {
  audio: mockAudio,
  renderer: mockRenderer
} as unknown as EngineImports;

const mockDLightManager = createMockDLightManager();

const mockEntityProvider: EntityProvider = {
  getEntity: vi.fn(),
  getPlayerNum: vi.fn().mockReturnValue(0)
};

// Mock the helper functions from engine
vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@quake2ts/engine')>();
    return {
        ...actual,
        spawnBulletImpact: vi.fn(),
        spawnBlood: vi.fn(),
        spawnExplosion: vi.fn(),
        spawnMuzzleFlash: vi.fn(),
        spawnSplash: vi.fn(),
        spawnSteam: vi.fn(),
    };
});

describe('ClientEffectSystem Integration', () => {
  let system: ClientEffectSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    system = new ClientEffectSystem(mockDLightManager, mockEngine, mockEntityProvider);
  });

  it('should trigger spawnBulletImpact for GUNSHOT temp entity', () => {
    const pos: Vec3 = { x: 10, y: 20, z: 30 };
    const dir: Vec3 = { x: 0, y: 0, z: 1 };

    system.onTempEntity(TempEntity.GUNSHOT, pos, 0, dir);

    expect(spawnBulletImpact).toHaveBeenCalledWith(expect.objectContaining({
        system: mockRenderer.particleSystem,
        origin: pos,
        normal: dir
    }));
  });

  it('should trigger spawnBlood for BLOOD temp entity', () => {
    const pos: Vec3 = { x: 10, y: 20, z: 30 };
    const dir: Vec3 = { x: 0, y: 0, z: 1 };

    system.onTempEntity(TempEntity.BLOOD, pos, 0, dir);

    expect(spawnBlood).toHaveBeenCalledWith(expect.objectContaining({
        system: mockRenderer.particleSystem,
        origin: pos,
        direction: dir
    }));
  });

  it('should trigger spawnExplosion for EXPLOSION1 temp entity', () => {
    const pos: Vec3 = { x: 10, y: 20, z: 30 };

    system.onTempEntity(TempEntity.EXPLOSION1, pos, 0);

    expect(spawnExplosion).toHaveBeenCalledWith(expect.objectContaining({
        system: mockRenderer.particleSystem,
        origin: pos
    }));
  });

  it('should trigger spawnMuzzleFlash on weapon fire', () => {
      const entNum = 1;
      const weapon = MZ_BLASTER;
      const origin = { x: 0, y: 0, z: 0 };
      const angles = { x: 0, y: 0, z: 0 };

      // Mock entity provider to return an entity
      (mockEntityProvider.getEntity as any).mockReturnValue({
          origin,
          angles
      });

      system.onMuzzleFlash(entNum, weapon, 0);

      expect(spawnMuzzleFlash).toHaveBeenCalledWith(expect.objectContaining({
          system: mockRenderer.particleSystem,
          // direction matches angleVectors(0,0,0).forward which is {x:1, y:0, z:0}
          direction: expect.objectContaining({ x: 1 })
      }));
  });

  it('should trigger spawnSplash for SPLASH temp entity', () => {
      const pos: Vec3 = { x: 10, y: 20, z: 30 };
      const dir: Vec3 = { x: 0, y: 0, z: 1 };

      system.onTempEntity(TempEntity.SPLASH, pos, 0, dir);

      expect(spawnSplash).toHaveBeenCalledWith(expect.objectContaining({
          system: mockRenderer.particleSystem,
          origin: pos,
          normal: dir
      }));
  });

  it('should trigger spawnSteam for STEAM temp entity', () => {
      const pos: Vec3 = { x: 10, y: 20, z: 30 };

      system.onTempEntity(TempEntity.STEAM, pos, 0);

      expect(spawnSteam).toHaveBeenCalledWith(expect.objectContaining({
          system: mockRenderer.particleSystem,
          origin: pos
      }));
  });
});
