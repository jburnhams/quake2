export interface AudioParamLike {
  value: number;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface DynamicsCompressorNodeLike extends AudioNodeLike {}

export interface AudioBufferLike {
  readonly duration: number;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  onended: (() => void) | null;
  start(when?: number): void;
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
}

export type AudioContextFactory = () => AudioContextLike;

export interface AudioGraph {
  context: AudioContextLike;
  master: GainNodeLike;
  compressor: DynamicsCompressorNodeLike;
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
  master.connect(compressor);
  compressor.connect(context.destination);
  return { context, master, compressor };
}
