import { vi } from 'vitest';
import type { AudioSystem, SoundRegistry, SubtitleClient, AudioApiOptions, AudioApi } from '@quake2ts/engine';

export function createMockSoundRegistry(overrides?: Partial<SoundRegistry>): SoundRegistry {
  return {
    registerName: vi.fn().mockReturnValue(0),
    register: vi.fn().mockReturnValue(0),
    find: vi.fn().mockReturnValue(undefined),
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn().mockReturnValue(false),
    getName: vi.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as SoundRegistry;
}

export function createMockAudioSystem(overrides?: Partial<AudioSystem>): AudioSystem {
  return {
    ensureRunning: vi.fn().mockResolvedValue(undefined),
    setReverbPreset: vi.fn(),
    play: vi.fn().mockReturnValue(undefined),
    stop: vi.fn(),
    stopEntitySounds: vi.fn(),
    updateEntityPosition: vi.fn(),
    positionedSound: vi.fn().mockReturnValue(undefined),
    ambientSound: vi.fn().mockReturnValue(undefined),
    getChannelState: vi.fn().mockReturnValue(undefined),
    getDiagnostics: vi.fn().mockReturnValue({
      activeChannels: 0,
      masterVolume: 1,
      sfxVolume: 1,
      channels: [],
      activeSounds: [],
    }),
    setUnderwater: vi.fn(),
    setListener: vi.fn(),
    setMasterVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    reverb: undefined,
    ...overrides,
  } as unknown as AudioSystem;
}

export function createMockSubtitleClient(overrides?: Partial<SubtitleClient>): SubtitleClient {
  return {
    showSubtitle: vi.fn(),
    ...overrides,
  };
}

export function createMockAudioApiOptions(overrides?: Partial<AudioApiOptions>): AudioApiOptions {
  return {
    registry: createMockSoundRegistry(),
    system: createMockAudioSystem(),
    music: undefined,
    client: undefined,
    ...overrides,
  };
}

export function createMockAudioApi(overrides?: Partial<AudioApi>): AudioApi {
  return {
    soundindex: vi.fn().mockReturnValue(0),
    sound: vi.fn(),
    positioned_sound: vi.fn(),
    loop_sound: vi.fn(),
    stop_entity_sounds: vi.fn(),
    setPlaybackRate: vi.fn(),
    set_listener: vi.fn(),
    play_music: vi.fn().mockResolvedValue(undefined),
    play_track: vi.fn().mockResolvedValue(undefined),
    pause_music: vi.fn(),
    resume_music: vi.fn().mockResolvedValue(undefined),
    stop_music: vi.fn(),
    set_music_volume: vi.fn(),
    play_ambient: vi.fn(),
    play_channel: vi.fn(),
    ...overrides
  } as unknown as AudioApi;
}
