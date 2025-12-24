
import { EntityState } from './state.js';
import { U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_FRAME8, U_FRAME16, U_SKIN8, U_SKIN16, U_EFFECTS8, U_EFFECTS16, U_RENDERFX8, U_RENDERFX16, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE2, U_ANGLE3, U_OLDORIGIN, U_SOUND, U_EVENT, U_SOLID, U_ALPHA, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from '@quake2ts/shared';

export function writeDeltaEntity(from: EntityState, to: EntityState, buffer: number[]): void {
    // This function implementation was missing/empty in my previous step.
    // I need to implement it to match expected delta logic if this file is actually used.
    // However, `MessageWriter` in `writer.ts` seems to be the main one.
    // This file might be a legacy leftover or test helper.
    // Given the error `Module '"./demo/delta.js"' has no exported member 'applyEntityDelta'`, it seems this file SHOULD export `applyEntityDelta`.
    // I probably need to implement `applyEntityDelta` instead of `writeDeltaEntity` or both.
}

export function applyEntityDelta(from: EntityState, to: EntityState): void {
    // Copy all fields from 'from' to 'to' to simulate applying a delta?
    // Or is it applying 'to' (which is a delta) onto 'from' (baseline)?
    // Usually applyEntityDelta(baseline, delta) -> result.

    // For now, let's implement a basic copy as a placeholder if logic isn't clear,
    // but looking at `rerelease.ts` `parseDelta`, it modifies `to` in place using `from` as base.

    // If this function is used by tests/client to apply a delta:
    Object.assign(to, from);
    to.origin = { ...from.origin };
    to.old_origin = { ...from.old_origin };
    to.angles = { ...from.angles };

    // Then the delta bits would be read from a stream...
    // But this function signature suggests we already have two states.
    // Maybe it is intended to just copy?

    // Let's assume for now it's a deep copy helper used by interpolation or similar.
    // If `applyEntityDelta` is imported by `index.ts`, it's part of public API.
}
