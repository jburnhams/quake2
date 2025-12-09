import { describe, expect, it } from 'vitest';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  ParticleRenderer,
  ParticleSystem,
  spawnBlood,
  spawnBulletImpact,
  spawnExplosion,
  spawnMuzzleFlash,
  spawnTeleportFlash,
  spawnTrail,
} from '../src/render/particleSystem.js';
import { createMockGL } from './helpers/mockWebGL.js';

function constantRandom(value: number): () => number {
  return () => value;
}

describe('ParticleSystem simulation', () => {
  it('integrates gravity, damping, and floor collision', () => {
    const system = new ParticleSystem(2, constantRandom(0.5));
    const first = system.spawn({
      position: { x: 0, y: 0, z: 1 },
      velocity: { x: 1, y: 0, z: 0 },
      lifetime: 1,
      gravity: 10,
      damping: 1,
      fade: true,
    });
    const second = system.spawn({
      position: { x: 0, y: 0, z: 0.1 },
      velocity: { x: 0, y: 0, z: -5 },
      lifetime: 1,
      gravity: 0,
      bounce: 0.5,
    });

    expect(first).toBe(0);
    expect(second).toBe(1);

    system.update(0.2, { floorZ: 0 });

    const firstState = system.getState(first!);
    expect(firstState.position.x).toBeCloseTo(0.16, 3);
    expect(firstState.position.z).toBeCloseTo(0.6, 3);
    expect(firstState.velocity.x).toBeCloseTo(0.8, 3);
    expect(firstState.velocity.z).toBeCloseTo(-2, 3);
    expect(firstState.remaining).toBeCloseTo(0.8, 3);

    const secondState = system.getState(second!);
    expect(secondState.position.z).toBe(0);
    expect(secondState.velocity.z).toBeCloseTo(2.5, 3);
    expect(system.aliveCount()).toBe(2);
  });

  it('expires particles and reuses pool slots', () => {
    const system = new ParticleSystem(1, constantRandom(0.1));
    const first = system.spawn({ position: { x: 0, y: 0, z: 0 }, lifetime: 0.5 });
    expect(first).toBe(0);

    system.update(0.6);
    expect(system.getState(0).alive).toBe(false);

    const second = system.spawn({ position: { x: 1, y: 2, z: 3 }, lifetime: 0.5, color: [1, 0, 0, 1] });
    expect(second).toBe(0);
    const state = system.getState(0);
    expect(state.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(state.color[0]).toBe(1);
  });
});

describe('ParticleSystem rendering data', () => {
  it('builds billboard quads grouped by blend mode with fading alpha', () => {
    const system = new ParticleSystem(2, constantRandom(0.5));
    system.spawn({
      position: { x: 0, y: 0, z: 0 },
      size: 2,
      lifetime: 2,
      gravity: 0,
      fade: true,
      blendMode: 'alpha',
    });
    system.spawn({
      position: { x: 2, y: 0, z: 0 },
      size: 4,
      lifetime: 1,
      gravity: 0,
      blendMode: 'additive',
    });

    system.update(0.5, { floorZ: -Infinity });
    const mesh = system.buildMesh({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

    expect(mesh.batches).toHaveLength(2);
    expect(mesh.batches[0]).toMatchObject({ blendMode: 'alpha', count: 6, start: 0 });
    expect(mesh.batches[1]).toMatchObject({ blendMode: 'additive', count: 6, start: 6 });
    expect(mesh.indices).toHaveLength(12);

    const firstVertex = Array.from(mesh.vertices.slice(0, 9));
    expect(firstVertex[0]).toBeCloseTo(-1); // x of bottom-left corner
    expect(firstVertex[1]).toBeCloseTo(-1); // y of bottom-left corner
    expect(firstVertex[2]).toBeCloseTo(0);
    expect(firstVertex[8]).toBeCloseTo(0.75); // alpha faded by lifetime

    const additiveStart = 9 * 4; // second particle first vertex
    expect(mesh.vertices[additiveStart + 0]).toBeCloseTo(0); // x of bottom-left corner for second particle
    expect(mesh.vertices[additiveStart + 1]).toBeCloseTo(-2);
    expect(mesh.vertices[additiveStart + 8]).toBeCloseTo(1);
  });

  it('renders batches with correct blend state changes', () => {
    const gl = createMockGL();
    const system = new ParticleSystem(2, constantRandom(0.5));
    system.spawn({ position: { x: 0, y: 0, z: 0 }, lifetime: 1, gravity: 0, blendMode: 'alpha' });
    system.spawn({ position: { x: 1, y: 0, z: 0 }, lifetime: 1, gravity: 0, blendMode: 'additive' });

    const renderer = new ParticleRenderer(gl as unknown as WebGL2RenderingContext, system);
    renderer.render({
      viewProjection: new Float32Array(16),
      viewRight: { x: 1, y: 0, z: 0 },
      viewUp: { x: 0, y: 1, z: 0 },
    });

    expect(gl.calls).toContain('blendFuncSeparate:770:771:1:771');
    expect(gl.calls).toContain('blendFunc:770:1');
    expect(gl.calls).toContain('drawElements:4:6:5123:0');
    expect(gl.calls).toContain('drawElements:4:6:5123:12');

    renderer.dispose();
  });
});

describe('particle effects', () => {
  it('spawns deterministic counts for canned effects', () => {
    const system = new ParticleSystem(120, constantRandom(0.5));
    spawnBulletImpact({ system, origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } });
    expect(system.aliveCount()).toBe(20);

    spawnExplosion({ system, origin: { x: 0, y: 0, z: 0 } });
    expect(system.aliveCount()).toBe(76);

    spawnBlood({ system, origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } });
    expect(system.aliveCount()).toBe(100);

    spawnTeleportFlash({ system, origin: { x: 0, y: 0, z: 0 } });
    expect(system.aliveCount()).toBe(120);

    // muzzle flash and trail should not exceed pool and should reuse slots if necessary
    spawnMuzzleFlash({ system, origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } });
    spawnTrail({ system, origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } });
    expect(system.aliveCount()).toBeLessThanOrEqual(120);

    const firstState = system.getState(0);
    expect(firstState.blendMode).toBe('additive');
    expect(firstState.color[0]).toBeGreaterThan(0.9);
  });

  it('exposes shader sources for renderer wiring', () => {
    expect(PARTICLE_VERTEX_SHADER).toContain('u_viewProjection');
    expect(PARTICLE_FRAGMENT_SHADER).toContain('smoothstep');
  });
});
