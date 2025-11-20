import { describe, it, expect } from 'vitest';
import {
  MaterialManager,
  type Material,
  BlendMode,
} from '../../src/render/materials.js';

describe('MaterialManager', () => {
  it('should register and retrieve a material', () => {
    const materialManager = new MaterialManager();
    const material: Material = {
      texture: {} as WebGLTexture,
      blendMode: BlendMode.OPAQUE,
      twoSided: false,
      depthWrite: true,
    };

    materialManager.registerMaterial('test_material', material);
    const retrievedMaterial = materialManager.getMaterial('test_material');

    expect(retrievedMaterial).toBe(material);
  });

  it('should return undefined for a non-existent material', () => {
    const materialManager = new MaterialManager();
    const retrievedMaterial = materialManager.getMaterial('non_existent');
    expect(retrievedMaterial).toBeUndefined();
  });
});
