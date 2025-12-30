import { describe, expect, it, vi } from 'vitest';
import { AudioContextController } from '@quake2ts/engine/audio/context.js';
import { SoundRegistry } from '@quake2ts/engine/audio/registry.js';
import { AudioSystem } from '@quake2ts/engine/audio/system.js';
import { SoundChannel, ATTN_NORM } from '@quake2ts/engine/audio/constants.js';
import { FakeAudioContext, createMockAudioBuffer } from '@quake2ts/test-utils';
import { createOcclusionResolver } from '@quake2ts/engine/audio/occlusion.js';

describe('AudioSystem Integration with Occlusion', () => {
    it('integrates AudioOcclusion resolver to modify sound parameters', async () => {
        const fakeContext = new FakeAudioContext();
        const controller = new AudioContextController(() => fakeContext);
        const registry = new SoundRegistry();
        const soundIndex = registry.register('test/occlusion.wav', createMockAudioBuffer(1));

        // Mock trace to report obstruction (fraction < 1.0)
        // start, end, mins, maxs
        const traceFn = vi.fn().mockImplementation((start, end, mins, maxs) => {
            return {
                fraction: 0.5, // 50% obstructed (hit halfway)
                allsolid: false,
                startsolid: false,
                contents: 1 // Solid
            };
        });

        const occlusionResolver = createOcclusionResolver(traceFn);

        const system = new AudioSystem({
            context: controller,
            registry,
            playerEntity: 1,
            resolveOcclusion: occlusionResolver, // Inject the real resolver
            listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } }
        });

        await system.ensureRunning();

        // Play a sound at some distance
        const played = system.play({
            entity: 2,
            channel: SoundChannel.Auto,
            soundIndex,
            volume: 255,
            attenuation: ATTN_NORM,
            origin: { x: 200, y: 0, z: 0 }
        });

        expect(played).toBeTruthy();
        expect(traceFn).toHaveBeenCalled();

        // Verify that the AudioSystem applied the effects from the resolver
        // 1. Gain reduction
        // Base gain for 200 units with ATTN_NORM should be reduced further by occlusion (0.3 scale)
        // Let's check diagnostics for exact values
        const diag = system.getDiagnostics();
        const activeSound = diag.activeSounds[0];

        expect(activeSound).toBeDefined();

        // Check if occlusion was reported in diagnostics
        expect(activeSound.occlusion).toBeDefined();
        expect(activeSound.occlusion?.scale).toBe(0.3); // Hardcoded scale in occlusion.ts for obstructed
        expect(activeSound.occlusion?.lowpassHz).toBe(400); // Hardcoded cutoff in occlusion.ts for obstructed

        // Verify Web Audio Nodes
        // Filter should be present and set to ~400Hz
        const filter = fakeContext.filters.at(-1);
        expect(filter).toBeDefined();
        expect(filter?.frequency.value).toBe(400);

        // Gain should be scaled
        const gainNode = fakeContext.gains.at(-1); // Last gain is likely the sound's gain
        // Exact calculation:
        // Distance 200, ATTN_NORM (1000 max).
        // Attenuation factor: (1 - 200/1000) = 0.8 (Linear model used in Fake Panner?)
        // Wait, system.ts uses PannerNode. The gain node controlled by AudioSystem is mostly for volume * occlusion.
        // Panner handles distance attenuation usually, but AudioSystem also applies attenuationScale?
        // Let's verify standard AudioSystem behavior:
        // "const gainValue = attenuationScale * (request.volume / 255) * this.masterVolume * this.sfxVolume;"
        // And then "active.gain.gain.value = active.baseGain * occlusionScale"

        // We know scale is 0.3. So final gain should include that factor.
        expect(activeSound.gain).toBeCloseTo(activeSound.baseGain * 0.3);
    });

    it('bypasses occlusion effects when trace is clear', async () => {
        const fakeContext = new FakeAudioContext();
        const controller = new AudioContextController(() => fakeContext);
        const registry = new SoundRegistry();
        const soundIndex = registry.register('test/clear.wav', createMockAudioBuffer(1));

        // Mock trace to report clear path
        const traceFn = vi.fn().mockReturnValue({ fraction: 1.0 });

        const occlusionResolver = createOcclusionResolver(traceFn);

        const system = new AudioSystem({
            context: controller,
            registry,
            playerEntity: 1,
            resolveOcclusion: occlusionResolver,
            listener: { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } }
        });

        await system.ensureRunning();

        // Play a sound close by
        system.play({
            entity: 2,
            channel: SoundChannel.Auto,
            soundIndex,
            volume: 255,
            attenuation: ATTN_NORM,
            origin: { x: 10, y: 0, z: 0 }
        });

        const diag = system.getDiagnostics();
        const activeSound = diag.activeSounds[0];

        // Should not have occlusion applied (or very minimal distance based)
        // At distance 10, distanceFactor is tiny, so cutoff is near 20k.
        // system.ts: "Only return result if we are modifying the sound" (gain < 1 or cutoff < 20000)
        // occlusion.ts: "if (gainScale < 1.0 || finalCutoff < 20000)"
        // It returns undefined if close enough and clear.

        // However, checks in occlusion.ts:
        // const distanceCutoff = 20000 * (1 - distanceFactor * 0.9);
        // At dist 10, max 1000. factor 0.01. cutoff ~ 20000 * (1 - 0.009) = 19820.
        // So it MIGHT return a result just for slight distance filtering.

        // Let's check if filter exists.
        // If it exists, freq should be high.
        const filter = fakeContext.filters.at(-1);
        if (filter) {
            expect(filter.frequency.value).toBeGreaterThan(15000);
        }

        expect(activeSound.gain).toBeCloseTo(activeSound.baseGain * 1.0);
    });
});
