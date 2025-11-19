import { ZERO_VEC3, type Vec3 } from '@quake2ts/shared';
import {
  ATTN_NONE,
  SOUND_FULLVOLUME,
  attenuationToDistanceMultiplier,
  calculateMaxAudibleDistance,
  SoundChannel,
} from './constants.js';
import {
  AudioContextController,
  createAudioGraph,
  type AudioContextLike,
  type AudioBufferSourceNodeLike,
  type AudioGraph,
  type BiquadFilterNodeLike,
  type GainNodeLike,
  type PannerNodeLike,
} from './context.js';
import { SoundRegistry } from './registry.js';
import { baseChannel, createInitialChannels, pickChannel, type ChannelState } from './channels.js';
import { spatializeOrigin, type ListenerState } from './spatialization.js';

export interface SoundRequest {
  entity: number;
  channel: number;
  soundIndex: number;
  volume: number;
  attenuation: number;
  origin?: Vec3;
  timeOffsetMs?: number;
  looping?: boolean;
}

export interface AudioSystemOptions {
  context: AudioContextController;
  registry: SoundRegistry;
  playerEntity?: number;
  listener?: ListenerState;
  sfxVolume?: number;
  masterVolume?: number;
  resolveOcclusion?: OcclusionResolver;
}

interface ActiveSound {
  channelIndex: number;
  entnum: number;
  entchannel: number;
  endTimeMs: number;
  source: AudioBufferSourceNodeLike;
  panner: PannerNodeLike;
  gain: GainNodeLike;
  baseGain: number;
  origin: Vec3;
  attenuation: number;
  occlusion?: OcclusionState;
}

interface OcclusionState {
  scale: number;
  lowpassHz?: number;
  filter?: BiquadFilterNodeLike;
}

export interface OcclusionResult {
  gainScale?: number;
  lowpassHz?: number;
}

export type OcclusionResolver = (
  listener: ListenerState,
  source: Vec3,
  attenuation: number,
) => OcclusionResult | undefined;

export interface AudioDiagnostics {
  activeChannels: number;
  masterVolume: number;
  sfxVolume: number;
  channels: ChannelState[];
  activeSounds: Array<{
    entnum: number;
    entchannel: number;
    channelIndex: number;
    origin: Vec3;
    gain: number;
    baseGain: number;
    attenuation: number;
    maxDistance?: number;
    distanceModel?: string;
    occlusion?: { scale: number; lowpassHz?: number };
  }>;
}

export class AudioSystem {
  private readonly channels: ChannelState[];
  private readonly registry: SoundRegistry;
  private readonly contextController: AudioContextController;
  private readonly graph: AudioGraph;
  private readonly playerEntity?: number;
  private readonly activeSources = new Map<number, ActiveSound>();
  private readonly resolveOcclusion?: OcclusionResolver;
  private listener: ListenerState;
  private sfxVolume: number;
  private masterVolume: number;

  constructor(options: AudioSystemOptions) {
    this.contextController = options.context;
    this.registry = options.registry;
    this.playerEntity = options.playerEntity;
    this.channels = createInitialChannels(options.playerEntity);
    this.listener = options.listener ?? { origin: ZERO_VEC3, right: { x: 1, y: 0, z: 0 } };
    this.sfxVolume = options.sfxVolume ?? 1;
    this.masterVolume = options.masterVolume ?? 1;
    this.resolveOcclusion = options.resolveOcclusion;
    this.graph = createAudioGraph(this.contextController);
    this.graph.master.gain.value = this.masterVolume;
  }

  setListener(listener: ListenerState): void {
    this.listener = listener;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    this.graph.master.gain.value = volume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = volume;
  }

  async ensureRunning(): Promise<void> {
    await this.contextController.resume();
  }

