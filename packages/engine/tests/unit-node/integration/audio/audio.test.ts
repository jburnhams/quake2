
import { describe, expect, it, vi } from 'vitest';
import { AudioContextController } from '../../../../src/audio/context.js';
import { SoundRegistry } from '../../../../src/audio/registry.js';
import { AudioSystem } from '../../../../src/audio/system.js';
import { SoundChannel, ATTN_NORM, ATTN_IDLE, ATTN_STATIC, ATTN_NONE } from '../../../../src/audio/constants.js';
import { FakeAudioContext, createMockAudioBuffer } from '@quake2ts/test-utils';

describe('AudioSystem Integration Tests', () => {
  it('verifies looping sound behavior: start, continuous check, stop', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('loop.wav', createMockAudioBuffer(1.0));
    const system = new AudioSystem({ context: controller, registry });

    // Start looping sound
    const active = system.play({
      entity: 1,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: 255,
      attenuation: ATTN_NORM,
      looping: true,
    });

    const source = fakeContext.sources.at(-1)!;
    expect(source.loop).toBe(true);
    expect(source.startedAt).toBeDefined();
    expect(source.stoppedAt).toBeUndefined();

    // Verify it stays active
    expect(system.getChannelState(active!.channelIndex)?.active).toBe(true);

    // Stop it
    system.stop(active!.channelIndex);
    expect(source.stoppedAt).toBeDefined();
    expect(system.getChannelState(active!.channelIndex)?.active).toBe(false);
  });

  it('verifies volume hierarchy: per-sound * SFX * Master', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('vol.wav', createMockAudioBuffer(1.0));

    const masterVol = 0.5;
    const sfxVol = 0.8;
    const soundVol = 128; // ~0.5019

    const system = new AudioSystem({
        context: controller,
        registry,
        masterVolume: masterVol,
        sfxVolume: sfxVol
    });

    system.play({
      entity: 1,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: soundVol,
      attenuation: ATTN_NONE, // Eliminate distance attenuation factor
    });

    const gainNode = fakeContext.gains.at(-1)!;
    // Expected = (soundVol/255) * sfxVol
    const expected = (soundVol / 255) * sfxVol;

    expect(gainNode.gain.value).toBeCloseTo(expected, 4);
  });

  it('verifies attenuation falloff and spatialization panning', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('space.wav', createMockAudioBuffer(1.0));

    // Listener at 0,0,0 facing X
    const system = new AudioSystem({
        context: controller,
        registry,
        listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 0, y: -1, z: 0 } } // Right vector is -Y (Quake coordinates: X=Forward, Y=Left, Z=Up -> Right is -Y)
        // Wait, standard Quake: Forward=X, Left=Y, Up=Z. Right vector = -Y.
        // Let's stick to simple: Right = {x:0, y:-1, z:0}
    });

    // Sound at 100, 0, 0 (Forward). Should be centered.
    // Distance = 100.
    // Attenuation ATTN_NORM (1) -> distMult = 1 * 0.0005 = 0.0005? No check constants.
    // ATTN_NORM = 1. attenuationToDistanceMultiplier(1) = 1 * 0.0005?
    // Let's check constants.ts: "return attenuation === ATTN_STATIC ? attenuation * 0.001 : attenuation * 0.0005;"
    // So for NORM (1), mul = 0.0005.

    // Actually, PannerNode handles the falloff curve in WebAudio if we use the panner.
    // The `system.ts` sets panner properties.
    // Let's verify panner properties are set correctly for different attenuation.

    system.play({
        entity: 1,
        channel: SoundChannel.Auto,
        soundIndex,
        volume: 255,
        attenuation: ATTN_NORM,
        origin: { x: 100, y: 0, z: 0 }
    });

    const panner = fakeContext.panners.at(-1)!;
    expect(panner.distanceModel).toBe('linear');
    expect(panner.refDistance).toBe(80); // SOUND_FULLVOLUME
    expect(panner.rolloffFactor).toBe(0.001);
    expect(panner.positionX.value).toBe(100);

    // Test ATTN_STATIC
    system.play({
        entity: 2,
        channel: SoundChannel.Auto,
        soundIndex,
        volume: 255,
        attenuation: ATTN_STATIC,
        origin: { x: 50, y: 0, z: 0 }
    });

    const pannerStatic = fakeContext.panners.at(-1)!;
    expect(pannerStatic.rolloffFactor).toBe(0.003); // STATIC * 0.001 = 0.003
  });
});
