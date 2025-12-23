import { EntityState, U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_FRAME8, U_FRAME16, U_SKIN8, U_SKIN16, U_EFFECTS8, U_EFFECTS16, U_RENDERFX8, U_RENDERFX16, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE2, U_ANGLE3, U_OLDORIGIN, U_SOUND, U_EVENT, U_SOLID, U_ALPHA, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from './parser.js';

export function applyEntityDelta(to: EntityState, from: EntityState): void {
    const fromAny = from as any;
    const toAny = to as any;
    const bits = fromAny.bits;
    const bitsHigh = fromAny.bitsHigh;
    toAny.number = from.number;

    if (bits & U_MODEL) toAny.modelIndex = from.modelIndex;
    if (bits & U_MODEL2) toAny.modelIndex2 = from.modelIndex2;
    if (bits & U_MODEL3) toAny.modelIndex3 = from.modelIndex3;
    if (bits & U_MODEL4) toAny.modelIndex4 = from.modelIndex4;

    if (bits & U_FRAME8) toAny.frame = from.frame;
    if (bits & U_FRAME16) toAny.frame = from.frame;

    if ((bits & U_SKIN8) || (bits & U_SKIN16)) toAny.skinNum = from.skinNum;

    if ((bits & U_EFFECTS8) || (bits & U_EFFECTS16)) toAny.effects = from.effects;

    if ((bits & U_RENDERFX8) || (bits & U_RENDERFX16)) toAny.renderfx = from.renderfx;

    if (bits & U_ORIGIN1) toAny.origin.x = from.origin.x;
    if (bits & U_ORIGIN2) toAny.origin.y = from.origin.y;
    if (bits & U_ORIGIN3) toAny.origin.z = from.origin.z;

    if (bits & U_ANGLE1) toAny.angles.x = from.angles.x;
    if (bits & U_ANGLE2) toAny.angles.y = from.angles.y;
    if (bits & U_ANGLE3) toAny.angles.z = from.angles.z;

    if (bits & U_OLDORIGIN) {
         if (!toAny.oldOrigin) toAny.oldOrigin = { x: 0, y: 0, z: 0 };
         if (from.oldOrigin) {
             toAny.oldOrigin.x = from.oldOrigin.x;
             toAny.oldOrigin.y = from.oldOrigin.y;
             toAny.oldOrigin.z = from.oldOrigin.z;
         }
    }

    if (bits & U_SOUND) toAny.sound = from.sound;

    if (bits & U_EVENT) toAny.event = from.event;

    if (bits & U_SOLID) toAny.solid = from.solid;

    // Rerelease fields
    if (bits & U_ALPHA) toAny.alpha = from.alpha;
    if (bits & U_SCALE) toAny.scale = from.scale;
    if (bits & U_INSTANCE_BITS) toAny.instanceBits = from.instanceBits;
    if (bits & U_LOOP_VOLUME) toAny.loopVolume = from.loopVolume;

    if (bitsHigh & U_LOOP_ATTENUATION_HIGH) toAny.loopAttenuation = from.loopAttenuation;
    if (bitsHigh & U_OWNER_HIGH) toAny.owner = from.owner;
    if (bitsHigh & U_OLD_FRAME_HIGH) toAny.oldFrame = from.oldFrame;
}
