import { describe, test, expect } from 'vitest';
import { resolveSurfaceTextures } from '../../../../src/render/utils/textures.js';
import type { BspSurfaceGeometry } from '../../../../src/render/bsp.js';
import type { MaterialManager } from '../../../../src/render/materials.js';

// Mock types for testing
type MockTexture = { id: string };

describe('Texture Resolution Utilities', () => {
  describe('resolveSurfaceTextures', () => {
    test('resolves texture from material manager', () => {
      const geometry = {
        texture: 'test-texture',
      } as BspSurfaceGeometry;

      const mockTexture = { id: 'material-texture' };
      const materials = {
        getMaterial: (name: string) => ({
          texture: mockTexture as any,
        }),
      } as MaterialManager;

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        materials,
        undefined,
        undefined
      );

      expect(result.diffuse).toEqual(mockTexture);
    });

    test('falls back to texture map when material not found', () => {
      const geometry = {
        texture: 'test-texture',
      } as BspSurfaceGeometry;

      const mockTexture = { id: 'static-texture' };
      const textures = new Map([['test-texture', mockTexture]]);

      const materials = {
        getMaterial: () => undefined,
      } as MaterialManager;

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        materials,
        textures,
        undefined
      );

      expect(result.diffuse).toEqual(mockTexture);
    });

    test('falls back to texture map when materials is undefined', () => {
      const geometry = {
        texture: 'test-texture',
      } as BspSurfaceGeometry;

      const mockTexture = { id: 'static-texture' };
      const textures = new Map([['test-texture', mockTexture]]);

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        undefined,
        textures,
        undefined
      );

      expect(result.diffuse).toEqual(mockTexture);
    });

    test('resolves lightmap from atlas index', () => {
      const geometry = {
        texture: 'test-texture',
        lightmap: {
          atlasIndex: 1,
          offset: [0, 0] as [number, number],
          scale: [1, 1] as [number, number],
        },
      } as BspSurfaceGeometry;

      const lightmap0 = { texture: { id: 'lightmap-0' } };
      const lightmap1 = { texture: { id: 'lightmap-1' } };
      const lightmaps = [lightmap0, lightmap1];

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        undefined,
        undefined,
        lightmaps
      );

      expect(result.lightmap).toEqual(lightmap1.texture);
    });

    test('returns undefined lightmap when no atlas index', () => {
      const geometry = {
        texture: 'test-texture',
      } as BspSurfaceGeometry;

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        undefined,
        undefined,
        [{ texture: { id: 'lightmap' } }]
      );

      expect(result.lightmap).toBeUndefined();
    });

    test('includes refraction texture when provided', () => {
      const geometry = {
        texture: 'test-texture',
      } as BspSurfaceGeometry;

      const refractionTexture = { id: 'refraction' };

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        undefined,
        undefined,
        undefined,
        refractionTexture
      );

      expect(result.refraction).toEqual(refractionTexture);
    });

    test('returns all undefined when nothing is available', () => {
      const geometry = {
        texture: 'missing-texture',
      } as BspSurfaceGeometry;

      const result = resolveSurfaceTextures<MockTexture>(
        geometry,
        undefined,
        new Map(),
        undefined
      );

      expect(result.diffuse).toBeUndefined();
      expect(result.lightmap).toBeUndefined();
      expect(result.refraction).toBeUndefined();
    });
  });
});
