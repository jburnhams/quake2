import { vi } from 'vitest';
import { Vec3 } from '@quake2ts/shared';
import { Particle, ParticleSystem, ParticleEmitter } from '@quake2ts/engine';

// Export types
export { Particle, ParticleSystem, ParticleEmitter };

/**
 * Creates a mock Particle with default values.
 */
export function createMockParticle(overrides?: Partial<Particle>): Particle {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    color: [1, 1, 1, 1],
    size: 1,
    lifetime: 1,
    gravity: 0,
    damping: 0,
    bounce: 0,
    blendMode: 'alpha',
    fade: false,
    ...overrides,
  };
}

/**
 * Creates a mock ParticleEmitter.
 * Note: ParticleEmitter is a class in the engine, but we might want to mock it.
 * If it's just used as an interface in tests, an object literal is fine.
 * If the engine expects `instanceof ParticleEmitter`, we'd need to extend it or mock the prototype.
 * For now, assuming interface compatibility is sufficient.
 */
export function createMockParticleEmitter(overrides?: Partial<ParticleEmitter>): ParticleEmitter {
  return {
    update: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  } as unknown as ParticleEmitter;
}

/**
 * Creates a mock ParticleSystem.
 */
export function createMockParticleSystem(overrides?: Partial<ParticleSystem>): ParticleSystem {
  return {
    particles: [],
    emitters: [],
    count: 0,
    rng: {
      frandom: vi.fn().mockReturnValue(0.5), // Deterministic default
      random: vi.fn().mockReturnValue(0.5),
      seed: vi.fn(),
    },
    update: vi.fn(),
    spawn: vi.fn(),
    emit: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as ParticleSystem;
}
