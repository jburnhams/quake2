import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReverbSystem, type ReverbPreset } from '../../../src/audio/reverb.js';
import { type ReverbNode, type AudioBufferLike } from '../../../src/audio/context.js';
import { createMockConvolverNode, createMockGainNode, FakeConvolverNode, FakeGainNode } from '@quake2ts/test-utils';

const mockBuffer: AudioBufferLike = {
  duration: 1.5
};

describe('ReverbSystem', () => {
  let reverbNode: ReverbNode;
  let reverbSystem: ReverbSystem;

  beforeEach(() => {
    reverbNode = {
        convolver: createMockConvolverNode(),
        input: createMockGainNode(),
        output: createMockGainNode()
    };
    reverbSystem = new ReverbSystem(reverbNode);
  });

  it('initializes with default gains', () => {
    expect((reverbNode.input as FakeGainNode).gain.value).toBe(0.5);
    expect((reverbNode.output as FakeGainNode).gain.value).toBe(1.0);
  });

  it('sets preset correctly', () => {
    const preset: ReverbPreset = {
      name: 'Test Hall',
      buffer: mockBuffer,
      gain: 0.8
    };

    reverbSystem.setPreset(preset);

    expect((reverbNode.convolver as FakeConvolverNode).buffer).toBe(mockBuffer);
    expect((reverbNode.output as FakeGainNode).gain.value).toBe(0.8);
  });

  it('clears preset correctly', () => {
    // First set a preset
    reverbSystem.setPreset({ name: 'Test', buffer: mockBuffer });

    // Then clear it
    reverbSystem.setPreset(null);

    expect((reverbNode.convolver as FakeConvolverNode).buffer).toBeNull();
    expect((reverbNode.output as FakeGainNode).gain.value).toBe(1.0);
  });

  it('updates buffer only when changed', () => {
      const preset: ReverbPreset = {
          name: 'Test',
          buffer: mockBuffer
      };

      reverbSystem.setPreset(preset);
      expect((reverbNode.convolver as FakeConvolverNode).buffer).toBe(mockBuffer);

      // Re-setting same preset shouldn't change anything, just verifying logic holds
      reverbSystem.setPreset(preset);
      expect((reverbNode.convolver as FakeConvolverNode).buffer).toBe(mockBuffer);
  });

  it('enables and disables reverb', () => {
    // Default enabled
    expect((reverbNode.input as FakeGainNode).gain.value).toBe(0.5);

    // Disable
    reverbSystem.setEnabled(false);
    expect((reverbNode.input as FakeGainNode).gain.value).toBe(0);

    // Enable
    reverbSystem.setEnabled(true);
    expect((reverbNode.input as FakeGainNode).gain.value).toBe(0.5);
  });

  it('exposes input and output nodes', () => {
      expect(reverbSystem.getInputNode()).toBe(reverbNode.input);
      expect(reverbSystem.getOutputNode()).toBe(reverbNode.output);
  });
});
