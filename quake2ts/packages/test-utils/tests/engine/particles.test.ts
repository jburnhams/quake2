import { describe, it, expect, vi } from 'vitest';
import { createMockParticle, createMockParticleEmitter, createMockParticleSystem } from '../../src/engine/mocks/particles';

describe('Particle Mocks', () => {
  describe('createMockParticle', () => {
    it('should create a particle with defaults', () => {
      const p = createMockParticle();
      expect(p.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(p.lifetime).toBe(1);
    });

    it('should allow overrides', () => {
      const p = createMockParticle({ size: 10 });
      expect(p.size).toBe(10);
    });
  });

  describe('createMockParticleEmitter', () => {
    it('should create an emitter', () => {
      const emitter = createMockParticleEmitter();
      expect(emitter.emit).toBeDefined();
    });
  });

  describe('createMockParticleSystem', () => {
    it('should create a system with mocked RNG', () => {
      const sys = createMockParticleSystem();
      expect(sys.rng.frandom()).toBe(0.5);
    });

    it('should allow method spying', () => {
      const spawn = vi.fn();
      const sys = createMockParticleSystem({ spawn });

      sys.spawn(createMockParticle());
      expect(spawn).toHaveBeenCalled();
    });
  });
});
