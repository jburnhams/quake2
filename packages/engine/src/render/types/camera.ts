import { ReadonlyVec3 } from 'gl-matrix';

/**
 * Pure data representation of the camera state in Quake coordinate space.
 *
 * Coordinate System:
 * - Position: Quake world coordinates
 * - Angles: [pitch, yaw, roll] in degrees
 * - All values in game-engine space (no GL/WebGPU transforms)
 *
 * This interface is designed to be the single source of truth for renderers,
 * allowing them to build their own view/projection matrices natively.
 */
export interface CameraState {
  readonly position: ReadonlyVec3;     // Quake coords (X forward, Y left, Z up)
  readonly angles: ReadonlyVec3;       // [pitch, yaw, roll] in degrees
  readonly fov: number;                 // Field of view in degrees
  readonly aspect: number;              // Width / height
  readonly near: number;                // Near clip plane
  readonly far: number;                 // Far clip plane
}
