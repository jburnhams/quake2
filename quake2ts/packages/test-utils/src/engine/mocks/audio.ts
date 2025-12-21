import type {
  AudioContextLike,
  AudioDestinationNodeLike,
  AudioNodeLike,
  AudioParamLike,
  AudioBufferSourceNodeLike,
  AudioBufferLike,
  GainNodeLike,
  DynamicsCompressorNodeLike,
  PannerNodeLike,
  BiquadFilterNodeLike,
} from '@quake2ts/engine';

export class FakeAudioParam implements AudioParamLike {
  constructor(public value: number) {}
}

export class FakeAudioNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = [];
  connect(destination: AudioNodeLike): void {
    this.connections.push(destination);
  }
}

export class FakeGainNode extends FakeAudioNode implements GainNodeLike, DynamicsCompressorNodeLike {
  gain = new FakeAudioParam(1);
}

export class FakePannerNode extends FakeAudioNode implements PannerNodeLike {
  positionX = new FakeAudioParam(0);
  positionY = new FakeAudioParam(0);
  positionZ = new FakeAudioParam(0);
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: string;
}

export class FakeBiquadFilterNode extends FakeAudioNode implements BiquadFilterNodeLike {
  frequency = new FakeAudioParam(0);
  Q = new FakeAudioParam(0);
  type = 'lowpass';
}

export class FakeBufferSource extends FakeAudioNode implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  playbackRate = new FakeAudioParam(1);
  onended: (() => void) | null = null;
  startedAt?: number;
  stoppedAt?: number;
  start(when = 0, offset?: number, duration?: number): void {
    this.startedAt = when;
    this.offset = offset;
    this.duration = duration;
  }
  stop(when = 0): void {
    this.stoppedAt = when;
    this.onended?.();
  }
  offset?: number;
  duration?: number;
}

export class FakeDestination extends FakeAudioNode implements AudioDestinationNodeLike {}

export class FakeAudioContext implements AudioContextLike {
  readonly destination = new FakeDestination();
  state: AudioContextLike['state'] = 'suspended';
  currentTime = 0;
  resumeCalls = 0;
  readonly gains: GainNodeLike[] = [];
  readonly sources: FakeBufferSource[] = [];
  readonly panners: PannerNodeLike[] = [];
  readonly filters: BiquadFilterNodeLike[] = [];
  lastDecoded?: ArrayBuffer;
  createPanner?: () => PannerNodeLike;

  constructor(enablePanner = true) {
    if (enablePanner) {
      this.createPanner = () => {
        const node = new FakePannerNode();
        this.panners.push(node);
        return node;
      };
    }
  }

  async resume(): Promise<void> {
    this.state = 'running';
    this.resumeCalls += 1;
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  createGain(): GainNodeLike {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createDynamicsCompressor(): DynamicsCompressorNodeLike {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createBufferSource(): AudioBufferSourceNodeLike {
    const node = new FakeBufferSource();
    this.sources.push(node);
    return node;
  }

  createBiquadFilter(): BiquadFilterNodeLike {
    const node = new FakeBiquadFilterNode();
    this.filters.push(node);
    return node;
  }

  async decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    this.lastDecoded = data;
    return { duration: data.byteLength / 1000 };
  }

  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }
}

export const createMockAudioBuffer = (duration = 1, channels = 2, sampleRate = 44100): AudioBufferLike => ({ duration });

export const createMockAudioContext = (overrides?: Partial<AudioContext>): FakeAudioContext => new FakeAudioContext();

export const createMockPannerNode = (overrides?: Partial<PannerNode>): FakePannerNode => {
    const node = new FakePannerNode();
    if (overrides) {
        Object.assign(node, overrides);
    }
    return node;
}

export const createMockBufferSource = (buffer?: AudioBuffer): FakeBufferSource => {
    const node = new FakeBufferSource();
    if (buffer) {
        node.buffer = buffer;
    }
    return node;
}

export { FakeBufferSource as MockAudioBufferSourceNode };
