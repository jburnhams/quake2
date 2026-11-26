export interface AudioParamLike {
  value: number;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  frequency: AudioParamLike;
  Q: AudioParamLike;
  type: string;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface DynamicsCompressorNodeLike extends AudioNodeLike {}

export interface ConvolverNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  normalize: boolean;
}

export interface AudioBufferLike {
  readonly duration: number;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  playbackRate: AudioParamLike;
  onended: (() => void) | null;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
}

export interface PannerNodeLike extends AudioNodeLike {
  positionX: AudioParamLike;
  positionY: AudioParamLike;
  positionZ: AudioParamLike;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: string;
}

export interface AudioDestinationNodeLike extends AudioNodeLike {}

export interface AudioContextLike {
  readonly destination: AudioDestinationNodeLike;
  readonly currentTime: number;
  state: 'suspended' | 'running' | 'closed';
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createGain(): GainNodeLike;
  createDynamicsCompressor(): DynamicsCompressorNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createPanner?(): PannerNodeLike;
  createBiquadFilter?(): BiquadFilterNodeLike;
  createConvolver?(): ConvolverNodeLike;
  decodeAudioData?(data: ArrayBuffer): Promise<AudioBufferLike>;
}

export type AudioContextFactory = () => AudioContextLike;

export interface AudioGraph {
  context: AudioContextLike;
  master: GainNodeLike;
  compressor: DynamicsCompressorNodeLike;
  filter?: BiquadFilterNodeLike;
  reverb?: ReverbNode;
}

export interface ReverbNode {
    convolver: ConvolverNodeLike;
    input: GainNodeLike; // Send to reverb
    output: GainNodeLike; // Return from reverb
}

export class AudioContextController {
  private context?: AudioContextLike;

  constructor(private readonly factory: AudioContextFactory) {}

  getContext(): AudioContextLike {
    if (!this.context) {
      this.context = this.factory();
    }
    return this.context;
  }

  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  getState(): AudioContextLike['state'] {
    return this.context?.state ?? 'suspended';
  }
}

export function createAudioGraph(controller: AudioContextController): AudioGraph {
  const context = controller.getContext();
  const master = context.createGain();
  master.gain.value = 1;
  const compressor = context.createDynamicsCompressor();
  const filter = context.createBiquadFilter?.();

  // Create reverb nodes if supported
  let reverb: ReverbNode | undefined;
  if (context.createConvolver && context.createGain) {
      const convolver = context.createConvolver();
      const input = context.createGain();
      const output = context.createGain();

      input.connect(convolver);
      convolver.connect(output);
      // Connect reverb output to master (will be routed through filter/compressor below)

      reverb = { convolver, input, output };
  }

  // Routing
  // Master -> Filter (optional) -> Compressor -> Destination

  if (filter) {
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    filter.Q.value = 0.707;
    master.connect(filter);
    filter.connect(compressor);

    // Connect reverb output to filter so it gets low-passed underwater too
    if (reverb) {
        reverb.output.connect(filter);
    }
  } else {
    master.connect(compressor);
    if (reverb) {
        reverb.output.connect(compressor);
    }
  }

  compressor.connect(context.destination);

  return { context, master, compressor, filter, reverb };
}
