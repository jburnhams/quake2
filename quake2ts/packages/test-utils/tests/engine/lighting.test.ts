import { describe, it, expect, vi } from 'vitest';
import { createMockDLight, createMockDLightManager, createMockLightmap } from '../../src/engine/mocks/lighting';

describe('Lighting Mocks', () => {
  describe('createMockDLight', () => {
    it('should create a DLight with defaults', () => {
      const light = createMockDLight();
      expect(light.intensity).toBe(300);
      expect(light.origin).toEqual({ x: 0, y: 0, z: 0 });
      expect(light.color).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should accept custom values', () => {
      const pos = { x: 10, y: 20, z: 30 };
      const color = { x: 0.5, y: 0, z: 0 };
      const light = createMockDLight(pos, color, 500);

      expect(light.origin).toEqual(pos);
      expect(light.color).toEqual(color);
      expect(light.intensity).toBe(500);
    });
  });

  describe('createMockDLightManager', () => {
    it('should create a mocked manager', () => {
      const manager = createMockDLightManager();
      expect(manager.addLight).toBeDefined();
      expect(manager.getActiveLights).toBeDefined();
    });

    it('should allow method overrides', () => {
      const addLight = vi.fn();
      const manager = createMockDLightManager({ addLight });

      manager.addLight(createMockDLight(), 0);
      expect(addLight).toHaveBeenCalled();
    });
  });

  describe('createMockLightmap', () => {
    it('should create lightmap data', () => {
      const lm = createMockLightmap(64, 64);
      expect(lm.width).toBe(64);
      expect(lm.height).toBe(64);
      expect(lm.data.length).toBe(64 * 64 * 3);
    });
  });
});
