import { describe, expect, it, vi } from 'vitest';
import { AudioContextController } from '../../src/audio/context.js';
import { SoundRegistry } from '../../src/audio/registry.js';
import { AudioSystem } from '../../src/audio/system.js';
import { SoundChannel, calculateMaxAudibleDistance } from '../../src/audio/constants.js';
import { FakeAudioContext, createBuffer } from './fakes.js';

describe('AudioSystem', () => {
  it('resumes the audio context on demand and wires the master graph', async () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/windfly.wav', createBuffer(1));

    const system = new AudioSystem({ context: controller, registry, playerEntity: 1 });

    await system.ensureRunning();
    expect(fakeContext.state).toBe('running');
    expect(fakeContext.resumeCalls).toBe(1);

    const played = system.play({
      entity: 1,
      channel: SoundChannel.Weapon,
      soundIndex,
      volume: 255,
      attenuation: 1,
    });

    expect(played).toBeTruthy();
    const channelState = system.getChannelState(played!.channelIndex)!;
    expect(channelState.entnum).toBe(1);
    expect(channelState.active).toBe(true);
    expect(fakeContext.sources.at(-1)?.startedAt).toBe(0);
  });

  it('honors the initial master volume when creating the audio graph', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/windfly.wav', createBuffer(1));

    const system = new AudioSystem({ context: controller, registry, masterVolume: 0.25 });
    system.play({ entity: 1, channel: SoundChannel.Weapon, soundIndex, volume: 255, attenuation: 1 });

    expect(fakeContext.gains[0]?.gain.value).toBeCloseTo(0.25);
  });

  it('applies time offsets and overrides existing sounds on the same entchannel', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('weapons/blaster/fire.wav', createBuffer(0.5));

    const system = new AudioSystem({
      context: controller,
      registry,
      playerEntity: 2,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
    });

    const first = system.play({ entity: 2, channel: SoundChannel.Weapon, soundIndex, volume: 128, attenuation: 1 });
    const firstSource = fakeContext.sources.at(-1)!;
    const second = system.play({
      entity: 2,
      channel: SoundChannel.Weapon,
      soundIndex,
      volume: 128,
      attenuation: 1,
      timeOffsetMs: 200,
    });
    const secondSource = fakeContext.sources.at(-1)!;

    expect(firstSource.stoppedAt).toBe(0);
    expect(secondSource.startedAt).toBeCloseTo(0.2, 5);
    const channel = system.getChannelState(second!.channelIndex)!;
    expect(channel.endTimeMs).toBeGreaterThan(channel.entnum);
  });

  it('clears stale onended handlers when reusing a channel', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/windfly.wav', createBuffer(1));

    const system = new AudioSystem({ context: controller, registry, playerEntity: 7 });

    system.play({ entity: 7, channel: SoundChannel.Weapon, soundIndex, volume: 255, attenuation: 1 });
    const firstSource = fakeContext.sources.at(-1)!;
    firstSource.onended = () => {
      throw new Error('stale onended should have been cleared');
    };

    const second = system.play({ entity: 7, channel: SoundChannel.Weapon, soundIndex, volume: 255, attenuation: 1 });
    expect(second).toBeTruthy();

    // Manually trigger the stale callback and ensure the active sound remains tracked.
    firstSource.onended?.();

    const panner = second!.panner;
    system.updateEntityPosition(7, { x: 3, y: 2, z: 1 });

    expect(panner.positionX.value).toBe(3);
    expect(panner.positionY.value).toBe(2);
    expect(panner.positionZ.value).toBe(1);
  });

  it('treats channel flags as non-overriding bits', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('weapons/blaster/fire.wav', createBuffer(0.25));

    const system = new AudioSystem({ context: controller, registry, playerEntity: 9 });

    const flagged = system.play({
      entity: 9,
      channel: SoundChannel.Weapon | SoundChannel.Reliable,
      soundIndex,
      volume: 255,
      attenuation: 1,
    });
    const unflagged = system.play({
      entity: 9,
      channel: SoundChannel.Weapon,
      soundIndex,
      volume: 255,
      attenuation: 1,
    });

    expect(flagged?.channelIndex).toBe(unflagged?.channelIndex);
  });

  it('configures panners with rerelease-derived max distances', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('player/foot/step.wav', createBuffer(0.25));

    const system = new AudioSystem({ context: controller, registry, playerEntity: 5 });
    system.play({ entity: 3, channel: SoundChannel.Auto, soundIndex, volume: 255, attenuation: 3 });

    const panner = fakeContext.panners.at(-1)!;
    expect(panner.maxDistance).toBeCloseTo(calculateMaxAudibleDistance(3));
    expect(panner.rolloffFactor).toBeCloseTo(0.003);
    expect(panner.refDistance).toBeCloseTo(80);
  });

  it('plays positioned and ambient helpers with correct falloff defaults', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/water1.wav', createBuffer(2));

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
    });

    const positioned = system.positionedSound({ x: 10, y: 0, z: 0 }, soundIndex, 200, 1);
    const ambient = system.ambientSound({ x: -5, y: 0, z: 0 }, soundIndex, 255);

    expect(positioned).toBeTruthy();
    expect(ambient).toBeTruthy();

    const positionedPanner = fakeContext.panners.at(-2)!;
    expect(positionedPanner.distanceModel).toBe('inverse');
    const ambientPanner = fakeContext.panners.at(-1)!;
    expect(ambientPanner.distanceModel).toBe('linear');
    expect(ambientPanner.rolloffFactor).toBe(0);
    expect(ambient?.endTimeMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('falls back to gain-based panners when the context has no panner factory', () => {
    const fakeContext = new FakeAudioContext(false);
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/water1.wav', createBuffer(2));

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 1, y: 2, z: 3 }, right: { x: 1, y: 0, z: 0 } },
    });

    const active = system.play({ entity: 4, channel: SoundChannel.Auto, soundIndex, volume: 64, attenuation: 1 });
    expect(active).toBeTruthy();
    expect(active?.panner.positionX.value).toBe(1);
    system.updateEntityPosition(4, { x: -1, y: -2, z: -3 });
    expect(active?.panner.positionX.value).toBe(-1);
    expect(active?.panner.positionY.value).toBe(-2);
    expect(active?.panner.positionZ.value).toBe(-3);
  });

  it('updates looping sound positions when entities move', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/ambience/windfly.wav', createBuffer(1));

    const system = new AudioSystem({ context: controller, registry, listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } } });

    system.play({
      entity: 2,
      channel: SoundChannel.Body,
      soundIndex,
      volume: 255,
      attenuation: 1,
      origin: { x: 1, y: 2, z: 3 },
      looping: true,
    });

    const panner = fakeContext.panners.at(-1)!;
    expect(panner.positionX.value).toBe(1);
    expect(panner.positionY.value).toBe(2);
    expect(panner.positionZ.value).toBe(3);

    system.updateEntityPosition(2, { x: -4, y: -5, z: -6 });

    expect(panner.positionX.value).toBe(-4);
    expect(panner.positionY.value).toBe(-5);
    expect(panner.positionZ.value).toBe(-6);
  });

  it('stops entity-owned channels and toggles underwater filtering when available', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/wind.wav', createBuffer(1));

    const system = new AudioSystem({ context: controller, registry, listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } } });
    system.play({ entity: 3, channel: SoundChannel.Auto, soundIndex, volume: 255, attenuation: 1, origin: { x: 0, y: 0, z: 0 }, looping: true });
    expect(system.getChannelState(0)?.active).toBe(true);

    system.stopEntitySounds(3);
    expect(system.getChannelState(0)?.active).toBe(false);

    system.setUnderwater(true, 350);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(350);
    system.setUnderwater(false);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(20000);
  });

  it('reduces gain and applies optional lowpass filters when occlusion is reported', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/occluded.wav', createBuffer(1));
    const resolver = vi.fn().mockReturnValue({ gainScale: 0.3, lowpassHz: 900 });

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      resolveOcclusion: resolver,
    });

    const active = system.play({
      entity: 4,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: 255,
      attenuation: 1,
      origin: { x: 0, y: 0, z: 0 },
    });

    expect(active).toBeTruthy();
    expect(resolver).toHaveBeenCalledWith(
      { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      { x: 0, y: 0, z: 0 },
      1,
    );
    const diagnostics = system.getDiagnostics();
    const activeSound = diagnostics.activeSounds[0]!;
    expect(activeSound.gain).toBeCloseTo(activeSound.baseGain * 0.3);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(900);
    expect(diagnostics.activeChannels).toBe(1);
    expect(activeSound.occlusion?.scale).toBeCloseTo(0.3);
    expect(activeSound.occlusion?.lowpassHz).toBe(900);
  });

  it('prepares occlusion filters even when initial resolver results are clear', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/late-occlude.wav', createBuffer(1));
    const resolver = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ gainScale: 0.4, lowpassHz: 800 });

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      resolveOcclusion: resolver,
    });

    system.play({
      entity: 6,
      channel: SoundChannel.Body,
      soundIndex,
      volume: 255,
      attenuation: 1,
      origin: { x: 0, y: 0, z: 0 },
      looping: true,
    });

    expect(fakeContext.filters.length).toBeGreaterThan(0);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(20000);

    system.updateEntityPosition(6, { x: 5, y: 0, z: 0 });
    const diagnostics = system.getDiagnostics();
    const activeSound = diagnostics.activeSounds[0]!;
    expect(activeSound.gain).toBeCloseTo(activeSound.baseGain * 0.4);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(800);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('restores full-band playback when occlusion is cleared after being applied', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/clear-occlude.wav', createBuffer(1));
    const resolver = vi
      .fn()
      .mockReturnValueOnce({ gainScale: 0.2, lowpassHz: 700 })
      .mockReturnValueOnce(undefined);

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      resolveOcclusion: resolver,
    });

    system.play({
      entity: 7,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: 200,
      attenuation: 1,
      origin: { x: 2, y: 0, z: 0 },
      looping: true,
    });

    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(700);
    system.updateEntityPosition(7, { x: 3, y: 0, z: 0 });
    const diagnostics = system.getDiagnostics();
    const activeSound = diagnostics.activeSounds[0]!;
    expect(activeSound.gain).toBeCloseTo(activeSound.baseGain);
    expect(activeSound.occlusion?.lowpassHz).toBeUndefined();
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(20000);
  });

  it('refreshes occlusion state when tracked entities move', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/move.wav', createBuffer(1));
    const resolver = vi
      .fn()
      .mockReturnValueOnce({ gainScale: 0.5, lowpassHz: 1200 })
      .mockReturnValueOnce({ gainScale: 0.1, lowpassHz: 600 });

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      resolveOcclusion: resolver,
    });

    system.play({
      entity: 5,
      channel: SoundChannel.Body,
      soundIndex,
      volume: 200,
      attenuation: 1,
      origin: { x: 10, y: 0, z: 0 },
      looping: true,
    });

    expect(fakeContext.gains.at(-1)?.gain.value).toBeCloseTo(0.392, 3);
    system.updateEntityPosition(5, { x: 20, y: 0, z: 0 });
    expect(fakeContext.gains.at(-1)?.gain.value).toBeCloseTo(0.078, 3);
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(fakeContext.filters.at(-1)?.frequency.value).toBeCloseTo(600);
  });

  it('exposes diagnostics for channel usage and mixing levels', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('world/debug.wav', createBuffer(1));

    const system = new AudioSystem({
      context: controller,
      registry,
      listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } },
      masterVolume: 0.8,
      sfxVolume: 0.5,
    });

    system.play({
      entity: 1,
      channel: SoundChannel.Weapon,
      soundIndex,
      volume: 128,
      attenuation: 1,
      origin: { x: 0, y: 0, z: 0 },
    });

    const diagnostics = system.getDiagnostics();
    expect(diagnostics.masterVolume).toBeCloseTo(0.8);
    expect(diagnostics.sfxVolume).toBeCloseTo(0.5);
    expect(diagnostics.channels.length).toBeGreaterThan(0);
    expect(diagnostics.activeSounds[0]?.gain).toBeGreaterThan(0);
    expect(diagnostics.activeSounds[0]?.entchannel).toBe(SoundChannel.Weapon);
  });
});
