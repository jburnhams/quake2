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
}

interface ActiveSound {
  channelIndex: number;
  entnum: number;
  entchannel: number;
  endTimeMs: number;
  source: AudioBufferSourceNodeLike;
  panner: PannerNodeLike;
}

export class AudioSystem {
  private readonly channels: ChannelState[];
  private readonly registry: SoundRegistry;
  private readonly contextController: AudioContextController;
  private readonly graph: AudioGraph;
  private readonly playerEntity?: number;
  private readonly activeSources = new Map<number, ActiveSound>();
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
    this.graph = createAudioGraph(this.contextController);
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

    const gain = ctx.createGain();
    const panner = this.createPanner(ctx, request.attenuation);

    const origin = request.origin ?? this.listener.origin;
    this.applyOriginToPanner(panner, origin);
    const isListenerSound = request.entity === this.playerEntity;
    const spatial = spatializeOrigin(origin, this.listener, request.volume, request.attenuation, isListenerSound);

    const attenuationScale = request.volume === 0 ? 0 : Math.max(spatial.left, spatial.right) / Math.max(1, request.volume);
    const gainValue = attenuationScale * (request.volume / 255) * this.masterVolume * this.sfxVolume;
    gain.gain.value = gainValue;

    const startTimeSec = ctx.currentTime + (request.timeOffsetMs ?? 0) / 1000;
    const endTimeMs = (request.looping ? Number.POSITIVE_INFINITY : buffer.duration * 1000) + startTimeSec * 1000;

    source.connect(panner);
    panner.connect(gain);
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

  updateEntityPosition(entnum: number, origin: Vec3): void {
    for (const active of this.activeSources.values()) {
      if (active.entnum !== entnum) continue;
      this.applyOriginToPanner(active.panner, origin);
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

  private createPanner(context: AudioContextLike, attenuation: number): PannerNodeLike {
    const panner = context.createPanner ? context.createPanner() : (context.createGain() as unknown as PannerNodeLike);
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
}

