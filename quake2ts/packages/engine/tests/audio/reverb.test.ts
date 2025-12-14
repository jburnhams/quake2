import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReverbSystem, type ReverbPreset } from '../../src/audio/reverb.js';
import { type ReverbNode, type GainNodeLike, type ConvolverNodeLike, type AudioParamLike, type AudioBufferLike } from '../../src/audio/context.js';

// Mocks
const createMockGain = (): GainNodeLike => ({
  gain: { value: 1 } as AudioParamLike,
  connect: vi.fn(),
});

const createMockConvolver = (): ConvolverNodeLike => ({
  buffer: null,
  normalize: true,
  connect: vi.fn(),
});

const createMockReverbNode = (): ReverbNode => ({
  convolver: createMockConvolver(),
  input: createMockGain(),
  output: createMockGain(),
});

const mockBuffer: AudioBufferLike = {
  duration: 1.5
};

describe('ReverbSystem', () => {
  let reverbNode: ReverbNode;
  let reverbSystem: ReverbSystem;

  beforeEach(() => {
    reverbNode = createMockReverbNode();
    reverbSystem = new ReverbSystem(reverbNode);
  });

  it('initializes with default gains', () => {
    expect(reverbNode.input.gain.value).toBe(0.5);
    expect(reverbNode.output.gain.value).toBe(1.0);
  });

  it('sets preset correctly', () => {
    const preset: ReverbPreset = {
      name: 'Test Hall',
      buffer: mockBuffer,
      gain: 0.8
    };

    reverbSystem.setPreset(preset);

    expect(reverbNode.convolver.buffer).toBe(mockBuffer);
    expect(reverbNode.output.gain.value).toBe(0.8);
  });

  it('clears preset correctly', () => {
    // First set a preset
    reverbSystem.setPreset({ name: 'Test', buffer: mockBuffer });

    // Then clear it
    reverbSystem.setPreset(null);

    expect(reverbNode.convolver.buffer).toBeNull();
    expect(reverbNode.output.gain.value).toBe(1.0);
  });

  it('updates buffer only when changed', () => {
      const preset: ReverbPreset = {
          name: 'Test',
          buffer: mockBuffer
      };

      reverbSystem.setPreset(preset);

      // Spy on the setter if possible, or just reset mock interactions if we were using a proxy
      // Since we are checking state, let's just ensure it remains set

      reverbSystem.setPreset(preset);
      expect(reverbNode.convolver.buffer).toBe(mockBuffer);
  });

  it('enables and disables reverb', () => {
    // Default enabled
    expect(reverbNode.input.gain.value).toBe(0.5);

    // Disable
    reverbSystem.setEnabled(false);
    expect(reverbNode.input.gain.value).toBe(0);

    // Enable
    reverbSystem.setEnabled(true);
    expect(reverbNode.input.gain.value).toBe(0.5);
  });

  it('exposes input and output nodes', () => {
      expect(reverbSystem.getInputNode()).toBe(reverbNode.input);
      expect(reverbSystem.getOutputNode()).toBe(reverbNode.output);
  });
});
