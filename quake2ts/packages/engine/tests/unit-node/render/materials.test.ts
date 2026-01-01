
import { describe, it, expect, beforeEach } from 'vitest';
import { MaterialManager, BlendMode } from '../../../src/render/materials.js';

describe('MaterialManager', () => {
  let manager: MaterialManager;
  let mockTexture: WebGLTexture;

  beforeEach(() => {
    manager = new MaterialManager();
    mockTexture = {} as WebGLTexture;
  });

  it('registers and retrieves a material', () => {
    manager.registerMaterial('test_mat', {
      textures: [mockTexture],
      blendMode: BlendMode.ALPHA,
    });

    const material = manager.getMaterial('test_mat');
    expect(material).toBeDefined();
    expect(material?.blendMode).toBe(BlendMode.ALPHA);
    expect(material?.texture).toBe(mockTexture);
  });

  it('handles animated textures', () => {
    const tex1 = {} as WebGLTexture;
    const tex2 = {} as WebGLTexture;

    const material = manager.registerMaterial('anim_mat', {
      textures: [tex1, tex2],
      fps: 2, // 2 frames per second => 0.5s per frame
    });

    expect(material.texture).toBe(tex1);

    // Update time less than threshold
    manager.update(0.4);
    expect(material.texture).toBe(tex1);

    // Update time past threshold
    manager.update(0.6);
    expect(material.texture).toBe(tex2);

    // Loop back
    manager.update(1.1);
    expect(material.texture).toBe(tex1);
  });

  it('calculates scroll offset', () => {
    const material = manager.registerMaterial('scroll_mat', {
      textures: [mockTexture],
      scroll: [1, 0], // Scroll X
    });

    // Initial state
    const offset = material.scrollOffset;
    expect(Math.abs(offset[0])).toBe(0);
    expect(Math.abs(offset[1])).toBe(0);

    // Update time: cycle = time * 0.25
    // time = 1.0 => cycle = 0.25
    // offset = -cycle * scroll
    manager.update(1.0);
    expect(material.scrollOffset[0]).toBeCloseTo(-0.25);
    expect(Math.abs(material.scrollOffset[1])).toBe(0);
  });

  it('clears materials', () => {
    manager.registerMaterial('temp', { textures: [] });
    expect(manager.getMaterial('temp')).toBeDefined();
    manager.clear();
    expect(manager.getMaterial('temp')).toBeUndefined();
  });
});
