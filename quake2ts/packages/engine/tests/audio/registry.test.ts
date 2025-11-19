import { describe, expect, it } from 'vitest';
import { SoundRegistry } from '../../src/audio/registry.js';
import { createBuffer } from './fakes.js';

describe('SoundRegistry', () => {
  it('registers sounds through the configstring registry and caches buffers', () => {
    const registry = new SoundRegistry();
    const first = registry.register('world/ambience/windfly.wav', createBuffer(1.2));
    const second = registry.register('world/ambience/windfly.wav', createBuffer(1.2));
    const third = registry.register('weapons/railgf1a.wav', createBuffer(0.7));

    expect(first).toBe(second);
    expect(third).toBeGreaterThan(first);
    expect(registry.get(first)?.duration).toBeCloseTo(1.2);
    expect(registry.has(third)).toBe(true);
  });
});
