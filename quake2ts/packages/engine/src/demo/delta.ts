import { EntityState, U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_FRAME8, U_FRAME16, U_SKIN8, U_SKIN16, U_EFFECTS8, U_EFFECTS16, U_RENDERFX8, U_RENDERFX16, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE2, U_ANGLE3, U_OLDORIGIN, U_SOUND, U_EVENT, U_SOLID, U_ALPHA, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from './parser.js';

export function applyEntityDelta(to: EntityState, from: EntityState): void {
    const bits = from.bits;
    const bitsHigh = from.bitsHigh;
    to.number = from.number;

    if (bits & U_MODEL) to.modelindex = from.modelindex;
    if (bits & U_MODEL2) to.modelindex2 = from.modelindex2;
    if (bits & U_MODEL3) to.modelindex3 = from.modelindex3;
    if (bits & U_MODEL4) to.modelindex4 = from.modelindex4;

    if (bits & U_FRAME8) to.frame = from.frame;
    if (bits & U_FRAME16) to.frame = from.frame;

    if ((bits & U_SKIN8) || (bits & U_SKIN16)) to.skinnum = from.skinnum;

    if ((bits & U_EFFECTS8) || (bits & U_EFFECTS16)) to.effects = from.effects;

    if ((bits & U_RENDERFX8) || (bits & U_RENDERFX16)) to.renderfx = from.renderfx;

    if (bits & U_ORIGIN1) to.origin.x = from.origin.x;
    if (bits & U_ORIGIN2) to.origin.y = from.origin.y;
    if (bits & U_ORIGIN3) to.origin.z = from.origin.z;

    if (bits & U_ANGLE1) to.angles.x = from.angles.x;
    if (bits & U_ANGLE2) to.angles.y = from.angles.y;
    if (bits & U_ANGLE3) to.angles.z = from.angles.z;

    if (bits & U_OLDORIGIN) {
         to.old_origin.x = from.old_origin.x;
         to.old_origin.y = from.old_origin.y;
         to.old_origin.z = from.old_origin.z;
    }

    if (bits & U_SOUND) to.sound = from.sound;

    if (bits & U_EVENT) to.event = from.event;

    if (bits & U_SOLID) to.solid = from.solid;

    // Rerelease fields
    if (bits & U_ALPHA) to.alpha = from.alpha;
    if (bits & U_SCALE) to.scale = from.scale;
    if (bits & U_INSTANCE_BITS) to.instanceBits = from.instanceBits;
    if (bits & U_LOOP_VOLUME) to.loopVolume = from.loopVolume;

    if (bitsHigh & U_LOOP_ATTENUATION_HIGH) to.loopAttenuation = from.loopAttenuation;
    if (bitsHigh & U_OWNER_HIGH) to.owner = from.owner;
    if (bitsHigh & U_OLD_FRAME_HIGH) to.oldFrame = from.oldFrame;
}
