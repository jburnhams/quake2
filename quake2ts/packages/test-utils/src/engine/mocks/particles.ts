import { vi } from 'vitest';
import { Vec3 } from '@quake2ts/shared';
import { ParticleSystem } from '@quake2ts/engine';

// Mock types since Particle/ParticleEmitter are not exported
export interface MockParticle {
  position: Vec3;
  velocity: Vec3;
  color: [number, number, number, number];
  size: number;
  lifetime: number;
  gravity: number;
  damping: number;
  bounce: number;
  blendMode: 'alpha' | 'additive';
  fade: boolean;
}

export interface MockParticleEmitter {
  update: (dt: number) => void;
  emit: () => void;
}

// Export types
export { ParticleSystem };

/**
 * Creates a mock Particle with default values.
 */
export function createMockParticle(overrides?: Partial<MockParticle>): MockParticle {
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
 */
export function createMockParticleEmitter(overrides?: Partial<MockParticleEmitter>): MockParticleEmitter {
  return {
    update: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock ParticleSystem.
 */
export function createMockParticleSystem(overrides?: Partial<ParticleSystem>): ParticleSystem {
  return {
    maxParticles: 1000,
    rng: {
      frandom: vi.fn().mockReturnValue(0.5), // Deterministic default
      random: vi.fn().mockReturnValue(0.5),
      seed: vi.fn(),
    },
    update: vi.fn(),
    spawn: vi.fn(),
    killAll: vi.fn(),
    aliveCount: vi.fn().mockReturnValue(0),
    getState: vi.fn(),
    buildMesh: vi.fn(),
    ...overrides,
  } as unknown as ParticleSystem;
}
