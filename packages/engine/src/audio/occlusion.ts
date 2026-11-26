import type { OcclusionResolver, OcclusionResult, ListenerState } from './system.js';
import { lengthVec3, subtractVec3, type Vec3 } from '@quake2ts/shared';
import { calculateMaxAudibleDistance } from './constants.js';

// Type definition for the engine's trace function
export type TraceFn = (start: Vec3, end: Vec3, mins: Vec3 | undefined, maxs: Vec3 | undefined) => {
    fraction: number;
    allsolid?: boolean;
    startsolid?: boolean;
    contents?: number;
};

export class AudioOcclusion {
    constructor(private readonly trace: TraceFn) {}

    resolve: OcclusionResolver = (listener: ListenerState, source: Vec3, attenuation: number): OcclusionResult | undefined => {
        const dist = lengthVec3(subtractVec3(source, listener.origin));
        const maxDist = calculateMaxAudibleDistance(attenuation);

        // Distance-based low-pass
        // Even without occlusion, air absorbs high frequencies over distance.
        // We'll map distance 0..maxDist to 20000..1000 Hz.
        // This is a simple linear roll-off.

        // Clamp distance
        const clampedDist = Math.min(dist, maxDist);
        const distanceFactor = clampedDist / Math.max(1, maxDist); // 0 (close) to 1 (far)

        // Logarithmic feel? Or linear? Linear is fine for now.
        // 20kHz at 0, 2kHz at max distance
        const distanceCutoff = 20000 * (1 - distanceFactor * 0.9);

        // Trace from listener to source
        const tr = this.trace(listener.origin, source, undefined, undefined);

        let gainScale = 1.0;
        let occlusionCutoff = 20000;

        if (tr.fraction < 1.0) {
            // Obstructed
            gainScale = 0.3;
            occlusionCutoff = 400;
        }

        // Combine cutoffs (take minimum)
        const finalCutoff = Math.min(distanceCutoff, occlusionCutoff);

        // Only return result if we are modifying the sound
        if (gainScale < 1.0 || finalCutoff < 20000) {
            return {
                gainScale,
                lowpassHz: finalCutoff
            };
        }

        return undefined;
    };
}

export function createOcclusionResolver(trace: TraceFn): OcclusionResolver {
    const occlusion = new AudioOcclusion(trace);
    return occlusion.resolve;
}
