import { describe, expect, it } from 'vitest';
import { SoundRegistry } from '../../../src/audio/registry.js';
import { createMockAudioBuffer } from '@quake2ts/test-utils';

describe('SoundRegistry', () => {
  it('registers sounds through the configstring registry and caches buffers', () => {
    const registry = new SoundRegistry();
    const first = registry.register('world/ambience/windfly.wav', createMockAudioBuffer(1.2));
    const second = registry.register('world/ambience/windfly.wav', createMockAudioBuffer(1.2));
    const third = registry.register('weapons/railgf1a.wav', createMockAudioBuffer(0.7));

    expect(first).toBe(second);
    expect(third).toBeGreaterThan(first);
    expect(registry.get(first)?.duration).toBeCloseTo(1.2);
    expect(registry.has(third)).toBe(true);
  });

  it('tracks sound indices registered without buffers and fills them later', () => {
    const registry = new SoundRegistry();
    const placeholder = registry.registerName('player/pain100_1.wav');
    expect(registry.has(placeholder)).toBe(false);
    expect(registry.find('player/pain100_1.wav')).toBe(placeholder);

    registry.register('player/pain100_1.wav', createMockAudioBuffer(0.5));
    expect(registry.has(placeholder)).toBe(true);
  });
});
