/** q_shared.c's vector helpers in the C's 32-bit floats: shared with the server and pmove ports (@quake2ts/shared's Original). */
import { Original } from '@quake2ts/shared';

export type Vec3 = Original.Vec3;
export type Rand = Original.Rand;
export const { f, vec3, lerpAngle, anglemod, angleVectors, vectorMA, short2angle, dot, vectorNormalize, vectorLength, crossProduct, vectorScale, vectorAdd, vectorSubtract, Rand } = Original;