  play(request: SoundRequest): ActiveSound | undefined {
    const buffer = this.registry.get(request.soundIndex);
    if (!buffer) return undefined;

    const ctx = this.graph.context;
    const nowMs = ctx.currentTime * 1000;
    const channelIndex = pickChannel(this.channels, request.entity, request.channel, {
      nowMs,
      playerEntity: this.playerEntity,
    });

    if (channelIndex === undefined) return undefined;

    const existing = this.activeSources.get(channelIndex);
    if (existing) {
      existing.source.onended = null;
      existing.source.stop();
      this.activeSources.delete(channelIndex);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = request.looping ?? false;

    const origin = request.origin ?? this.listener.origin;
    const gain = ctx.createGain();
    const panner = this.createPanner(ctx, request.attenuation);
    const occlusion = this.resolveOcclusion?.(this.listener, origin, request.attenuation);
    const occlusionScale = clamp01(occlusion?.gainScale ?? 1);
    const occlusionFilter = this.resolveOcclusion
      ? this.createOcclusionFilter(ctx, occlusion?.lowpassHz ?? 20000)
      : undefined;
    this.applyOriginToPanner(panner, origin);
    const isListenerSound = request.entity === this.playerEntity;
    const spatial = spatializeOrigin(origin, this.listener, request.volume, request.attenuation, isListenerSound);

    const attenuationScale = request.volume === 0 ? 0 : Math.max(spatial.left, spatial.right) / Math.max(1, request.volume);
    const gainValue = attenuationScale * (request.volume / 255) * this.masterVolume * this.sfxVolume;
    gain.gain.value = gainValue * occlusionScale;

    const startTimeSec = ctx.currentTime + (request.timeOffsetMs ?? 0) / 1000;
    const endTimeMs = (request.looping ? Number.POSITIVE_INFINITY : buffer.duration * 1000) + startTimeSec * 1000;

    source.connect(panner);
    if (occlusionFilter) {
      panner.connect(occlusionFilter);
      occlusionFilter.connect(gain);
    } else {
      panner.connect(gain);
    }
    gain.connect(this.graph.master);

    source.start(startTimeSec);
    source.onended = () => {
      this.channels[channelIndex].active = false;
      this.activeSources.delete(channelIndex);
    };

    const active: ActiveSound = {
      channelIndex,
      entnum: request.entity,
      entchannel: baseChannel(request.channel),
      endTimeMs,
      source,
      panner,
      gain,
      baseGain: gainValue,
      origin,
      attenuation: request.attenuation,
      occlusion: occlusionFilter
        ? { scale: occlusionScale, lowpassHz: occlusion?.lowpassHz, filter: occlusionFilter }
        : occlusion
        ? { scale: occlusionScale, lowpassHz: occlusion.lowpassHz }
        : undefined,
    };

    this.channels[channelIndex] = {
      entnum: request.entity,
      entchannel: baseChannel(request.channel),
      endTimeMs,
      isPlayer: request.entity === this.playerEntity,
      active: true,
    };

    this.activeSources.set(channelIndex, active);
    return active;
  }

  stop(channelIndex: number): void {
    const active = this.activeSources.get(channelIndex);
    if (!active) return;
    active.source.stop();
    this.channels[channelIndex].active = false;
    this.activeSources.delete(channelIndex);
  }

  stopEntitySounds(entnum: number): void {
    for (const [index, active] of [...this.activeSources.entries()]) {
      if (active.entnum !== entnum) continue;
      active.source.stop();
      this.channels[index].active = false;
      this.activeSources.delete(index);
    }
  }

  updateEntityPosition(entnum: number, origin: Vec3): void {
    for (const active of this.activeSources.values()) {
      if (active.entnum !== entnum) continue;
      this.applyOriginToPanner(active.panner, origin);
      active.origin = origin;
      if (this.resolveOcclusion) {
        const occlusion = this.resolveOcclusion(this.listener, origin, active.attenuation);
        this.applyOcclusion(active, occlusion);
      }
    }
  }

  positionedSound(origin: Vec3, soundIndex: number, volume: number, attenuation: number): ActiveSound | undefined {
    return this.play({
      entity: 0,
      channel: SoundChannel.Auto,
      soundIndex,
      volume,
      attenuation,
      origin,
    });
  }

  ambientSound(origin: Vec3, soundIndex: number, volume: number): ActiveSound | undefined {
    return this.play({
      entity: 0,
      channel: SoundChannel.Auto,
      soundIndex,
      volume,
      attenuation: ATTN_NONE,
      origin,
      looping: true,
    });
  }

  getChannelState(index: number): ChannelState | undefined {
    return this.channels[index];
  }

  getDiagnostics(): AudioDiagnostics {
    return {
      activeChannels: this.activeSources.size,
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      channels: [...this.channels],
      activeSounds: [...this.activeSources.values()].map((sound) => ({
        entnum: sound.entnum,
        entchannel: sound.entchannel,
        channelIndex: sound.channelIndex,
        origin: sound.origin,
        gain: sound.gain.gain.value,
        baseGain: sound.baseGain,
        attenuation: sound.attenuation,
        maxDistance: sound.panner.maxDistance,
        distanceModel: sound.panner.distanceModel,
        occlusion: sound.occlusion ? { scale: sound.occlusion.scale, lowpassHz: sound.occlusion.lowpassHz } : undefined,
      })),
    };
  }

  setUnderwater(enabled: boolean, cutoffHz = 400): void {
    const filter = this.graph.filter;
    if (!filter) return;
    filter.type = 'lowpass';
    filter.Q.value = 0.707;
    filter.frequency.value = enabled ? cutoffHz : 20000;
  }

  private createPanner(context: AudioContextLike, attenuation: number): PannerNodeLike {
    const panner = context.createPanner
      ? context.createPanner()
      : Object.assign(context.createGain(), {
          positionX: { value: this.listener.origin.x },
          positionY: { value: this.listener.origin.y },
          positionZ: { value: this.listener.origin.z },
        } satisfies Partial<PannerNodeLike>);

    return this.configurePanner(panner, attenuation);
  }

  private configurePanner(panner: PannerNodeLike, attenuation: number): PannerNodeLike {
    const distMult = attenuationToDistanceMultiplier(attenuation);
    panner.refDistance = SOUND_FULLVOLUME;
    panner.maxDistance = calculateMaxAudibleDistance(attenuation);
    panner.rolloffFactor = distMult;
    panner.distanceModel = attenuation === 0 ? 'linear' : 'inverse';
    panner.positionX.value = this.listener.origin.x;
    panner.positionY.value = this.listener.origin.y;
    panner.positionZ.value = this.listener.origin.z;
    return panner;
  }

  private applyOriginToPanner(panner: PannerNodeLike, origin: Vec3): void {
    panner.positionX.value = origin.x;
    panner.positionY.value = origin.y;
    panner.positionZ.value = origin.z;
  }

  private createOcclusionFilter(context: AudioContextLike, cutoffHz: number): BiquadFilterNodeLike | undefined {
    if (!context.createBiquadFilter) return undefined;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.707;
    filter.frequency.value = clamp(cutoffHz, 10, 20000);
    return filter;
  }

  private applyOcclusion(active: ActiveSound, occlusion?: OcclusionResult): void {
    const scale = clamp01(occlusion?.gainScale ?? 1);
    active.gain.gain.value = active.baseGain * scale;
    if (active.occlusion?.filter) {
      const cutoff = occlusion?.lowpassHz ?? 20000;
      active.occlusion.filter.frequency.value = clamp(cutoff, 10, 20000);
    }
    if (active.occlusion) {
      active.occlusion.scale = scale;
      active.occlusion.lowpassHz = occlusion?.lowpassHz;
    } else if (occlusion) {
      active.occlusion = { scale, lowpassHz: occlusion.lowpassHz };
    }
  }
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);

