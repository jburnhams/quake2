import type { AudioBufferLike, ReverbNode } from './context.js';

export interface ReverbPreset {
  name: string;
  buffer: AudioBufferLike;
  gain?: number; // Output gain adjustment for this specific IR
}

export class ReverbSystem {
  private activePreset: ReverbPreset | null = null;
  private readonly node: ReverbNode;
  private enabled = true;

  constructor(node: ReverbNode) {
    this.node = node;
    // Default levels
    this.node.input.gain.value = 0.5; // Default send level
    this.node.output.gain.value = 1.0; // Default return level
  }

  setPreset(preset: ReverbPreset | null) {
    this.activePreset = preset;
    if (this.node.convolver.buffer !== (preset?.buffer ?? null)) {
        this.node.convolver.buffer = preset?.buffer ?? null;
    }

    // Adjust output gain based on preset
    if (preset && preset.gain !== undefined) {
        this.node.output.gain.value = preset.gain;
    } else {
        this.node.output.gain.value = 1.0;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.node.input.gain.value = 0;
    } else {
      this.node.input.gain.value = 0.5; // Restore default
    }
  }

  getOutputNode() {
      return this.node.output;
  }

  getInputNode() {
      return this.node.input;
  }
}
