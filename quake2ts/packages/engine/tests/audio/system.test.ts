import { describe, expect, it } from 'vitest';
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
});
